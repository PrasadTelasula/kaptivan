package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
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
	CPU         string            `json:"cpu"`
	Memory      string            `json:"memory"`
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

type NodeResources struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
	Pods   string `json:"pods"`
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
	Capacity          *NodeResources    `json:"capacity,omitempty"`
	Allocatable       *NodeResources    `json:"allocatable,omitempty"`
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

		// Calculate total CPU and memory requests/limits
		var cpuRequestSum, cpuLimitSum, memRequestSum, memLimitSum int64

		for _, container := range pod.Spec.Containers {
			containerNames = append(containerNames, container.Name)

			// Sum requests
			if container.Resources.Requests != nil {
				if cpu := container.Resources.Requests.Cpu(); cpu != nil {
					cpuRequestSum += cpu.MilliValue()
				}
				if mem := container.Resources.Requests.Memory(); mem != nil {
					memRequestSum += mem.Value()
				}
			}
			// Sum limits
			if container.Resources.Limits != nil {
				if cpu := container.Resources.Limits.Cpu(); cpu != nil {
					cpuLimitSum += cpu.MilliValue()
				}
				if mem := container.Resources.Limits.Memory(); mem != nil {
					memLimitSum += mem.Value()
				}
			}
		}

		for _, containerStatus := range pod.Status.ContainerStatuses {
			totalRestarts += containerStatus.RestartCount
			if containerStatus.Ready {
				readyContainers++
			}
		}

		// Format CPU in requests/limits format
		var totalCPU string
		if cpuRequestSum > 0 || cpuLimitSum > 0 {
			requestStr := "0"
			limitStr := "-"
			if cpuRequestSum > 0 {
				requestStr = fmt.Sprintf("%dm", cpuRequestSum)
			}
			if cpuLimitSum > 0 {
				limitStr = fmt.Sprintf("%dm", cpuLimitSum)
			}
			totalCPU = fmt.Sprintf("%s/%s", requestStr, limitStr)
		} else {
			totalCPU = "-/-"
		}

		// Format memory in requests/limits format
		var totalMemory string
		if memRequestSum > 0 || memLimitSum > 0 {
			requestStr := "0"
			limitStr := "-"
			if memRequestSum > 0 {
				requestStr = fmt.Sprintf("%dMi", memRequestSum/(1024*1024))
			}
			if memLimitSum > 0 {
				limitStr = fmt.Sprintf("%dMi", memLimitSum/(1024*1024))
			}
			totalMemory = fmt.Sprintf("%s/%s", requestStr, limitStr)
		} else {
			totalMemory = "-/-"
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
			CPU:        totalCPU,
			Memory:     totalMemory,
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

		// Add capacity if available
		if node.Status.Capacity != nil {
			nodeInfo.Capacity = &NodeResources{
				CPU:    node.Status.Capacity.Cpu().String(),
				Memory: node.Status.Capacity.Memory().String(),
				Pods:   node.Status.Capacity.Pods().String(),
			}
		}

		// Add allocatable if available
		if node.Status.Allocatable != nil {
			nodeInfo.Allocatable = &NodeResources{
				CPU:    node.Status.Allocatable.Cpu().String(),
				Memory: node.Status.Allocatable.Memory().String(),
				Pods:   node.Status.Allocatable.Pods().String(),
			}
		}
		nodeList = append(nodeList, nodeInfo)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": nodeList,
		"total": len(nodeList),
	})
}

// DescribeNode handles getting the kubectl describe output for a node
func DescribeNode(c *gin.Context) {
	context := c.Query("context")
	name := c.Query("name")

	if context == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and name are required"})
		return
	}

	conn, err := resourceClusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Get the node details
	node, err := conn.ClientSet.CoreV1().Nodes().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "node not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build describe-like output
	var output strings.Builder
	output.WriteString(fmt.Sprintf("Name:               %s\n", node.Name))

	// Roles
	var roles []string
	for label := range node.Labels {
		if strings.HasPrefix(label, "node-role.kubernetes.io/") {
			role := strings.TrimPrefix(label, "node-role.kubernetes.io/")
			if role != "" {
				roles = append(roles, role)
			}
		}
	}
	if len(roles) > 0 {
		output.WriteString(fmt.Sprintf("Roles:              %s\n", strings.Join(roles, ",")))
	} else {
		output.WriteString("Roles:              <none>\n")
	}

	// Labels
	output.WriteString("Labels:             ")
	first := true
	for k, v := range node.Labels {
		if !first {
			output.WriteString("                    ")
		}
		output.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		first = false
	}
	if len(node.Labels) == 0 {
		output.WriteString("<none>\n")
	}

	// Annotations
	output.WriteString("Annotations:        ")
	first = true
	for k, v := range node.Annotations {
		if !first {
			output.WriteString("                    ")
		}
		// Truncate long annotation values
		if len(v) > 50 {
			v = v[:47] + "..."
		}
		output.WriteString(fmt.Sprintf("%s: %s\n", k, v))
		first = false
	}
	if len(node.Annotations) == 0 {
		output.WriteString("<none>\n")
	}

	output.WriteString(fmt.Sprintf("CreationTimestamp:  %s\n", node.CreationTimestamp))

	// Taints
	output.WriteString("Taints:             ")
	if len(node.Spec.Taints) > 0 {
		for i, taint := range node.Spec.Taints {
			if i > 0 {
				output.WriteString("                    ")
			}
			output.WriteString(fmt.Sprintf("%s=%s:%s\n", taint.Key, taint.Value, taint.Effect))
		}
	} else {
		output.WriteString("<none>\n")
	}

	output.WriteString(fmt.Sprintf("Unschedulable:      %v\n", node.Spec.Unschedulable))

	// Conditions
	output.WriteString("Conditions:\n")
	output.WriteString("  Type                 Status  LastHeartbeatTime                 LastTransitionTime                Reason                       Message\n")
	output.WriteString("  ----                 ------  -----------------                 ------------------                ------                       -------\n")
	for _, cond := range node.Status.Conditions {
		output.WriteString(fmt.Sprintf("  %-20s %-7s %-33s %-33s %-28s %s\n",
			cond.Type,
			cond.Status,
			cond.LastHeartbeatTime.Format(time.RFC3339),
			cond.LastTransitionTime.Format(time.RFC3339),
			cond.Reason,
			cond.Message,
		))
	}

	// Addresses
	output.WriteString("Addresses:\n")
	for _, addr := range node.Status.Addresses {
		output.WriteString(fmt.Sprintf("  %s:  %s\n", addr.Type, addr.Address))
	}

	// Capacity
	if node.Status.Capacity != nil {
		output.WriteString("Capacity:\n")
		output.WriteString(fmt.Sprintf("  cpu:                %s\n", node.Status.Capacity.Cpu().String()))
		output.WriteString(fmt.Sprintf("  memory:             %s\n", node.Status.Capacity.Memory().String()))
		output.WriteString(fmt.Sprintf("  pods:               %s\n", node.Status.Capacity.Pods().String()))
		if storage, ok := node.Status.Capacity["ephemeral-storage"]; ok {
			output.WriteString(fmt.Sprintf("  ephemeral-storage:  %s\n", storage.String()))
		}
	}

	// Allocatable
	if node.Status.Allocatable != nil {
		output.WriteString("Allocatable:\n")
		output.WriteString(fmt.Sprintf("  cpu:                %s\n", node.Status.Allocatable.Cpu().String()))
		output.WriteString(fmt.Sprintf("  memory:             %s\n", node.Status.Allocatable.Memory().String()))
		output.WriteString(fmt.Sprintf("  pods:               %s\n", node.Status.Allocatable.Pods().String()))
		if storage, ok := node.Status.Allocatable["ephemeral-storage"]; ok {
			output.WriteString(fmt.Sprintf("  ephemeral-storage:  %s\n", storage.String()))
		}
	}

	// System Info
	output.WriteString("System Info:\n")
	output.WriteString(fmt.Sprintf("  Machine ID:                 %s\n", node.Status.NodeInfo.MachineID))
	output.WriteString(fmt.Sprintf("  System UUID:                %s\n", node.Status.NodeInfo.SystemUUID))
	output.WriteString(fmt.Sprintf("  Boot ID:                    %s\n", node.Status.NodeInfo.BootID))
	output.WriteString(fmt.Sprintf("  Kernel Version:             %s\n", node.Status.NodeInfo.KernelVersion))
	output.WriteString(fmt.Sprintf("  OS Image:                   %s\n", node.Status.NodeInfo.OSImage))
	output.WriteString(fmt.Sprintf("  Operating System:           %s\n", node.Status.NodeInfo.OperatingSystem))
	output.WriteString(fmt.Sprintf("  Architecture:               %s\n", node.Status.NodeInfo.Architecture))
	output.WriteString(fmt.Sprintf("  Container Runtime Version:  %s\n", node.Status.NodeInfo.ContainerRuntimeVersion))
	output.WriteString(fmt.Sprintf("  Kubelet Version:            %s\n", node.Status.NodeInfo.KubeletVersion))
	output.WriteString(fmt.Sprintf("  Kube-Proxy Version:         %s\n", node.Status.NodeInfo.KubeProxyVersion))

	// PodCIDR
	if node.Spec.PodCIDR != "" {
		output.WriteString(fmt.Sprintf("PodCIDR:                      %s\n", node.Spec.PodCIDR))
	}
	if len(node.Spec.PodCIDRs) > 0 {
		output.WriteString(fmt.Sprintf("PodCIDRs:                     %s\n", strings.Join(node.Spec.PodCIDRs, ",")))
	}

	// Get pods running on this node
	pods, err := conn.ClientSet.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
	})

	if err == nil && len(pods.Items) > 0 {
		output.WriteString(fmt.Sprintf("Non-terminated Pods:          (%d in total)\n", len(pods.Items)))
		output.WriteString("  Namespace                   Name                                     CPU Requests  CPU Limits  Memory Requests  Memory Limits  Age\n")
		output.WriteString("  ---------                   ----                                     ------------  ----------  ---------------  -------------  ---\n")

		// Show first 10 pods
		maxPods := 10
		if len(pods.Items) < maxPods {
			maxPods = len(pods.Items)
		}

		for i := 0; i < maxPods; i++ {
			pod := pods.Items[i]
			var cpuReq, cpuLim, memReq, memLim string

			for _, container := range pod.Spec.Containers {
				if container.Resources.Requests != nil {
					if cpu := container.Resources.Requests.Cpu(); cpu != nil && !cpu.IsZero() {
						cpuReq = cpu.String()
					}
					if mem := container.Resources.Requests.Memory(); mem != nil && !mem.IsZero() {
						memReq = mem.String()
					}
				}
				if container.Resources.Limits != nil {
					if cpu := container.Resources.Limits.Cpu(); cpu != nil && !cpu.IsZero() {
						cpuLim = cpu.String()
					}
					if mem := container.Resources.Limits.Memory(); mem != nil && !mem.IsZero() {
						memLim = mem.String()
					}
				}
			}

			if cpuReq == "" {
				cpuReq = "0"
			}
			if cpuLim == "" {
				cpuLim = "0"
			}
			if memReq == "" {
				memReq = "0"
			}
			if memLim == "" {
				memLim = "0"
			}

			age := time.Since(pod.CreationTimestamp.Time).Round(time.Second)
			output.WriteString(fmt.Sprintf("  %-27s %-40s %-13s %-11s %-16s %-14s %s\n",
				pod.Namespace,
				pod.Name,
				cpuReq,
				cpuLim,
				memReq,
				memLim,
				age,
			))
		}

		if len(pods.Items) > maxPods {
			output.WriteString(fmt.Sprintf("  ... and %d more pods\n", len(pods.Items)-maxPods))
		}
	}

	// Events
	events, err := conn.ClientSet.CoreV1().Events("").List(c, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Node", name),
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
	} else {
		output.WriteString("Events:              <none>\n")
	}

	c.JSON(http.StatusOK, gin.H{
		"output": output.String(),
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