package topology

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8s "k8s.io/client-go/kubernetes"
)

// Handler handles topology-related HTTP requests
type Handler struct {
	manager *kubernetes.ClusterManager
}

// NewHandler creates a new topology handler
func NewHandler(clientset k8s.Interface) *Handler {
	return &Handler{
		manager: nil, // Will be set via NewHandlerWithManager
	}
}

// NewHandlerWithManager creates a new topology handler with cluster manager
func NewHandlerWithManager(manager *kubernetes.ClusterManager) *Handler {
	return &Handler{
		manager: manager,
	}
}

// getClusterClient returns the client for a specific cluster context
func (h *Handler) getClusterClient(context string) (k8s.Interface, error) {
	if h.manager == nil {
		return nil, fmt.Errorf("cluster manager not initialized")
	}
	
	conn, err := h.manager.GetConnection(context)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection for context %s: %w", context, err)
	}
	
	if !conn.Connected {
		return nil, fmt.Errorf("cluster %s is not connected", context)
	}
	
	return conn.ClientSet, nil
}

// GetDeploymentTopology handles GET /api/topology/:context/deployment/:namespace/:name
func (h *Handler) GetDeploymentTopology(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	deploymentName := c.Param("name")
	
	if context == "" || namespace == "" || deploymentName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context, namespace and deployment name are required",
		})
		return
	}
	
	clientset, err := h.getClusterClient(context)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	service := NewService(clientset)
	topology, err := service.GetDeploymentTopology(c.Request.Context(), namespace, deploymentName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, topology)
}

// ListDeployments handles GET /api/topology/:context/deployments
// Query params: namespace (optional)
func (h *Handler) ListDeployments(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Query("namespace")
	
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context is required",
		})
		return
	}
	
	clientset, err := h.getClusterClient(context)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	service := NewService(clientset)
	deployments, err := service.ListDeployments(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
	})
}

// ListNamespaces handles GET /api/topology/:context/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	context := c.Param("context")
	
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context is required",
		})
		return
	}
	
	clientset, err := h.getClusterClient(context)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	namespaces, err := clientset.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	var namespaceList []string
	for _, ns := range namespaces.Items {
		namespaceList = append(namespaceList, ns.Name)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"namespaces": namespaceList,
	})
}

// GetDaemonSetTopology handles GET /api/topology/:context/daemonset/:namespace/:name
func (h *Handler) GetDaemonSetTopology(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	daemonsetName := c.Param("name")
	
	if context == "" || namespace == "" || daemonsetName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context, namespace and daemonset name are required",
		})
		return
	}
	
	clientset, err := h.getClusterClient(context)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	service := NewService(clientset)
	topology, err := service.GetDaemonSetTopology(c.Request.Context(), namespace, daemonsetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, topology)
}

// ListDaemonSets handles GET /api/topology/:context/daemonsets
// Query params: namespace (optional)
func (h *Handler) ListDaemonSets(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Query("namespace")
	
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context is required",
		})
		return
	}
	
	clientset, err := h.getClusterClient(context)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	service := NewService(clientset)
	daemonsets, err := service.ListDaemonSets(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"daemonsets": daemonsets.DaemonSets,
	})
}

// GetJobTopology handles GET /api/topology/:context/job/:namespace/:name
func (h *Handler) GetJobTopology(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	jobName := c.Param("name")
	
	if contextName == "" || namespace == "" || jobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context, namespace and job name are required",
		})
		return
	}
	
	// Use JobService instead of generic Service
	jobService := NewJobService(h.manager)
	topology, err := jobService.GetJobTopology(c.Request.Context(), contextName, namespace, jobName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, topology)
}

// ListJobs handles GET /api/topology/:context/jobs
// Query params: namespace (optional)
func (h *Handler) ListJobs(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Query("namespace")
	
	if contextName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context is required",
		})
		return
	}
	
	// Use JobService instead of generic Service
	jobService := NewJobService(h.manager)
	jobs, err := jobService.ListJobs(c.Request.Context(), contextName, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"jobs": jobs,
	})
}