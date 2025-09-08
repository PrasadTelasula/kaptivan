package resources

import (
	"context"
	"net/http"
	"sync"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

type ResourceCount struct {
	Pods          int `json:"pods"`
	Services      int `json:"services"`
	Deployments   int `json:"deployments"`
	StatefulSets  int `json:"statefulSets"`
	DaemonSets    int `json:"daemonSets"`
	ReplicaSets   int `json:"replicaSets"`
	Jobs          int `json:"jobs"`
	CronJobs      int `json:"cronJobs"`
	ConfigMaps    int `json:"configMaps"`
	Secrets       int `json:"secrets"`
	PVCs          int `json:"pvcs"`
	Ingresses     int `json:"ingresses"`
	NetworkPolicies int `json:"networkPolicies"`
	ServiceAccounts int `json:"serviceAccounts"`
	Roles         int `json:"roles"`
	RoleBindings  int `json:"roleBindings"`
}

type NamespaceResources struct {
	Namespace string        `json:"namespace"`
	Cluster   string        `json:"cluster"`
	Resources ResourceCount `json:"resources"`
	Total     int          `json:"total"`
}

var manager *kubernetes.ClusterManager

func Initialize(m *kubernetes.ClusterManager) {
	manager = m
}

// GetNamespaceResources returns resource counts for a specific namespace
func GetNamespaceResources(c *gin.Context) {
	contextName := c.Query("context")
	namespace := c.Query("namespace")
	
	if contextName == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and namespace are required"})
		return
	}
	
	clientset, err := manager.GetClientset(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}
	
	ctx := context.Background()
	resources := ResourceCount{}
	
	// Use goroutines for concurrent fetching
	type result struct {
		field string
		count int
	}
	
	results := make(chan result, 16)
	var wg sync.WaitGroup
	
	// Count Pods
	wg.Add(1)
	go func() {
		defer wg.Done()
		if pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"pods", len(pods.Items)}
		}
	}()
	
	// Count Services
	wg.Add(1)
	go func() {
		defer wg.Done()
		if services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"services", len(services.Items)}
		}
	}()
	
	// Count Deployments
	wg.Add(1)
	go func() {
		defer wg.Done()
		if deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"deployments", len(deployments.Items)}
		}
	}()
	
	// Count StatefulSets
	wg.Add(1)
	go func() {
		defer wg.Done()
		if statefulSets, err := clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"statefulSets", len(statefulSets.Items)}
		}
	}()
	
	// Count DaemonSets
	wg.Add(1)
	go func() {
		defer wg.Done()
		if daemonSets, err := clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"daemonSets", len(daemonSets.Items)}
		}
	}()
	
	// Count ReplicaSets
	wg.Add(1)
	go func() {
		defer wg.Done()
		if replicaSets, err := clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"replicaSets", len(replicaSets.Items)}
		}
	}()
	
	// Count Jobs
	wg.Add(1)
	go func() {
		defer wg.Done()
		if jobs, err := clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"jobs", len(jobs.Items)}
		}
	}()
	
	// Count CronJobs
	wg.Add(1)
	go func() {
		defer wg.Done()
		if cronJobs, err := clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"cronJobs", len(cronJobs.Items)}
		}
	}()
	
	// Count ConfigMaps
	wg.Add(1)
	go func() {
		defer wg.Done()
		if configMaps, err := clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"configMaps", len(configMaps.Items)}
		}
	}()
	
	// Count Secrets
	wg.Add(1)
	go func() {
		defer wg.Done()
		if secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"secrets", len(secrets.Items)}
		}
	}()
	
	// Count PVCs
	wg.Add(1)
	go func() {
		defer wg.Done()
		if pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"pvcs", len(pvcs.Items)}
		}
	}()
	
	// Count Ingresses
	wg.Add(1)
	go func() {
		defer wg.Done()
		if ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"ingresses", len(ingresses.Items)}
		}
	}()
	
	// Count NetworkPolicies
	wg.Add(1)
	go func() {
		defer wg.Done()
		if networkPolicies, err := clientset.NetworkingV1().NetworkPolicies(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"networkPolicies", len(networkPolicies.Items)}
		}
	}()
	
	// Count ServiceAccounts
	wg.Add(1)
	go func() {
		defer wg.Done()
		if serviceAccounts, err := clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"serviceAccounts", len(serviceAccounts.Items)}
		}
	}()
	
	// Count Roles
	wg.Add(1)
	go func() {
		defer wg.Done()
		if roles, err := clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"roles", len(roles.Items)}
		}
	}()
	
	// Count RoleBindings
	wg.Add(1)
	go func() {
		defer wg.Done()
		if roleBindings, err := clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{}); err == nil {
			results <- result{"roleBindings", len(roleBindings.Items)}
		}
	}()
	
	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()
	
	// Collect results
	for r := range results {
		switch r.field {
		case "pods":
			resources.Pods = r.count
		case "services":
			resources.Services = r.count
		case "deployments":
			resources.Deployments = r.count
		case "statefulSets":
			resources.StatefulSets = r.count
		case "daemonSets":
			resources.DaemonSets = r.count
		case "replicaSets":
			resources.ReplicaSets = r.count
		case "jobs":
			resources.Jobs = r.count
		case "cronJobs":
			resources.CronJobs = r.count
		case "configMaps":
			resources.ConfigMaps = r.count
		case "secrets":
			resources.Secrets = r.count
		case "pvcs":
			resources.PVCs = r.count
		case "ingresses":
			resources.Ingresses = r.count
		case "networkPolicies":
			resources.NetworkPolicies = r.count
		case "serviceAccounts":
			resources.ServiceAccounts = r.count
		case "roles":
			resources.Roles = r.count
		case "roleBindings":
			resources.RoleBindings = r.count
		}
	}
	
	// Calculate total
	total := resources.Pods + resources.Services + resources.Deployments + 
			resources.StatefulSets + resources.DaemonSets + resources.ReplicaSets +
			resources.Jobs + resources.CronJobs + resources.ConfigMaps + 
			resources.Secrets + resources.PVCs + resources.Ingresses +
			resources.NetworkPolicies + resources.ServiceAccounts + 
			resources.Roles + resources.RoleBindings
	
	response := NamespaceResources{
		Namespace: namespace,
		Cluster:   contextName,
		Resources: resources,
		Total:     total,
	}
	
	c.JSON(http.StatusOK, response)
}

// GetAllNamespaceResources returns resource counts for all namespaces in a cluster
func GetAllNamespaceResources(c *gin.Context) {
	contextName := c.Query("context")
	
	if contextName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}
	
	clientset, err := manager.GetClientset(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}
	
	ctx := context.Background()
	
	// Get all namespaces
	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list namespaces: " + err.Error()})
		return
	}
	
	var allResources []NamespaceResources
	
	for _, ns := range namespaces.Items {
		resources := ResourceCount{}
		
		// Count resources for each namespace (simplified version)
		pods, _ := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})
		resources.Pods = len(pods.Items)
		
		services, _ := clientset.CoreV1().Services(ns.Name).List(ctx, metav1.ListOptions{})
		resources.Services = len(services.Items)
		
		deployments, _ := clientset.AppsV1().Deployments(ns.Name).List(ctx, metav1.ListOptions{})
		resources.Deployments = len(deployments.Items)
		
		configMaps, _ := clientset.CoreV1().ConfigMaps(ns.Name).List(ctx, metav1.ListOptions{})
		resources.ConfigMaps = len(configMaps.Items)
		
		secrets, _ := clientset.CoreV1().Secrets(ns.Name).List(ctx, metav1.ListOptions{})
		resources.Secrets = len(secrets.Items)
		
		// Calculate total (simplified)
		total := resources.Pods + resources.Services + resources.Deployments + 
				resources.ConfigMaps + resources.Secrets
		
		allResources = append(allResources, NamespaceResources{
			Namespace: ns.Name,
			Cluster:   contextName,
			Resources: resources,
			Total:     total,
		})
	}
	
	c.JSON(http.StatusOK, gin.H{
		"namespaces": allResources,
		"total":      len(allResources),
	})
}

// GetNamespaceDetails returns labels, annotations, and YAML for a namespace
func GetNamespaceDetails(c *gin.Context) {
	contextName := c.Query("context")
	namespaceName := c.Param("namespace")
	
	if contextName == "" || namespaceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and namespace are required"})
		return
	}
	
	clientset, err := manager.GetClientset(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}
	
	ctx := context.Background()
	
	// Get namespace
	namespace, err := clientset.CoreV1().Namespaces().Get(ctx, namespaceName, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Namespace not found: " + err.Error()})
		return
	}
	
	// Set the TypeMeta which includes apiVersion and kind
	namespace.TypeMeta = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Namespace",
	}
	
	// Clean up the namespace object for YAML output
	namespace.ManagedFields = nil
	namespace.ResourceVersion = ""
	namespace.UID = ""
	namespace.SelfLink = ""
	
	// Convert to YAML
	yamlBytes, err := yaml.Marshal(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML: " + err.Error()})
		return
	}
	
	response := gin.H{
		"name":        namespace.Name,
		"labels":      namespace.Labels,
		"annotations": namespace.Annotations,
		"yaml":        string(yamlBytes),
		"status":      namespace.Status.Phase,
		"createdAt":   namespace.CreationTimestamp.Time,
	}
	
	c.JSON(http.StatusOK, response)
}

// GetNamespaceYaml returns only the YAML representation of a namespace
func GetNamespaceYaml(c *gin.Context) {
	contextName := c.Query("context")
	namespaceName := c.Param("namespace")
	
	if contextName == "" || namespaceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and namespace are required"})
		return
	}
	
	clientset, err := manager.GetClientset(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}
	
	ctx := context.Background()
	
	// Get namespace
	namespace, err := clientset.CoreV1().Namespaces().Get(ctx, namespaceName, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Namespace not found: " + err.Error()})
		return
	}
	
	// Set the TypeMeta which includes apiVersion and kind
	namespace.TypeMeta = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Namespace",
	}
	
	// Clean up the namespace object for YAML output
	namespace.ManagedFields = nil
	namespace.ResourceVersion = ""
	namespace.UID = ""
	namespace.SelfLink = ""
	
	// Convert to YAML
	yamlBytes, err := yaml.Marshal(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML: " + err.Error()})
		return
	}
	
	c.String(http.StatusOK, string(yamlBytes))
}