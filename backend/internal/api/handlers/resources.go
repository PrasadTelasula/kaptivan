package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var resourceClusterManager *kubernetes.ClusterManager

func InitResourceHandlers(manager *kubernetes.ClusterManager) {
	resourceClusterManager = manager
}

type ResourceListRequest struct {
	Context   string `json:"context" binding:"required"`
	Namespace string `json:"namespace"`
}

type PodInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Status      string            `json:"status"`
	Ready       string            `json:"ready"`
	Restarts    int32             `json:"restarts"`
	Age         string            `json:"age"`
	IP          string            `json:"ip"`
	Node        string            `json:"node"`
	Labels      map[string]string `json:"labels"`
	Containers  []string          `json:"containers"`
}

type DeploymentInfo struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	Ready             string            `json:"ready"`
	UpToDate          int32             `json:"upToDate"`
	Available         int32             `json:"available"`
	Age               string            `json:"age"`
	Labels            map[string]string `json:"labels"`
	Selector          map[string]string `json:"selector"`
}

type ServiceInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Type        string            `json:"type"`
	ClusterIP   string            `json:"clusterIP"`
	ExternalIP  string            `json:"externalIP"`
	Ports       []string          `json:"ports"`
	Age         string            `json:"age"`
	Labels      map[string]string `json:"labels"`
	Selector    map[string]string `json:"selector"`
}

type NamespaceInfo struct {
	Name   string            `json:"name"`
	Status string            `json:"status"`
	Age    string            `json:"age"`
	Labels map[string]string `json:"labels"`
}

type NodeInfo struct {
	Name              string            `json:"name"`
	Status            string            `json:"status"`
	Roles             string            `json:"roles"`
	Age               string            `json:"age"`
	Version           string            `json:"version"`
	InternalIP        string            `json:"internalIP"`
	OS                string            `json:"os"`
	KernelVersion     string            `json:"kernelVersion"`
	ContainerRuntime  string            `json:"containerRuntime"`
	Labels            map[string]string `json:"labels"`
}

func ListPods(c *gin.Context) {
	var req ResourceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := resourceClusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	namespace := req.Namespace
	// If namespace is empty, fetch from all namespaces
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	pods, err := conn.ClientSet.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var podList []PodInfo
	for _, pod := range pods.Items {
		var containerNames []string
		var totalRestarts int32
		readyContainers := 0
		totalContainers := len(pod.Spec.Containers)

		for _, container := range pod.Spec.Containers {
			containerNames = append(containerNames, container.Name)
		}

		for _, containerStatus := range pod.Status.ContainerStatuses {
			totalRestarts += containerStatus.RestartCount
			if containerStatus.Ready {
				readyContainers++
			}
		}

		podInfo := PodInfo{
			Name:       pod.Name,
			Namespace:  pod.Namespace,
			Status:     string(pod.Status.Phase),
			Ready:      fmt.Sprintf("%d/%d", readyContainers, totalContainers),
			Restarts:   totalRestarts,
			Age:        formatAge(pod.CreationTimestamp.Time),
			IP:         pod.Status.PodIP,
			Node:       pod.Spec.NodeName,
			Labels:     pod.Labels,
			Containers: containerNames,
		}
		podList = append(podList, podInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": podList,
		"total": len(podList),
	})
}

func GetPod(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and name are required"})
		return
	}

	conn, err := resourceClusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	pod, err := conn.ClientSet.CoreV1().Pods(namespace).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pod)
}

func ListDeployments(c *gin.Context) {
	var req ResourceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := resourceClusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	namespace := req.Namespace
	// If namespace is empty, fetch from all namespaces
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	deployments, err := conn.ClientSet.AppsV1().Deployments(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var deploymentList []DeploymentInfo
	for _, deployment := range deployments.Items {
		deploymentInfo := DeploymentInfo{
			Name:      deployment.Name,
			Namespace: deployment.Namespace,
			Ready:     fmt.Sprintf("%d/%d", deployment.Status.ReadyReplicas, *deployment.Spec.Replicas),
			UpToDate:  deployment.Status.UpdatedReplicas,
			Available: deployment.Status.AvailableReplicas,
			Age:       formatAge(deployment.CreationTimestamp.Time),
			Labels:    deployment.Labels,
			Selector:  deployment.Spec.Selector.MatchLabels,
		}
		deploymentList = append(deploymentList, deploymentInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": deploymentList,
		"total": len(deploymentList),
	})
}

func ListServices(c *gin.Context) {
	var req ResourceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := resourceClusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	namespace := req.Namespace
	// If namespace is empty, fetch from all namespaces
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	services, err := conn.ClientSet.CoreV1().Services(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var serviceList []ServiceInfo
	for _, service := range services.Items {
		var ports []string
		for _, port := range service.Spec.Ports {
			portStr := fmt.Sprintf("%d:%d/%s", port.Port, port.TargetPort.IntVal, port.Protocol)
			ports = append(ports, portStr)
		}

		externalIP := "<none>"
		if len(service.Spec.ExternalIPs) > 0 {
			externalIP = service.Spec.ExternalIPs[0]
		} else if service.Spec.Type == "LoadBalancer" && len(service.Status.LoadBalancer.Ingress) > 0 {
			externalIP = service.Status.LoadBalancer.Ingress[0].IP
		}

		serviceInfo := ServiceInfo{
			Name:       service.Name,
			Namespace:  service.Namespace,
			Type:       string(service.Spec.Type),
			ClusterIP:  service.Spec.ClusterIP,
			ExternalIP: externalIP,
			Ports:      ports,
			Age:        formatAge(service.CreationTimestamp.Time),
			Labels:     service.Labels,
			Selector:   service.Spec.Selector,
		}
		serviceList = append(serviceList, serviceInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": serviceList,
		"total": len(serviceList),
	})
}

func ListNamespaces(c *gin.Context) {
	context := c.Query("context")
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := resourceClusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	namespaces, err := conn.ClientSet.CoreV1().Namespaces().List(c, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var namespaceList []NamespaceInfo
	for _, namespace := range namespaces.Items {
		namespaceInfo := NamespaceInfo{
			Name:   namespace.Name,
			Status: string(namespace.Status.Phase),
			Age:    formatAge(namespace.CreationTimestamp.Time),
			Labels: namespace.Labels,
		}
		namespaceList = append(namespaceList, namespaceInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": namespaceList,
		"total": len(namespaceList),
	})
}

func ListNodes(c *gin.Context) {
	context := c.Query("context")
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := resourceClusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	nodes, err := conn.ClientSet.CoreV1().Nodes().List(c, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeList []NodeInfo
	for _, node := range nodes.Items {
		var roles string
		if _, exists := node.Labels["node-role.kubernetes.io/control-plane"]; exists {
			roles = "control-plane"
		} else if _, exists := node.Labels["node-role.kubernetes.io/master"]; exists {
			roles = "master"
		} else {
			roles = "worker"
		}

		var internalIP string
		for _, addr := range node.Status.Addresses {
			if addr.Type == "InternalIP" {
				internalIP = addr.Address
				break
			}
		}

		status := "NotReady"
		for _, condition := range node.Status.Conditions {
			if condition.Type == "Ready" && condition.Status == "True" {
				status = "Ready"
				break
			}
		}

		nodeInfo := NodeInfo{
			Name:             node.Name,
			Status:           status,
			Roles:            roles,
			Age:              formatAge(node.CreationTimestamp.Time),
			Version:          node.Status.NodeInfo.KubeletVersion,
			InternalIP:       internalIP,
			OS:               node.Status.NodeInfo.OSImage,
			KernelVersion:    node.Status.NodeInfo.KernelVersion,
			ContainerRuntime: node.Status.NodeInfo.ContainerRuntimeVersion,
			Labels:           node.Labels,
		}
		nodeList = append(nodeList, nodeInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": nodeList,
		"total": len(nodeList),
	})
}

// Helper functions
func formatAge(t time.Time) string {
	duration := time.Since(t)
	if duration.Hours() > 24 {
		days := int(duration.Hours() / 24)
		if days > 365 {
			return fmt.Sprintf("%dy", days/365)
		}
		return fmt.Sprintf("%dd", days)
	}
	if duration.Hours() > 1 {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	}
	if duration.Minutes() > 1 {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	}
	return fmt.Sprintf("%ds", int(duration.Seconds()))
}