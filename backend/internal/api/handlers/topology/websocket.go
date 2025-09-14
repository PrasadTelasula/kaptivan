package topology

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

type ResourceChange struct {
	Type         string      `json:"type"`         // added, modified, deleted
	ResourceType string      `json:"resourceType"` // deployment, pod, service, etc.
	ResourceID   string      `json:"resourceId"`
	Namespace    string      `json:"namespace"`
	Data         interface{} `json:"data,omitempty"`
	Timestamp    string      `json:"timestamp"`
}

type TopologyUpdate struct {
	Changes   []ResourceChange `json:"changes"`
	Timestamp string           `json:"timestamp"`
}

type SubscriptionMessage struct {
	Type       string `json:"type"`
	Namespace  string `json:"namespace"`
	Deployment string `json:"deployment,omitempty"`
	DaemonSet  string `json:"daemonset,omitempty"`
	Job        string `json:"job,omitempty"`
}

// HandleTopologyWebSocket handles WebSocket connections for real-time topology updates
func HandleTopologyWebSocket(clientset kubernetes.Interface) gin.HandlerFunc {
	return func(c *gin.Context) {
		clusterContext := c.Query("context")
		namespace := c.Query("namespace")
		deployment := c.Query("deployment")
		daemonset := c.Query("daemonset")
		job := c.Query("job")

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("Failed to upgrade connection: %v", err)
			return
		}
		defer conn.Close()

		log.Printf("WebSocket connected for topology updates: context=%s, namespace=%s, deployment=%s, daemonset=%s, job=%s", 
			clusterContext, namespace, deployment, daemonset, job)

		// Create context for cancellation
		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		// Channel for sending updates to client
		updates := make(chan TopologyUpdate, 10)

		// Send initial pods first
		go sendInitialPods(ctx, clientset, namespace, deployment, updates)

		// Start watchers based on resource type
		if job != "" {
			// Watch Jobs and their pods
			go watchJobs(ctx, clientset, namespace, job, updates)
			go watchPods(ctx, clientset, namespace, "", updates) // Watch all pods in namespace for job
		} else if daemonset != "" {
			// Watch DaemonSets and their pods
			go watchDaemonSets(ctx, clientset, namespace, daemonset, updates)
			go watchPods(ctx, clientset, namespace, "", updates) // Watch all pods in namespace for daemonset
		} else {
			// Watch Deployments and related resources
			go watchDeployments(ctx, clientset, namespace, updates)
			go watchPods(ctx, clientset, namespace, deployment, updates)
			go watchReplicaSets(ctx, clientset, namespace, updates)
		}
		
		// Common watchers for all resource types
		go watchServices(ctx, clientset, namespace, updates)
		go watchEndpoints(ctx, clientset, namespace, updates)
		
		// Start metrics collection for pods (CPU/Memory updates)
		go collectPodMetrics(ctx, clientset, namespace, updates)

		// Handle incoming messages from client
		go func() {
			for {
				var msg SubscriptionMessage
				err := conn.ReadJSON(&msg)
				if err != nil {
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
						log.Printf("WebSocket error: %v", err)
					}
					cancel()
					return
				}

				// Handle different message types
				switch msg.Type {
				case "refresh":
					// Send a full refresh signal
					log.Printf("Refresh requested for namespace %s", namespace)
				case "subscribe":
					log.Printf("Subscription updated: namespace=%s, deployment=%s", msg.Namespace, msg.Deployment)
				}
			}
		}()

		// Send updates to client
		for {
			select {
			case update := <-updates:
				log.Printf("Sending WebSocket update with %d changes", len(update.Changes))
				if err := conn.WriteJSON(update); err != nil {
					log.Printf("Error sending update: %v", err)
					return
				}
				log.Printf("Successfully sent WebSocket update")
			case <-ctx.Done():
				log.Printf("WebSocket context cancelled")
				return
			}
		}
	}
}

func sendInitialPods(ctx context.Context, clientset kubernetes.Interface, namespace string, deploymentName string, updates chan<- TopologyUpdate) {
	// Create label selector if deployment is specified
	var labelSelector string
	if deploymentName != "" {
		labelSelector = fmt.Sprintf("app=%s", deploymentName)
	}

	log.Printf("Fetching initial pods for namespace: %s, deployment: %s", namespace, deploymentName)

	// List all existing pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	if err != nil {
		log.Printf("Failed to list initial pods: %v", err)
		return
	}

	log.Printf("Found %d existing pods in namespace %s", len(pods.Items), namespace)

	// Send each pod as an ADDED event
	for _, pod := range pods.Items {
		// Extract owner ReplicaSet information
		var ownerReplicaSet string
		for _, owner := range pod.OwnerReferences {
			if owner.Kind == "ReplicaSet" {
				ownerReplicaSet = owner.Name
				break
			}
		}

		// Extract container info with resources
		containers := []map[string]interface{}{}
		for _, container := range pod.Spec.Containers {
			containerInfo := map[string]interface{}{
				"name":  container.Name,
				"image": container.Image,
				"ready": false,
			}

			// Add resource requirements
			if container.Resources.Requests != nil || container.Resources.Limits != nil {
				resources := map[string]interface{}{}
				if container.Resources.Requests != nil {
					requests := map[string]string{}
					if cpu := container.Resources.Requests.Cpu(); cpu != nil {
						requests["cpu"] = cpu.String()
					}
					if mem := container.Resources.Requests.Memory(); mem != nil {
						requests["memory"] = mem.String()
					}
					resources["requests"] = requests
				}
				if container.Resources.Limits != nil {
					limits := map[string]string{}
					if cpu := container.Resources.Limits.Cpu(); cpu != nil {
						limits["cpu"] = cpu.String()
					}
					if mem := container.Resources.Limits.Memory(); mem != nil {
						limits["memory"] = mem.String()
					}
					resources["limits"] = limits
				}
				containerInfo["resources"] = resources
			}

			// Check container status
			for _, status := range pod.Status.ContainerStatuses {
				if status.Name == container.Name {
					containerInfo["ready"] = status.Ready
					containerInfo["restartCount"] = status.RestartCount
					if status.State.Running != nil {
						containerInfo["state"] = "running"
						containerInfo["startTime"] = status.State.Running.StartedAt.Time
					} else if status.State.Waiting != nil {
						containerInfo["state"] = "waiting"
					} else if status.State.Terminated != nil {
						containerInfo["state"] = "terminated"
						containerInfo["startTime"] = status.State.Terminated.StartedAt.Time
					}
					break
				}
			}

			containers = append(containers, containerInfo)
		}

		// Calculate pod age
		age := "Unknown"
		if !pod.CreationTimestamp.IsZero() {
			age = time.Since(pod.CreationTimestamp.Time).Round(time.Second).String()
		}

		// Calculate ready state (e.g., "1/1" or "0/1")
		readyContainers := 0
		totalContainers := len(pod.Status.ContainerStatuses)
		for _, status := range pod.Status.ContainerStatuses {
			if status.Ready {
				readyContainers++
			}
		}
		ready := fmt.Sprintf("%d/%d", readyContainers, totalContainers)

		// Get total restart count
		restartCount := int32(0)
		for _, status := range pod.Status.ContainerStatuses {
			restartCount += status.RestartCount
		}

		// Calculate total CPU and memory requests/limits from containers
		var cpuRequestSum, cpuLimitSum, memRequestSum, memLimitSum int64

		for _, container := range pod.Spec.Containers {
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

		change := ResourceChange{
			Type:         "ADDED",
			ResourceType: "pod",
			ResourceID:   pod.Name,
			Namespace:    pod.Namespace,
			Data: map[string]interface{}{
				"name":               pod.Name,
				"namespace":          pod.Namespace,
				"phase":              pod.Status.Phase,
				"podIP":              pod.Status.PodIP,
				"hostIP":             pod.Status.HostIP,
				"nodeName":           pod.Spec.NodeName,
				"containers":         containers,
				"ownerReplicaSet":    ownerReplicaSet,
				"age":                age,
				"ready":              ready,
				"restartCount":       restartCount,
				"cpu":                totalCPU,
				"memory":             totalMemory,
			},
			Timestamp: time.Now().Format(time.RFC3339),
		}

		updates <- TopologyUpdate{
			Changes:   []ResourceChange{change},
			Timestamp: time.Now().Format(time.RFC3339),
		}
	}

	log.Printf("Sent %d initial pods to client", len(pods.Items))
}

func watchDeployments(ctx context.Context, clientset kubernetes.Interface, namespace string, updates chan<- TopologyUpdate) {
	log.Printf("Starting deployment watcher for namespace: %s", namespace)
	watcher, err := clientset.AppsV1().Deployments(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Failed to watch deployments: %v", err)
		return
	}
	defer watcher.Stop()

	log.Printf("Deployment watcher started successfully for namespace: %s", namespace)
	for event := range watcher.ResultChan() {
		log.Printf("Deployment event: %s for %v", event.Type, event.Object)
		if deployment, ok := event.Object.(*appsv1.Deployment); ok {
			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "deployment",
				ResourceID:   deployment.Name,
				Namespace:    deployment.Namespace,
				Data: map[string]interface{}{
					"name":      deployment.Name,
					"namespace": deployment.Namespace,
					"replicas":  deployment.Spec.Replicas,
					"available": deployment.Status.AvailableReplicas,
					"ready":     deployment.Status.ReadyReplicas,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			updates <- TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}
			log.Printf("Sent deployment update to channel: %s", deployment.Name)
		}
	}
	log.Printf("Deployment watcher stopped for namespace: %s", namespace)
}

func watchPods(ctx context.Context, clientset kubernetes.Interface, namespace string, deploymentName string, updates chan<- TopologyUpdate) {
	// Create label selector if deployment is specified
	var labelSelector string
	if deploymentName != "" {
		labelSelector = fmt.Sprintf("app=%s", deploymentName)
	}

	log.Printf("Starting pod watcher for namespace: %s, deployment: %s, selector: %s", namespace, deploymentName, labelSelector)
	watcher, err := clientset.CoreV1().Pods(namespace).Watch(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		log.Printf("Failed to watch pods: %v", err)
		return
	}
	defer watcher.Stop()

	log.Printf("Pod watcher started successfully for namespace: %s", namespace)
	for event := range watcher.ResultChan() {
		log.Printf("Pod event: %s for %v", event.Type, event.Object)
		if pod, ok := event.Object.(*v1.Pod); ok {
			// Extract owner ReplicaSet information
			var ownerReplicaSet string
			for _, owner := range pod.OwnerReferences {
				if owner.Kind == "ReplicaSet" {
					ownerReplicaSet = owner.Name
					break
				}
			}

			// Extract container info with resources
			containers := []map[string]interface{}{}
			for _, container := range pod.Spec.Containers {
				containerInfo := map[string]interface{}{
					"name":  container.Name,
					"image": container.Image,
					"ready": false,
				}

				// Add resource requirements
				if container.Resources.Requests != nil || container.Resources.Limits != nil {
					resources := map[string]interface{}{}
					if container.Resources.Requests != nil {
						requests := map[string]string{}
						if cpu := container.Resources.Requests.Cpu(); cpu != nil {
							requests["cpu"] = cpu.String()
						}
						if mem := container.Resources.Requests.Memory(); mem != nil {
							requests["memory"] = mem.String()
						}
						resources["requests"] = requests
					}
					if container.Resources.Limits != nil {
						limits := map[string]string{}
						if cpu := container.Resources.Limits.Cpu(); cpu != nil {
							limits["cpu"] = cpu.String()
						}
						if mem := container.Resources.Limits.Memory(); mem != nil {
							limits["memory"] = mem.String()
						}
						resources["limits"] = limits
					}
					containerInfo["resources"] = resources
				}

				// Check container status
				for _, status := range pod.Status.ContainerStatuses {
					if status.Name == container.Name {
						containerInfo["ready"] = status.Ready
						containerInfo["restartCount"] = status.RestartCount
						if status.State.Running != nil {
							containerInfo["state"] = "running"
							containerInfo["startTime"] = status.State.Running.StartedAt.Time
						} else if status.State.Waiting != nil {
							containerInfo["state"] = "waiting"
						} else if status.State.Terminated != nil {
							containerInfo["state"] = "terminated"
							containerInfo["startTime"] = status.State.Terminated.StartedAt.Time
						}
						break
					}
				}

				containers = append(containers, containerInfo)
			}

			// Calculate pod age
			age := "Unknown"
			if !pod.CreationTimestamp.IsZero() {
				age = time.Since(pod.CreationTimestamp.Time).Round(time.Second).String()
			}

			// Calculate ready state (e.g., "1/1" or "0/1")
			readyContainers := 0
			totalContainers := len(pod.Status.ContainerStatuses)
			for _, status := range pod.Status.ContainerStatuses {
				if status.Ready {
					readyContainers++
				}
			}
			ready := fmt.Sprintf("%d/%d", readyContainers, totalContainers)

			// Get total restart count
			restartCount := int32(0)
			for _, status := range pod.Status.ContainerStatuses {
				restartCount += status.RestartCount
			}

			// Calculate total CPU and memory requests/limits from containers
			var cpuRequestSum, cpuLimitSum, memRequestSum, memLimitSum int64

			for _, container := range pod.Spec.Containers {
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

			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "pod",
				ResourceID:   pod.Name,
				Namespace:    pod.Namespace, // Use pod's actual namespace, not the parameter
				Data: map[string]interface{}{
					"name":               pod.Name,
					"namespace":          pod.Namespace, // Also include namespace in data
					"phase":              pod.Status.Phase,
					"podIP":              pod.Status.PodIP,
					"hostIP":             pod.Status.HostIP,
					"nodeName":           pod.Spec.NodeName,
					"containers":         containers,
					"ownerReplicaSet":    ownerReplicaSet, // Include owner ReplicaSet information
					"age":                age,
					"ready":              ready,
					"restartCount":       restartCount,
					"cpu":                totalCPU,
					"memory":             totalMemory,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			updates <- TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}
			// Debug: log container resources
			for _, c := range containers {
				if resources, ok := c["resources"].(map[string]interface{}); ok {
					log.Printf("  Container %s resources: %+v", c["name"], resources)
				}
			}
			log.Printf("Sent pod update to channel: %s (type: %s, owner: %s)", pod.Name, event.Type, ownerReplicaSet)
		}
	}
	log.Printf("Pod watcher stopped for namespace: %s", namespace)
}

func watchServices(ctx context.Context, clientset kubernetes.Interface, namespace string, updates chan<- TopologyUpdate) {
	watcher, err := clientset.CoreV1().Services(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Failed to watch services: %v", err)
		return
	}
	defer watcher.Stop()

	for event := range watcher.ResultChan() {
		if service, ok := event.Object.(*v1.Service); ok {
			ports := []map[string]interface{}{}
			for _, port := range service.Spec.Ports {
				ports = append(ports, map[string]interface{}{
					"port":       port.Port,
					"targetPort": port.TargetPort.IntVal,
					"protocol":   port.Protocol,
				})
			}

			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "service",
				ResourceID:   service.Name,
				Namespace:    service.Namespace,
				Data: map[string]interface{}{
					"name":      service.Name,
					"namespace": service.Namespace,
					"type":      service.Spec.Type,
					"clusterIP": service.Spec.ClusterIP,
					"ports":     ports,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			updates <- TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}
		}
	}
}

func watchEndpoints(ctx context.Context, clientset kubernetes.Interface, namespace string, updates chan<- TopologyUpdate) {
	watcher, err := clientset.CoreV1().Endpoints(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Failed to watch endpoints: %v", err)
		return
	}
	defer watcher.Stop()

	for event := range watcher.ResultChan() {
		if endpoints, ok := event.Object.(*v1.Endpoints); ok {
			addresses := []string{}
			for _, subset := range endpoints.Subsets {
				for _, addr := range subset.Addresses {
					addresses = append(addresses, addr.IP)
				}
			}

			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "endpoints",
				ResourceID:   endpoints.Name,
				Namespace:    endpoints.Namespace,
				Data: map[string]interface{}{
					"name":      endpoints.Name,
					"namespace": endpoints.Namespace,
					"addresses": addresses,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			updates <- TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}
		}
	}
}

func watchReplicaSets(ctx context.Context, clientset kubernetes.Interface, namespace string, updates chan<- TopologyUpdate) {
	watcher, err := clientset.AppsV1().ReplicaSets(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Failed to watch replicasets: %v", err)
		return
	}
	defer watcher.Stop()

	for event := range watcher.ResultChan() {
		if rs, ok := event.Object.(*appsv1.ReplicaSet); ok {
			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "replicaset",
				ResourceID:   rs.Name,
				Namespace:    rs.Namespace,
				Data: map[string]interface{}{
					"name":      rs.Name,
					"namespace": rs.Namespace,
					"replicas": rs.Spec.Replicas,
					"ready":    rs.Status.ReadyReplicas,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			updates <- TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}
		}
	}
}

// collectPodMetrics periodically collects CPU and memory metrics for pods
func collectPodMetrics(ctx context.Context, clientset kubernetes.Interface, namespace string, updates chan<- TopologyUpdate) {
	ticker := time.NewTicker(10 * time.Second) // Update metrics every 10 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Get pod metrics from metrics server
			// This requires the metrics-server to be installed in the cluster
			// For now, we'll send a placeholder update
			// In production, you'd use the metrics client to get actual CPU/memory usage
			
		case <-ctx.Done():
			return
		}
	}
}
// watchJobs watches for changes to Jobs in the namespace
func watchJobs(ctx context.Context, clientset kubernetes.Interface, namespace, jobName string, updates chan<- TopologyUpdate) {
	log.Printf("Starting job watcher for namespace: %s, job: %s", namespace, jobName)
	
	listOptions := metav1.ListOptions{}
	if jobName != "" {
		listOptions.FieldSelector = fmt.Sprintf("metadata.name=%s", jobName)
	}
	
	watcher, err := clientset.BatchV1().Jobs(namespace).Watch(ctx, listOptions)
	if err != nil {
		log.Printf("Failed to watch jobs: %v", err)
		return
	}
	defer watcher.Stop()

	log.Printf("Job watcher started successfully for namespace: %s", namespace)
	
	for event := range watcher.ResultChan() {
		if job, ok := event.Object.(*batchv1.Job); ok {
			log.Printf("Job event: %s for %s", event.Type, job.Name)
			
			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "job",
				ResourceID:   job.Name,
				Namespace:    job.Namespace,
				Data: map[string]interface{}{
					"name":        job.Name,
					"namespace":   job.Namespace,
					"completions": job.Spec.Completions,
					"parallelism": job.Spec.Parallelism,
					"active":      job.Status.Active,
					"succeeded":   job.Status.Succeeded,
					"failed":      job.Status.Failed,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			update := TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			log.Printf("Sending WebSocket update with %d changes", len(update.Changes))
			select {
			case updates <- update:
				log.Printf("Successfully sent WebSocket update")
			case <-ctx.Done():
				return
			}
		}
	}
	
	log.Printf("Job watcher stopped for namespace: %s", namespace)
}

// watchDaemonSets watches for changes to DaemonSets in the namespace
func watchDaemonSets(ctx context.Context, clientset kubernetes.Interface, namespace, daemonsetName string, updates chan<- TopologyUpdate) {
	log.Printf("Starting daemonset watcher for namespace: %s, daemonset: %s", namespace, daemonsetName)
	
	listOptions := metav1.ListOptions{}
	if daemonsetName != "" {
		listOptions.FieldSelector = fmt.Sprintf("metadata.name=%s", daemonsetName)
	}
	
	watcher, err := clientset.AppsV1().DaemonSets(namespace).Watch(ctx, listOptions)
	if err != nil {
		log.Printf("Failed to watch daemonsets: %v", err)
		return
	}
	defer watcher.Stop()

	log.Printf("DaemonSet watcher started successfully for namespace: %s", namespace)
	
	for event := range watcher.ResultChan() {
		if ds, ok := event.Object.(*appsv1.DaemonSet); ok {
			log.Printf("DaemonSet event: %s for %s", event.Type, ds.Name)
			
			change := ResourceChange{
				Type:         string(event.Type),
				ResourceType: "daemonset",
				ResourceID:   ds.Name,
				Namespace:    ds.Namespace,
				Data: map[string]interface{}{
					"name":           ds.Name,
					"namespace":      ds.Namespace,
					"desiredNumber":  ds.Status.DesiredNumberScheduled,
					"currentNumber":  ds.Status.CurrentNumberScheduled,
					"readyNumber":    ds.Status.NumberReady,
					"updatedNumber":  ds.Status.UpdatedNumberScheduled,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			update := TopologyUpdate{
				Changes:   []ResourceChange{change},
				Timestamp: time.Now().Format(time.RFC3339),
			}

			log.Printf("Sending WebSocket update with %d changes", len(update.Changes))
			select {
			case updates <- update:
				log.Printf("Successfully sent WebSocket update")
			case <-ctx.Done():
				return
			}
		}
	}
	
	log.Printf("DaemonSet watcher stopped for namespace: %s", namespace)
}
