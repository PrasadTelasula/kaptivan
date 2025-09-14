package pods

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

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
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")

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
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")
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
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")

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

// Describe handles getting the kubectl describe output for a pod
func Describe(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if context == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and name are required"})
		return
	}

	if namespace == "" {
		namespace = "default"
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Get the pod details
	pod, err := conn.ClientSet.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "pod not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build describe-like output
	var output strings.Builder
	output.WriteString(fmt.Sprintf("Name:             %s\n", pod.Name))
	output.WriteString(fmt.Sprintf("Namespace:        %s\n", pod.Namespace))
	output.WriteString(fmt.Sprintf("Priority:         %d\n", func() int32 {
		if pod.Spec.Priority != nil {
			return *pod.Spec.Priority
		}
		return 0
	}()))
	output.WriteString(fmt.Sprintf("Service Account:  %s\n", pod.Spec.ServiceAccountName))
	output.WriteString(fmt.Sprintf("Node:             %s\n", pod.Spec.NodeName))
	output.WriteString(fmt.Sprintf("Start Time:       %s\n", pod.Status.StartTime))

	// Labels
	output.WriteString("Labels:           ")
	first := true
	for k, v := range pod.Labels {
		if !first {
			output.WriteString("                  ")
		}
		output.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		first = false
	}
	if len(pod.Labels) == 0 {
		output.WriteString("<none>\n")
	}

	// Status
	output.WriteString(fmt.Sprintf("Status:           %s\n", pod.Status.Phase))
	output.WriteString(fmt.Sprintf("IP:               %s\n", pod.Status.PodIP))

	// Containers
	output.WriteString("Containers:\n")
	for _, container := range pod.Spec.Containers {
		output.WriteString(fmt.Sprintf("  %s:\n", container.Name))
		output.WriteString(fmt.Sprintf("    Image:          %s\n", container.Image))

		// Container status
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == container.Name {
				output.WriteString(fmt.Sprintf("    Container ID:   %s\n", cs.ContainerID))
				output.WriteString(fmt.Sprintf("    Image ID:       %s\n", cs.ImageID))
				if cs.State.Running != nil {
					output.WriteString(fmt.Sprintf("    State:          Running\n"))
					output.WriteString(fmt.Sprintf("      Started:      %s\n", cs.State.Running.StartedAt))
				} else if cs.State.Waiting != nil {
					output.WriteString(fmt.Sprintf("    State:          Waiting\n"))
					output.WriteString(fmt.Sprintf("      Reason:       %s\n", cs.State.Waiting.Reason))
				} else if cs.State.Terminated != nil {
					output.WriteString(fmt.Sprintf("    State:          Terminated\n"))
					output.WriteString(fmt.Sprintf("      Reason:       %s\n", cs.State.Terminated.Reason))
				}
				output.WriteString(fmt.Sprintf("    Ready:          %v\n", cs.Ready))
				output.WriteString(fmt.Sprintf("    Restart Count:  %d\n", cs.RestartCount))
			}
		}

		// Resources
		if container.Resources.Limits != nil {
			output.WriteString("    Limits:\n")
			if cpu := container.Resources.Limits.Cpu(); cpu != nil {
				output.WriteString(fmt.Sprintf("      cpu:          %s\n", cpu.String()))
			}
			if mem := container.Resources.Limits.Memory(); mem != nil {
				output.WriteString(fmt.Sprintf("      memory:       %s\n", mem.String()))
			}
		}
		if container.Resources.Requests != nil {
			output.WriteString("    Requests:\n")
			if cpu := container.Resources.Requests.Cpu(); cpu != nil {
				output.WriteString(fmt.Sprintf("      cpu:          %s\n", cpu.String()))
			}
			if mem := container.Resources.Requests.Memory(); mem != nil {
				output.WriteString(fmt.Sprintf("      memory:       %s\n", mem.String()))
			}
		}
	}

	// Conditions
	output.WriteString("Conditions:\n")
	output.WriteString("  Type              Status\n")
	for _, cond := range pod.Status.Conditions {
		output.WriteString(fmt.Sprintf("  %-16s  %s\n", cond.Type, cond.Status))
	}

	// Events
	events, err := conn.ClientSet.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s", name),
	})
	if err == nil && len(events.Items) > 0 {
		output.WriteString("Events:\n")
		output.WriteString("  Type    Reason     Age   From               Message\n")
		output.WriteString("  ----    ------     ----  ----               -------\n")
		for _, event := range events.Items {
			age := time.Since(event.FirstTimestamp.Time).Round(time.Second)
			output.WriteString(fmt.Sprintf("  %-7s %-10s %-5s %-18s %s\n",
				event.Type,
				event.Reason,
				age,
				event.Source.Component,
				event.Message,
			))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"output": output.String(),
	})
}

// Delete handles deleting a pod
func Delete(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")

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
	context := c.Query("context")
	namespace := c.Query("namespace")
	name := c.Query("name")
	
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

// BatchGet handles getting multiple pod details in a single request
func BatchGet(c *gin.Context) {
	var req BatchGetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Pods) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one pod identifier is required"})
		return
	}

	// Limit the number of pods that can be requested in a single batch to prevent abuse
	const maxBatchSize = 100
	if len(req.Pods) > maxBatchSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("batch size cannot exceed %d pods", maxBatchSize)})
		return
	}

	response := BatchGetResponse{
		Pods:   make([]PodDetail, 0, len(req.Pods)),
		Errors: make([]PodError, 0),
	}

	// Process each pod identifier
	for _, podID := range req.Pods {
		conn, err := clusterManager.GetConnection(podID.Context)
		if err != nil || conn == nil {
			response.Errors = append(response.Errors, PodError{
				Context:   podID.Context,
				Namespace: podID.Namespace,
				Name:      podID.Name,
				Error:     "cluster not connected",
			})
			continue
		}

		pod, err := conn.ClientSet.CoreV1().Pods(podID.Namespace).Get(c.Request.Context(), podID.Name, metav1.GetOptions{})
		if err != nil {
			response.Errors = append(response.Errors, PodError{
				Context:   podID.Context,
				Namespace: podID.Namespace,
				Name:      podID.Name,
				Error:     err.Error(),
			})
			continue
		}

		// Transform the pod to detailed format
		detailedPod := TransformPodDetailed(pod)
		response.Pods = append(response.Pods, detailedPod)
	}

	c.JSON(http.StatusOK, response)
}

// ListDetailed handles listing pods with full detailed information
func ListDetailed(c *gin.Context) {
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

	// Transform all pods to detailed format
	detailedPods := make([]PodDetail, 0, len(pods.Items))
	for _, pod := range pods.Items {
		detailedPod := TransformPodDetailed(&pod)
		detailedPods = append(detailedPods, detailedPod)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"items": detailedPods,
		"total": len(detailedPods),
	})
}