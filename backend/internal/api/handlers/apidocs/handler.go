package apidocs

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	
	k8smanager "github.com/prasad/kaptivan/backend/internal/kubernetes"
)

type Handler struct {
	manager *k8smanager.ClusterManager
}

type APIGroup struct {
	Name             string    `json:"name"`
	PreferredVersion string    `json:"preferredVersion"`
	Versions         []string  `json:"versions"`
}

type APIResource struct {
	Name         string   `json:"name"`
	SingularName string   `json:"singularName"`
	Namespaced   bool     `json:"namespaced"`
	Kind         string   `json:"kind"`
	Verbs        []string `json:"verbs"`
	ShortNames   []string `json:"shortNames"`
	Categories   []string `json:"categories"`
	Group        string   `json:"group"`
	Version      string   `json:"version"`
}

type ResourceSchema struct {
	Kind        string                 `json:"kind"`
	APIVersion  string                 `json:"apiVersion"`
	Description string                 `json:"description"`
	Properties  map[string]interface{} `json:"properties"`
	Required    []string               `json:"required"`
	Example     string                 `json:"example"`
}

type ResourceField struct {
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	Description string         `json:"description"`
	Required    bool           `json:"required"`
	Default     interface{}    `json:"default,omitempty"`
	Properties  []ResourceField `json:"properties,omitempty"`
}

var handler *Handler

// Initialize creates a new APIDocs handler
func Initialize(manager *k8smanager.ClusterManager) {
	handler = &Handler{
		manager: manager,
	}
}

// GetHandler returns the initialized handler
func GetHandler() *Handler {
	return handler
}

// GetAPIGroups returns all available API groups
func (h *Handler) GetAPIGroups(c *gin.Context) {
	context := c.Query("context")
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	discoveryClient := clientset.Discovery()
	
	// Get server groups
	serverGroups, err := discoveryClient.ServerGroups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get API groups: " + err.Error()})
		return
	}

	var apiGroups []APIGroup
	
	// Add core API group
	apiGroups = append(apiGroups, APIGroup{
		Name:             "core",
		PreferredVersion: "v1",
		Versions:         []string{"v1"},
	})

	// Add other API groups
	for _, group := range serverGroups.Groups {
		versions := make([]string, 0, len(group.Versions))
		for _, version := range group.Versions {
			versions = append(versions, version.Version)
		}
		
		apiGroups = append(apiGroups, APIGroup{
			Name:             group.Name,
			PreferredVersion: group.PreferredVersion.Version,
			Versions:         versions,
		})
	}

	// Sort by name
	sort.Slice(apiGroups, func(i, j int) bool {
		return apiGroups[i].Name < apiGroups[j].Name
	})

	c.JSON(http.StatusOK, apiGroups)
}

// GetAPIResources returns resources for a specific API group/version
func (h *Handler) GetAPIResources(c *gin.Context) {
	context := c.Query("context")
	group := c.Query("group")
	version := c.Query("version")
	
	if context == "" || version == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and version are required"})
		return
	}

	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	discoveryClient := clientset.Discovery()
	
	// Construct the group version string
	var groupVersion string
	if group == "core" || group == "" {
		groupVersion = version
	} else {
		groupVersion = group + "/" + version
	}

	// Get resources for this group/version
	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(groupVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get resources: " + err.Error()})
		return
	}

	var resources []APIResource
	for _, resource := range resourceList.APIResources {
		// Skip subresources
		if strings.Contains(resource.Name, "/") {
			continue
		}

		apiResource := APIResource{
			Name:         resource.Name,
			SingularName: resource.SingularName,
			Namespaced:   resource.Namespaced,
			Kind:         resource.Kind,
			Verbs:        resource.Verbs,
			ShortNames:   resource.ShortNames,
			Categories:   resource.Categories,
			Group:        group,
			Version:      version,
		}
		
		resources = append(resources, apiResource)
	}

	// Sort by name
	sort.Slice(resources, func(i, j int) bool {
		return resources[i].Name < resources[j].Name
	})

	c.JSON(http.StatusOK, resources)
}

// GetResourceSchema returns the OpenAPI schema for a specific resource
func (h *Handler) GetResourceSchema(c *gin.Context) {
	context := c.Query("context")
	group := c.Query("group")
	version := c.Query("version")
	kind := c.Query("kind")
	
	if context == "" || version == "" || kind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, version, and kind are required"})
		return
	}

	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get OpenAPI schema
	openAPISchema, err := clientset.Discovery().OpenAPISchema()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get OpenAPI schema: " + err.Error()})
		return
	}

	// Parse the schema to find the definition for this resource
	schema := h.parseOpenAPISchema(openAPISchema, group, version, kind)
	
	c.JSON(http.StatusOK, schema)
}

// GetResourceExplain returns kubectl explain-like output for a resource
func (h *Handler) GetResourceExplain(c *gin.Context) {
	context := c.Query("context")
	resource := c.Query("resource")
	fieldPath := c.Query("fieldPath")
	
	if context == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and resource are required"})
		return
	}

	// Use kubectl explain command to get real data from the cluster
	explainOutput, err := h.executeKubectlExplain(context, resource, fieldPath)
	if err != nil {
		// Log the error for debugging
		fmt.Printf("kubectl explain failed for %s.%s: %v\n", resource, fieldPath, err)
		
		// Return error to frontend to show what went wrong
		c.JSON(http.StatusOK, gin.H{
			"resource":    resource,
			"fieldPath":   fieldPath,
			"explanation": fmt.Sprintf("Error: Unable to fetch kubectl explain output.\n\n%v\n\nPlease ensure kubectl is installed and the context '%s' is valid.", err, context),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"resource":    resource,
		"fieldPath":   fieldPath,
		"explanation": explainOutput,
	})
}

// SearchResources searches for resources by name
func (h *Handler) SearchResources(c *gin.Context) {
	context := c.Query("context")
	query := c.Query("query")
	
	if context == "" || query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and query are required"})
		return
	}

	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	discoveryClient := clientset.Discovery()
	
	// Get all resources
	_, apiResourceLists, err := discoveryClient.ServerGroupsAndResources()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get resources: " + err.Error()})
		return
	}

	var matchedResources []APIResource
	queryLower := strings.ToLower(query)
	
	for _, apiResourceList := range apiResourceLists {
		gv, _ := schema.ParseGroupVersion(apiResourceList.GroupVersion)
		
		for _, resource := range apiResourceList.APIResources {
			// Skip subresources
			if strings.Contains(resource.Name, "/") {
				continue
			}
			
			// Check if resource matches query
			if strings.Contains(strings.ToLower(resource.Name), queryLower) ||
			   strings.Contains(strings.ToLower(resource.Kind), queryLower) ||
			   containsString(resource.ShortNames, queryLower) {
				
				apiResource := APIResource{
					Name:         resource.Name,
					SingularName: resource.SingularName,
					Namespaced:   resource.Namespaced,
					Kind:         resource.Kind,
					Verbs:        resource.Verbs,
					ShortNames:   resource.ShortNames,
					Categories:   resource.Categories,
					Group:        gv.Group,
					Version:      gv.Version,
				}
				
				matchedResources = append(matchedResources, apiResource)
			}
		}
	}

	// Sort by name
	sort.Slice(matchedResources, func(i, j int) bool {
		return matchedResources[i].Name < matchedResources[j].Name
	})

	c.JSON(http.StatusOK, matchedResources)
}

// Helper functions

// executeKubectlExplain executes kubectl explain command to get real field documentation
func (h *Handler) executeKubectlExplain(context, resource, fieldPath string) (string, error) {
	// Build the explain target
	explainTarget := resource
	if fieldPath != "" {
		explainTarget = fmt.Sprintf("%s.%s", resource, fieldPath)
	}
	
	// Build kubectl command with proper kubeconfig context
	args := []string{"explain", explainTarget}
	
	// Add context if provided
	if context != "" {
		args = append(args, "--context", context)
	}
	
	// Execute kubectl explain command
	cmd := exec.Command("kubectl", args...)
	
	// Inherit the current environment (which includes PATH, KUBECONFIG, etc.)
	cmd.Env = os.Environ()
	
	// Set or override KUBECONFIG if we have a specific path
	kubeconfigPath := h.getKubeConfigPath()
	if kubeconfigPath != "" {
		// Check if KUBECONFIG is already in environment
		found := false
		for i, env := range cmd.Env {
			if strings.HasPrefix(env, "KUBECONFIG=") {
				cmd.Env[i] = fmt.Sprintf("KUBECONFIG=%s", kubeconfigPath)
				found = true
				break
			}
		}
		if !found {
			cmd.Env = append(cmd.Env, fmt.Sprintf("KUBECONFIG=%s", kubeconfigPath))
		}
	}
	
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	// Log the command for debugging
	fmt.Printf("Executing: kubectl %s\n", strings.Join(args, " "))
	
	err := cmd.Run()
	if err != nil {
		// Log the error for debugging
		stderrStr := stderr.String()
		fmt.Printf("kubectl explain error: %v\nstderr: %s\n", err, stderrStr)
		
		// Check if kubectl is not found
		if strings.Contains(err.Error(), "executable file not found") {
			return "", fmt.Errorf("kubectl not found in PATH")
		}
		
		// Check if it's a "field not found" error or similar
		if strings.Contains(stderrStr, "couldn't find resource") || 
		   strings.Contains(stderrStr, "error: Unknown resource") ||
		   strings.Contains(stderrStr, "the server doesn't have a resource type") {
			return "", fmt.Errorf("resource not found: %s", explainTarget)
		}
		
		if strings.Contains(stderrStr, "field") && strings.Contains(stderrStr, "does not exist") {
			return "", fmt.Errorf("field not found: %s", explainTarget)
		}
		
		// Return the full error for debugging
		return "", fmt.Errorf("kubectl explain failed: %v, stderr: %s", err, stderrStr)
	}
	
	output := stdout.String()
	
	// Clean up the output if needed
	output = strings.TrimSpace(output)
	
	// Ensure we got actual output
	if output == "" {
		return "", fmt.Errorf("kubectl explain returned empty output")
	}
	
	fmt.Printf("kubectl explain successful, output length: %d\n", len(output))
	return output, nil
}

// getKubeConfigPath gets the kubeconfig path from the manager
func (h *Handler) getKubeConfigPath() string {
	// First check if KUBECONFIG env var is set
	if kubeconfig := os.Getenv("KUBECONFIG"); kubeconfig != "" {
		return kubeconfig
	}
	
	// Otherwise use the default location (expanded properly)
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".kube", "config")
}

func (h *Handler) parseOpenAPISchema(openAPIDoc interface{}, group, version, kind string) ResourceSchema {
	// This is a simplified version - in production, you'd want to properly parse the OpenAPI document
	// using k8s.io/kube-openapi/pkg/util/proto or similar
	
	schema := ResourceSchema{
		Kind:        kind,
		APIVersion:  fmt.Sprintf("%s/%s", group, version),
		Description: fmt.Sprintf("Documentation for %s resource", kind),
		Properties:  make(map[string]interface{}),
		Required:    []string{},
	}
	
	// Add common properties
	schema.Properties["apiVersion"] = map[string]interface{}{
		"type":        "string",
		"description": "APIVersion defines the versioned schema of this representation of an object",
	}
	
	schema.Properties["kind"] = map[string]interface{}{
		"type":        "string",
		"description": "Kind is a string value representing the REST resource this object represents",
	}
	
	schema.Properties["metadata"] = map[string]interface{}{
		"type":        "object",
		"description": "Standard object's metadata",
	}
	
	schema.Properties["spec"] = map[string]interface{}{
		"type":        "object",
		"description": fmt.Sprintf("Specification of the desired behavior of the %s", kind),
	}
	
	schema.Properties["status"] = map[string]interface{}{
		"type":        "object",
		"description": fmt.Sprintf("Most recently observed status of the %s", kind),
	}
	
	// Generate example YAML
	schema.Example = h.generateExampleYAML(group, version, kind)
	
	return schema
}

func (h *Handler) generateExplainOutput(clientset kubernetes.Interface, resource, fieldPath string) string {
	var output strings.Builder
	
	// Parse the field path to determine what fields to show
	fields := strings.Split(fieldPath, ".")
	
	output.WriteString(fmt.Sprintf("KIND:     %s\n", resource))
	output.WriteString(fmt.Sprintf("VERSION:  v1\n\n"))
	output.WriteString("DESCRIPTION:\n")
	
	if fieldPath == "" {
		output.WriteString(fmt.Sprintf("     %s represents a %s in the cluster.\n\n", resource, resource))
		output.WriteString("FIELDS:\n")
		output.WriteString("   apiVersion\t<string>\n")
		output.WriteString("     APIVersion defines the versioned schema of this representation of an object.\n\n")
		output.WriteString("   kind\t<string>\n")
		output.WriteString("     Kind is a string value representing the REST resource this object represents.\n\n")
		output.WriteString("   metadata\t<Object>\n")
		output.WriteString("     Standard object's metadata.\n\n")
		output.WriteString("   spec\t<Object>\n")
		output.WriteString("     Specification of the desired behavior.\n\n")
		output.WriteString("   status\t<Object>\n")
		output.WriteString("     Most recently observed status.\n")
	} else if len(fields) > 0 && fields[0] == "metadata" {
		output.WriteString("     Standard object's metadata.\n\n")
		output.WriteString(fmt.Sprintf("FIELD:    %s\n\n", fieldPath))
		output.WriteString("FIELDS:\n")
		
		if len(fields) == 1 {
			// Show metadata fields
			output.WriteString("   annotations\t<map[string]string>\n")
			output.WriteString("     Annotations is an unstructured key value map stored with a resource.\n\n")
			output.WriteString("   creationTimestamp\t<string>\n")
			output.WriteString("     CreationTimestamp is a timestamp representing the server time when this object was created.\n\n")
			output.WriteString("   deletionGracePeriodSeconds\t<integer>\n")
			output.WriteString("     Number of seconds allowed for this object to gracefully terminate.\n\n")
			output.WriteString("   deletionTimestamp\t<string>\n")
			output.WriteString("     DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted.\n\n")
			output.WriteString("   finalizers\t<[]string>\n")
			output.WriteString("     Must be empty before the object is deleted from the registry.\n\n")
			output.WriteString("   generateName\t<string>\n")
			output.WriteString("     GenerateName is an optional prefix, used by the server, to generate a unique name.\n\n")
			output.WriteString("   generation\t<integer>\n")
			output.WriteString("     A sequence number representing a specific generation of the desired state.\n\n")
			output.WriteString("   labels\t<map[string]string>\n")
			output.WriteString("     Map of string keys and values that can be used to organize and categorize objects.\n\n")
			output.WriteString("   managedFields\t<[]Object>\n")
			output.WriteString("     ManagedFields maps workflow-id and version to the set of fields.\n\n")
			output.WriteString("   name\t<string>\n")
			output.WriteString("     Name must be unique within a namespace.\n\n")
			output.WriteString("   namespace\t<string>\n")
			output.WriteString("     Namespace defines the space within which each name must be unique.\n\n")
			output.WriteString("   ownerReferences\t<[]Object>\n")
			output.WriteString("     List of objects depended by this object.\n\n")
			output.WriteString("   resourceVersion\t<string>\n")
			output.WriteString("     An opaque value that represents the internal version of this object.\n\n")
			output.WriteString("   selfLink\t<string>\n")
			output.WriteString("     Deprecated: selfLink is a legacy read-only field.\n\n")
			output.WriteString("   uid\t<string>\n")
			output.WriteString("     UID is the unique in time and space value for this object.\n")
		} else if len(fields) >= 2 && fields[1] == "labels" {
			output.WriteString("     Map of string keys and values that can be used to organize and categorize objects.\n")
		} else if len(fields) >= 2 && fields[1] == "annotations" {
			output.WriteString("     Annotations is an unstructured key value map stored with a resource.\n")
		}
	} else if len(fields) > 0 && fields[0] == "spec" {
		output.WriteString("     Specification of the desired behavior.\n\n")
		output.WriteString(fmt.Sprintf("FIELD:    %s\n\n", fieldPath))
		output.WriteString("FIELDS:\n")
		
		if resource == "pods" && len(fields) == 1 {
			// Show pod spec fields
			output.WriteString("   activeDeadlineSeconds\t<integer>\n")
			output.WriteString("     Optional duration in seconds the pod may be active on the node.\n\n")
			output.WriteString("   affinity\t<Object>\n")
			output.WriteString("     If specified, the pod's scheduling constraints.\n\n")
			output.WriteString("   automountServiceAccountToken\t<boolean>\n")
			output.WriteString("     Indicates whether a service account token should be automatically mounted.\n\n")
			output.WriteString("   containers\t<[]Object> -required-\n")
			output.WriteString("     List of containers belonging to the pod.\n\n")
			output.WriteString("   dnsConfig\t<Object>\n")
			output.WriteString("     Specifies the DNS parameters of a pod.\n\n")
			output.WriteString("   dnsPolicy\t<string>\n")
			output.WriteString("     Set DNS policy for the pod.\n\n")
			output.WriteString("   enableServiceLinks\t<boolean>\n")
			output.WriteString("     Indicates whether information about services should be injected into pod's environment.\n\n")
			output.WriteString("   ephemeralContainers\t<[]Object>\n")
			output.WriteString("     List of ephemeral containers run in this pod.\n\n")
			output.WriteString("   hostAliases\t<[]Object>\n")
			output.WriteString("     HostAliases is an optional list of hosts and IPs that will be injected into the pod's hosts file.\n\n")
			output.WriteString("   hostIPC\t<boolean>\n")
			output.WriteString("     Use the host's ipc namespace.\n\n")
			output.WriteString("   hostNetwork\t<boolean>\n")
			output.WriteString("     Host networking requested for this pod.\n\n")
			output.WriteString("   hostPID\t<boolean>\n")
			output.WriteString("     Use the host's pid namespace.\n\n")
			output.WriteString("   hostname\t<string>\n")
			output.WriteString("     Specifies the hostname of the Pod.\n\n")
			output.WriteString("   imagePullSecrets\t<[]Object>\n")
			output.WriteString("     ImagePullSecrets is an optional list of references to secrets in the same namespace.\n\n")
			output.WriteString("   initContainers\t<[]Object>\n")
			output.WriteString("     List of initialization containers belonging to the pod.\n\n")
			output.WriteString("   nodeName\t<string>\n")
			output.WriteString("     NodeName is a request to schedule this pod onto a specific node.\n\n")
			output.WriteString("   nodeSelector\t<map[string]string>\n")
			output.WriteString("     NodeSelector is a selector which must be true for the pod to fit on a node.\n\n")
			output.WriteString("   priority\t<integer>\n")
			output.WriteString("     The priority value.\n\n")
			output.WriteString("   priorityClassName\t<string>\n")
			output.WriteString("     If specified, indicates the pod's priority.\n\n")
			output.WriteString("   restartPolicy\t<string>\n")
			output.WriteString("     Restart policy for all containers within the pod.\n\n")
			output.WriteString("   schedulerName\t<string>\n")
			output.WriteString("     If specified, the pod will be dispatched by specified scheduler.\n\n")
			output.WriteString("   securityContext\t<Object>\n")
			output.WriteString("     SecurityContext holds pod-level security attributes.\n\n")
			output.WriteString("   serviceAccount\t<string>\n")
			output.WriteString("     Deprecated: Use serviceAccountName instead.\n\n")
			output.WriteString("   serviceAccountName\t<string>\n")
			output.WriteString("     ServiceAccountName is the name of the ServiceAccount to use.\n\n")
			output.WriteString("   tolerations\t<[]Object>\n")
			output.WriteString("     If specified, the pod's tolerations.\n\n")
			output.WriteString("   volumes\t<[]Object>\n")
			output.WriteString("     List of volumes that can be mounted by containers belonging to the pod.\n")
		} else if resource == "pods" && len(fields) >= 2 && fields[1] == "containers" {
			output.WriteString("     List of containers belonging to the pod.\n\n")
			output.WriteString("FIELDS:\n")
			output.WriteString("   args\t<[]string>\n")
			output.WriteString("     Arguments to the entrypoint.\n\n")
			output.WriteString("   command\t<[]string>\n")
			output.WriteString("     Entrypoint array.\n\n")
			output.WriteString("   env\t<[]Object>\n")
			output.WriteString("     List of environment variables to set in the container.\n\n")
			output.WriteString("   envFrom\t<[]Object>\n")
			output.WriteString("     List of sources to populate environment variables in the container.\n\n")
			output.WriteString("   image\t<string>\n")
			output.WriteString("     Container image name.\n\n")
			output.WriteString("   imagePullPolicy\t<string>\n")
			output.WriteString("     Image pull policy. One of Always, Never, IfNotPresent.\n\n")
			output.WriteString("   lifecycle\t<Object>\n")
			output.WriteString("     Actions that the management system should take in response to container lifecycle events.\n\n")
			output.WriteString("   livenessProbe\t<Object>\n")
			output.WriteString("     Periodic probe of container liveness.\n\n")
			output.WriteString("   name\t<string> -required-\n")
			output.WriteString("     Name of the container.\n\n")
			output.WriteString("   ports\t<[]Object>\n")
			output.WriteString("     List of ports to expose from the container.\n\n")
			output.WriteString("   readinessProbe\t<Object>\n")
			output.WriteString("     Periodic probe of container service readiness.\n\n")
			output.WriteString("   resources\t<Object>\n")
			output.WriteString("     Compute Resources required by this container.\n\n")
			output.WriteString("   securityContext\t<Object>\n")
			output.WriteString("     SecurityContext defines the security options the container should be run with.\n\n")
			output.WriteString("   volumeMounts\t<[]Object>\n")
			output.WriteString("     Pod volumes to mount into the container's filesystem.\n\n")
			output.WriteString("   workingDir\t<string>\n")
			output.WriteString("     Container's working directory.\n")
		}
	} else if len(fields) > 0 && fields[0] == "status" {
		output.WriteString("     Most recently observed status.\n\n")
		output.WriteString(fmt.Sprintf("FIELD:    %s\n\n", fieldPath))
		output.WriteString("FIELDS:\n")
		
		if resource == "pods" && len(fields) == 1 {
			output.WriteString("   conditions\t<[]Object>\n")
			output.WriteString("     Current service state of pod.\n\n")
			output.WriteString("   containerStatuses\t<[]Object>\n")
			output.WriteString("     The list has one entry per container in the manifest.\n\n")
			output.WriteString("   ephemeralContainerStatuses\t<[]Object>\n")
			output.WriteString("     Status for any ephemeral containers.\n\n")
			output.WriteString("   hostIP\t<string>\n")
			output.WriteString("     IP address of the host to which the pod is assigned.\n\n")
			output.WriteString("   initContainerStatuses\t<[]Object>\n")
			output.WriteString("     The list has one entry per init container in the manifest.\n\n")
			output.WriteString("   message\t<string>\n")
			output.WriteString("     A human readable message indicating details about why the pod is in this condition.\n\n")
			output.WriteString("   phase\t<string>\n")
			output.WriteString("     The phase of a Pod is a simple, high-level summary of where the Pod is in its lifecycle.\n\n")
			output.WriteString("   podIP\t<string>\n")
			output.WriteString("     IP address allocated to the pod.\n\n")
			output.WriteString("   podIPs\t<[]Object>\n")
			output.WriteString("     IP addresses allocated to the pod.\n\n")
			output.WriteString("   qosClass\t<string>\n")
			output.WriteString("     The Quality of Service (QOS) classification assigned to the pod.\n\n")
			output.WriteString("   reason\t<string>\n")
			output.WriteString("     A brief CamelCase message indicating details about why the pod is in this state.\n\n")
			output.WriteString("   startTime\t<string>\n")
			output.WriteString("     RFC 3339 date and time at which the object was acknowledged by the Kubelet.\n")
		}
	} else {
		// Generic fallback for unknown field paths
		output.WriteString(fmt.Sprintf("     Field %s of %s.\n\n", fieldPath, resource))
		output.WriteString(fmt.Sprintf("FIELD:    %s\n\n", fieldPath))
		output.WriteString("FIELDS:\n")
		output.WriteString("   <Object>\n")
		output.WriteString("     This field contains nested properties.\n")
	}
	
	return output.String()
}

func (h *Handler) generateExampleYAML(group, version, kind string) string {
	apiVersion := version
	if group != "" && group != "core" {
		apiVersion = fmt.Sprintf("%s/%s", group, version)
	}
	
	example := fmt.Sprintf(`apiVersion: %s
kind: %s
metadata:
  name: example-%s
  namespace: default
spec:
  # Add your specification here
status:
  # This is typically managed by the system`, 
		apiVersion, 
		kind, 
		strings.ToLower(kind))
	
	return example
}

func containsString(slice []string, str string) bool {
	for _, s := range slice {
		if strings.Contains(strings.ToLower(s), str) {
			return true
		}
	}
	return false
}