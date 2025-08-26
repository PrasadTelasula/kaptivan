package pods

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets the cluster manager for pod handlers
func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

// ListRequest represents a request to list pods
type ListRequest struct {
	Context   string `json:"context" binding:"required"`
	Namespace string `json:"namespace"`
}

// GetRequest represents a request to get a specific pod
type GetRequest struct {
	Context   string `uri:"context" binding:"required"`
	Namespace string `uri:"namespace" binding:"required"`
	Name      string `uri:"name" binding:"required"`
}

// List handles listing pods
func List(c *gin.Context) {
	var req ListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := clusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	namespace := req.Namespace
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	pods, err := conn.ClientSet.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	podList := TransformPodList(pods)
	
	c.JSON(http.StatusOK, gin.H{
		"items": podList,
		"total": len(podList),
	})
}

// Get handles getting a specific pod with full details
func Get(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	pod, err := conn.ClientSet.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Transform the pod to include all detailed information
	detailedPod := TransformPodDetailed(pod)
	
	c.JSON(http.StatusOK, detailedPod)
}

// GetLogs handles getting pod logs
func GetLogs(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	lines := c.DefaultQuery("lines", "100")
	previous := c.DefaultQuery("previous", "false") == "true"

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Parse lines
	var tailLines int64 = 100
	fmt.Sscanf(lines, "%d", &tailLines)

	podLogOptions := &corev1.PodLogOptions{
		Container: container,
		TailLines: &tailLines,
		Previous:  previous,
	}

	req := conn.ClientSet.CoreV1().Pods(namespace).GetLogs(name, podLogOptions)
	logs, err := req.Stream(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer logs.Close()

	// Read logs
	buf := make([]byte, 1024*1024) // 1MB buffer
	n, err := logs.Read(buf)
	if err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs": string(buf[:n]),
		"container": container,
		"lines": tailLines,
	})
}

// GetEvents handles getting pod events
func GetEvents(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Get events for the pod
	fieldSelector := fmt.Sprintf("involvedObject.name=%s,involvedObject.namespace=%s", name, namespace)
	events, err := conn.ClientSet.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fieldSelector,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	eventList := TransformEventList(events)
	
	c.JSON(http.StatusOK, gin.H{
		"events": eventList,
		"total": len(eventList),
	})
}

// Delete handles deleting a pod
func Delete(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	err = conn.ClientSet.CoreV1().Pods(namespace).Delete(c.Request.Context(), name, metav1.DeleteOptions{})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "pod not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Pod %s/%s deleted successfully", namespace, name),
	})
}

// Exec handles executing commands in a pod
func Exec(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")
	
	var req struct {
		Container string   `json:"container"`
		Command   []string `json:"command" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	// TODO: Implement pod exec using k8s.io/client-go/tools/remotecommand
	// This requires WebSocket support for interactive exec

	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "Pod exec is not yet implemented",
		"message": "This feature requires WebSocket support",
	})
}