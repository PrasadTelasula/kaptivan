package manifests

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/yaml"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets up the manifest handlers with the cluster manager
func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

// ResourceListRequest represents a request to list resources
type ResourceListRequest struct {
	Context    string `json:"context" binding:"required"`
	Namespace  string `json:"namespace"`
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Group      string `json:"group"`
	Version    string `json:"version"`
	Resource   string `json:"resource"`
}

// ResourceItem represents a basic resource item
type ResourceItem struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace,omitempty"`
	Kind              string            `json:"kind"`
	APIVersion        string            `json:"apiVersion"`
	UID               string            `json:"uid"`
	CreationTimestamp string            `json:"creationTimestamp"`
	Labels            map[string]string `json:"labels,omitempty"`
}

// APIResource represents a discovered API resource
type APIResource struct {
	Name       string   `json:"name"`
	Namespaced bool     `json:"namespaced"`
	Kind       string   `json:"kind"`
	Group      string   `json:"group"`
	Version    string   `json:"version"`
	APIVersion string   `json:"apiVersion"`
	Verbs      []string `json:"verbs"`
}

// ListAPIResources discovers and lists all available API resources in the cluster
func ListAPIResources(c *gin.Context) {
	contextName := c.Query("context")
	if contextName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := clusterManager.GetConnection(contextName)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Get all API resources using discovery
	discoveryClient := conn.ClientSet.Discovery()
	
	// Get all API resource lists
	apiResourceLists, err := discoveryClient.ServerPreferredResources()
	if err != nil {
		// Even with errors, we might have partial results
		if apiResourceLists == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to discover resources: %v", err)})
			return
		}
	}

	var resources []APIResource
	for _, apiResourceList := range apiResourceLists {
		// Parse the group/version from the GroupVersion field
		gv, err := schema.ParseGroupVersion(apiResourceList.GroupVersion)
		if err != nil {
			continue
		}

		for _, apiResource := range apiResourceList.APIResources {
			// Skip sub-resources (like pods/log, pods/exec)
			if strings.Contains(apiResource.Name, "/") {
				continue
			}

			resources = append(resources, APIResource{
				Name:       apiResource.Name,
				Namespaced: apiResource.Namespaced,
				Kind:       apiResource.Kind,
				Group:      gv.Group,
				Version:    gv.Version,
				APIVersion: apiResourceList.GroupVersion,
				Verbs:      apiResource.Verbs,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": resources,
		"total":     len(resources),
	})
}

// ListResources lists resources of any type dynamically
func ListResources(c *gin.Context) {
	var req ResourceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := clusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Create dynamic client
	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	// Build the GroupVersionResource
	var gvr schema.GroupVersionResource
	
	// If specific group/version/resource provided, use them
	if req.Group != "" && req.Version != "" && req.Resource != "" {
		gvr = schema.GroupVersionResource{
			Group:    req.Group,
			Version:  req.Version,
			Resource: req.Resource,
		}
	} else {
		// Try to discover the resource from Kind and APIVersion
		gvr, err = findResourceByKind(conn, req.Kind, req.APIVersion)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to find resource: %v", err)})
			return
		}
	}

	// Determine if the resource is namespaced
	isNamespaced, err := isResourceNamespaced(conn, gvr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to determine if resource is namespaced: %v", err)})
		return
	}

	// List resources
	var list *unstructured.UnstructuredList
	ctx := context.TODO()

	if isNamespaced {
		namespace := req.Namespace
		if namespace == "" || namespace == "all" {
			namespace = metav1.NamespaceAll
		}
		list, err = dynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	} else {
		list, err = dynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to list resources: %v", err)})
		return
	}

	// Convert to ResourceItems
	var items []ResourceItem
	for _, item := range list.Items {
		metadata := item.Object["metadata"].(map[string]interface{})
		
		resourceItem := ResourceItem{
			Name:       metadata["name"].(string),
			Kind:       item.GetKind(),
			APIVersion: item.GetAPIVersion(),
		}

		if uid, ok := metadata["uid"].(string); ok {
			resourceItem.UID = uid
		}

		if namespace, ok := metadata["namespace"].(string); ok {
			resourceItem.Namespace = namespace
		}

		if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
			resourceItem.CreationTimestamp = creationTimestamp
		}

		if labels, ok := metadata["labels"].(map[string]interface{}); ok {
			resourceItem.Labels = make(map[string]string)
			for k, v := range labels {
				if str, ok := v.(string); ok {
					resourceItem.Labels[k] = str
				}
			}
		}

		items = append(items, resourceItem)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": len(items),
	})
}

// GetManifest returns the YAML manifest for any resource type
func GetManifest(c *gin.Context) {
	clusterContext := c.Query("context")
	name := c.Query("name")
	
	// Accept resource info either from path params or query params
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")
	
	// Alternative: accept kind and apiVersion to discover the resource
	kind := c.Query("kind")
	apiVersion := c.Query("apiVersion")

	if clusterContext == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and name are required"})
		return
	}

	if (group == "" || version == "" || resource == "") && (kind == "" || apiVersion == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "either (group, version, resource) or (kind, apiVersion) are required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		errMsg := "cluster not connected"
		if err != nil {
			errMsg = fmt.Sprintf("cluster not connected: %v", err)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "context": clusterContext})
		return
	}

	// Create dynamic client
	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	// Build the GroupVersionResource
	var gvr schema.GroupVersionResource
	
	if group != "" && version != "" && resource != "" {
		gvr = schema.GroupVersionResource{
			Group:    group,
			Version:  version,
			Resource: resource,
		}
	} else {
		// Try to discover the resource from Kind and APIVersion
		gvr, err = findResourceByKind(conn, kind, apiVersion)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to find resource: %v", err)})
			return
		}
	}

	// Determine if the resource is namespaced
	isNamespaced, err := isResourceNamespaced(conn, gvr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to determine if resource is namespaced: %v", err)})
		return
	}

	// Get the resource
	var obj *unstructured.Unstructured
	ctx := context.TODO()

	if isNamespaced {
		if namespace == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required for namespaced resources"})
			return
		}
		obj, err = dynamicClient.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		obj, err = dynamicClient.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get resource: %v", err)})
		return
	}

	// Clean the manifest
	cleanManifest(obj)

	// Convert to YAML
	yamlData, err := yaml.Marshal(obj.Object)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to convert to YAML: %v", err)})
		return
	}

	c.String(http.StatusOK, string(yamlData))
}

// findResourceByKind discovers the GVR for a given Kind and APIVersion
func findResourceByKind(conn *kubernetes.ClusterConnection, kind string, apiVersion string) (schema.GroupVersionResource, error) {
	// Parse the apiVersion
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		// Handle core/v1 or just v1
		if apiVersion == "v1" || apiVersion == "core/v1" {
			gv = schema.GroupVersion{Group: "", Version: "v1"}
		} else {
			return schema.GroupVersionResource{}, fmt.Errorf("invalid apiVersion: %s", apiVersion)
		}
	}

	// Get the discovery client
	discoveryClient := conn.ClientSet.Discovery()

	// Get the API resource list for this group/version
	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(gv.String())
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("failed to discover resources for %s: %v", gv.String(), err)
	}

	// Find the resource with matching Kind
	for _, apiResource := range resourceList.APIResources {
		if apiResource.Kind == kind {
			return schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: apiResource.Name,
			}, nil
		}
	}

	return schema.GroupVersionResource{}, fmt.Errorf("resource with kind %s not found in %s", kind, apiVersion)
}

// isResourceNamespaced checks if a resource is namespaced
func isResourceNamespaced(conn *kubernetes.ClusterConnection, gvr schema.GroupVersionResource) (bool, error) {
	discoveryClient := conn.ClientSet.Discovery()
	
	// Get the API resource list for this group/version
	gvString := gvr.GroupVersion().String()
	if gvr.Group == "" {
		gvString = gvr.Version
	}
	
	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(gvString)
	if err != nil {
		return false, err
	}

	// Find the resource and check if it's namespaced
	for _, apiResource := range resourceList.APIResources {
		if apiResource.Name == gvr.Resource {
			return apiResource.Namespaced, nil
		}
	}

	return false, fmt.Errorf("resource %s not found", gvr.Resource)
}

// GetRelatedResources returns resources related to a given resource (owners and children)
func GetRelatedResources(c *gin.Context) {
	clusterContext := c.Query("context")
	name := c.Query("name")
	namespace := c.Query("namespace")
	kind := c.Query("kind")
	// apiVersion is provided but not currently used as we handle known resource types
	// It could be used in the future for more dynamic resource discovery
	_ = c.Query("apiVersion")

	if clusterContext == "" || name == "" || kind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, name, and kind are required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		errMsg := "cluster not connected"
		if err != nil {
			errMsg = fmt.Sprintf("cluster not connected: %v", err)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "context": clusterContext})
		return
	}

	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)
	
	type RelatedResource struct {
		Name         string `json:"name"`
		Namespace    string `json:"namespace,omitempty"`
		Kind         string `json:"kind"`
		APIVersion   string `json:"apiVersion"`
		Relationship string `json:"relationship"` // "owner" or "child"
	}

	var relatedResources []RelatedResource
	ctx := context.TODO()

	// Handle different resource relationships
	switch strings.ToLower(kind) {
	case "deployment":
		// Get ReplicaSets owned by this Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}
		
		rsList, err := dynamicClient.Resource(rsGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, rs := range rsList.Items {
				// Check if this ReplicaSet is owned by our Deployment
				ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "Deployment" && owner["name"] == name {
								rsName, _, _ := unstructured.NestedString(rs.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:       rsName,
									Namespace:  namespace,
									Kind:       "ReplicaSet",
									APIVersion: "apps/v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "replicaset":
		// Get owner Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}
		
		rs, err := dynamicClient.Resource(rsGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						if owner["kind"] == "Deployment" {
							ownerName, _ := owner["name"].(string)
							relatedResources = append(relatedResources, RelatedResource{
								Name:       ownerName,
								Namespace:  namespace,
								Kind:       "Deployment",
								APIVersion: "apps/v1",
								Relationship: "owner",
							})
						}
					}
				}
			}
		}

		// Get Pods owned by this ReplicaSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}
		
		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "ReplicaSet" && owner["name"] == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:       podName,
									Namespace:  namespace,
									Kind:       "Pod",
									APIVersion: "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "pod":
		// Get owner (could be ReplicaSet, DaemonSet, StatefulSet, Job, etc.)
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}
		
		pod, err := dynamicClient.Resource(podGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						ownerKind, _ := owner["kind"].(string)
						ownerName, _ := owner["name"].(string)
						ownerAPIVersion, _ := owner["apiVersion"].(string)
						
						if ownerAPIVersion == "" {
							// Default API versions for common owners
							switch ownerKind {
							case "ReplicaSet", "DaemonSet", "StatefulSet", "Deployment":
								ownerAPIVersion = "apps/v1"
							case "Job":
								ownerAPIVersion = "batch/v1"
							case "CronJob":
								ownerAPIVersion = "batch/v1"
							}
						}
						
						relatedResources = append(relatedResources, RelatedResource{
							Name:       ownerName,
							Namespace:  namespace,
							Kind:       ownerKind,
							APIVersion: ownerAPIVersion,
							Relationship: "owner",
						})
					}
				}
			}
		}

	case "statefulset", "daemonset":
		// Get Pods owned by this StatefulSet/DaemonSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}
		
		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							ownerKind, _ := owner["kind"].(string)
							ownerName, _ := owner["name"].(string)
							if strings.EqualFold(ownerKind, kind) && ownerName == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:       podName,
									Namespace:  namespace,
									Kind:       "Pod",
									APIVersion: "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "service":
		// Get Pods selected by this Service
		svcGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "services",
		}
		
		svc, err := dynamicClient.Resource(svcGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			selector, found, _ := unstructured.NestedStringMap(svc.Object, "spec", "selector")
			if found && len(selector) > 0 {
				// Build label selector
				var labelSelectors []string
				for k, v := range selector {
					labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", k, v))
				}
				labelSelector := strings.Join(labelSelectors, ",")
				
				// Get pods matching the selector
				podGVR := schema.GroupVersionResource{
					Group:    "",
					Version:  "v1",
					Resource: "pods",
				}
				
				podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, pod := range podList.Items {
						podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
						relatedResources = append(relatedResources, RelatedResource{
							Name:       podName,
							Namespace:  namespace,
							Kind:       "Pod",
							APIVersion: "v1",
							Relationship: "child",
						})
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": relatedResources,
	})
}

// cleanManifest removes unnecessary fields from the manifest
func cleanManifest(obj *unstructured.Unstructured) {
	// Remove managed fields
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")
	unstructured.RemoveNestedField(obj.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(obj.Object, "metadata", "selfLink")
	unstructured.RemoveNestedField(obj.Object, "metadata", "uid")
	unstructured.RemoveNestedField(obj.Object, "metadata", "generation")
	
	// Remove empty status if it exists
	if status, found, _ := unstructured.NestedMap(obj.Object, "status"); found {
		if len(status) == 0 {
			unstructured.RemoveNestedField(obj.Object, "status")
		}
	}
	
	// Remove empty finalizers
	if finalizers, found, _ := unstructured.NestedSlice(obj.Object, "metadata", "finalizers"); found {
		if len(finalizers) == 0 {
			unstructured.RemoveNestedField(obj.Object, "metadata", "finalizers")
		}
	}
	
	// Remove empty ownerReferences
	if ownerRefs, found, _ := unstructured.NestedSlice(obj.Object, "metadata", "ownerReferences"); found {
		if len(ownerRefs) == 0 {
			unstructured.RemoveNestedField(obj.Object, "metadata", "ownerReferences")
		}
	}
}