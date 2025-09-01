package events

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets up the events handlers with the cluster manager
func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

// TimelineEvent represents an event in the timeline
type TimelineEvent struct {
	ID               string    `json:"id"`
	Timestamp        int64     `json:"timestamp"`
	Type             string    `json:"type"`
	ResourceType     string    `json:"resourceType"`
	ResourceName     string    `json:"resourceName"`
	Namespace        string    `json:"namespace"`
	Message          string    `json:"message"`
	Severity         string    `json:"severity"`
	CorrelatedEvents []string  `json:"correlatedEvents,omitempty"`
	Reason           string    `json:"reason,omitempty"`
	Count            int32     `json:"count,omitempty"`
	FirstTimestamp   int64     `json:"firstTimestamp,omitempty"`
	LastTimestamp    int64     `json:"lastTimestamp,omitempty"`
	Source           string    `json:"source,omitempty"`
}

// GetTimelineEvents fetches events for the timeline
func GetTimelineEvents(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")
	resourceName := c.Query("resourceName")
	resourceType := c.Query("resourceType")
	hoursStr := c.DefaultQuery("hours", "1")
	
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	hours, err := strconv.Atoi(hoursStr)
	if err != nil {
		hours = 1
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	clientset := conn.ClientSet
	ctx := c.Request.Context()

	// Calculate time range
	endTime := time.Now()
	startTime := endTime.Add(-time.Duration(hours) * time.Hour)

	// Build field selector - for deployments, we need to get events for related resources too
	fieldSelector := fields.Everything()
	var deploymentName string
	if resourceName != "" && resourceType != "" {
		if resourceType == "Deployment" {
			// For deployments, we'll filter later to include related resources
			deploymentName = resourceName
		} else {
			fieldSelector = fields.ParseSelectorOrDie(fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", resourceName, resourceType))
		}
	}

	// Fetch events
	eventList, err := clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fieldSelector.String(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to fetch events: %v", err)})
		return
	}

	// Convert to timeline events
	timelineEvents := []TimelineEvent{}
	for _, event := range eventList.Items {
		// Filter by time range
		eventTime := event.LastTimestamp.Time
		if event.LastTimestamp.IsZero() {
			eventTime = event.FirstTimestamp.Time
		}
		
		if eventTime.Before(startTime) || eventTime.After(endTime) {
			continue
		}
		
		// Debug logging (remove in production)
		// fmt.Printf("Event: Kind=%s, Name=%s, Reason=%s, Type=%s, Message=%s\n", 
		//	event.InvolvedObject.Kind, event.InvolvedObject.Name, event.Reason, event.Type, event.Message)
		
		// For deployments, include events for related resources
		if deploymentName != "" {
			// Check if this event belongs to the deployment's resources
			// This includes ReplicaSets and Pods that start with the deployment name
			if event.InvolvedObject.Kind == "ReplicaSet" {
				// ReplicaSet name should start with deployment name
				if !strings.HasPrefix(event.InvolvedObject.Name, deploymentName+"-") {
					continue
				}
			} else if event.InvolvedObject.Kind == "Pod" {
				// Pod name should start with deployment name
				// Be more lenient with pod matching to catch deletion events
				if !strings.HasPrefix(event.InvolvedObject.Name, deploymentName+"-") && 
				   !strings.Contains(event.InvolvedObject.Name, deploymentName) {
					continue
				}
			} else if event.InvolvedObject.Kind == "Deployment" {
				// Deployment must match exactly
				if event.InvolvedObject.Name != deploymentName {
					continue
				}
			} else {
				// Skip events for other resource types when filtering by deployment
				continue
			}
		}

		timelineEvent := TimelineEvent{
			ID:            string(event.UID),
			Timestamp:     eventTime.UnixMilli(),
			Type:          mapEventType(event.Type, event.Reason),
			ResourceType:  event.InvolvedObject.Kind,
			ResourceName:  event.InvolvedObject.Name,
			Namespace:     event.Namespace,
			Message:       event.Message,
			Severity:      mapEventSeverity(event.Type, event.Reason),
			Reason:        event.Reason,
			Count:         event.Count,
			FirstTimestamp: event.FirstTimestamp.UnixMilli(),
			LastTimestamp:  event.LastTimestamp.UnixMilli(),
		}

		// Add source information
		if event.Source.Component != "" {
			timelineEvent.Source = event.Source.Component
			if event.Source.Host != "" {
				timelineEvent.Source += "@" + event.Source.Host
			}
		}

		timelineEvents = append(timelineEvents, timelineEvent)
	}

	// Correlate events (simple correlation based on time proximity and resource relationships)
	correlateEvents(timelineEvents)

	c.JSON(http.StatusOK, gin.H{
		"events": timelineEvents,
		"total":  len(timelineEvents),
	})
}

// GetResourceSnapshots fetches resource states at specific points in time
func GetResourceSnapshots(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")
	timestamp := c.Query("timestamp")
	resourceType := c.Query("resourceType")
	resourceName := c.Query("resourceName")
	
	if context == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and namespace are required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	clientset := conn.ClientSet
	ctx := c.Request.Context()

	// For now, return current state (in production, this would query historical data)
	// The timestamp parameter would be used to query time-series data from a metrics store
	snapshot := map[string]interface{}{
		"timestamp": timestamp,
		"current":   true, // Indicates this is current state, not historical
	}

	// If specific resource requested, get detailed info
	if resourceType != "" && resourceName != "" {
		switch resourceType {
		case "Deployment":
			deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, resourceName, metav1.GetOptions{})
			if err == nil {
				snapshot["resource"] = map[string]interface{}{
					"type":       "Deployment",
					"name":       deployment.Name,
					"replicas":   deployment.Status.Replicas,
					"ready":      deployment.Status.ReadyReplicas,
					"available":  deployment.Status.AvailableReplicas,
					"updated":    deployment.Status.UpdatedReplicas,
					"conditions": deployment.Status.Conditions,
				}
				
				// Get related pods
				pods, _ := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
					LabelSelector: metav1.FormatLabelSelector(deployment.Spec.Selector),
				})
				if pods != nil {
					podList := []map[string]interface{}{}
					for _, p := range pods.Items {
						podList = append(podList, map[string]interface{}{
							"name":     p.Name,
							"phase":    p.Status.Phase,
							"ready":    isPodReady(&p),
							"restarts": getPodRestartCount(&p),
							"node":     p.Spec.NodeName,
						})
					}
					snapshot["pods"] = podList
				}
			}
			
		case "CronJob":
			cronjob, err := clientset.BatchV1().CronJobs(namespace).Get(ctx, resourceName, metav1.GetOptions{})
			if err == nil {
				snapshot["resource"] = map[string]interface{}{
					"type":               "CronJob",
					"name":               cronjob.Name,
					"schedule":           cronjob.Spec.Schedule,
					"lastScheduleTime":   cronjob.Status.LastScheduleTime,
					"lastSuccessfulTime": cronjob.Status.LastSuccessfulTime,
					"active":             len(cronjob.Status.Active),
				}
				
				// Get related jobs
				jobs, _ := clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
				if jobs != nil {
					jobList := []map[string]interface{}{}
					for _, j := range jobs.Items {
						// Check if job belongs to this cronjob
						for _, owner := range j.OwnerReferences {
							if owner.Kind == "CronJob" && owner.Name == resourceName {
								jobList = append(jobList, map[string]interface{}{
									"name":       j.Name,
									"active":     j.Status.Active,
									"succeeded":  j.Status.Succeeded,
									"failed":     j.Status.Failed,
									"startTime":  j.Status.StartTime,
									"completionTime": j.Status.CompletionTime,
								})
								break
							}
						}
					}
					snapshot["jobs"] = jobList
				}
			}
		}
	} else {
		// Get general namespace overview
		deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			deploymentList := []map[string]interface{}{}
			for _, d := range deployments.Items {
				deploymentList = append(deploymentList, map[string]interface{}{
					"name":      d.Name,
					"replicas":  d.Status.Replicas,
					"ready":     d.Status.ReadyReplicas,
					"available": d.Status.AvailableReplicas,
					"updated":   d.Status.UpdatedReplicas,
				})
			}
			snapshot["deployments"] = deploymentList
		}
	}

	// Get pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		podList := []map[string]interface{}{}
		for _, p := range pods.Items {
			podList = append(podList, map[string]interface{}{
				"name":      p.Name,
				"phase":     p.Status.Phase,
				"ready":     isPodReady(&p),
				"restarts":  getPodRestartCount(&p),
				"node":      p.Spec.NodeName,
				"startTime": p.Status.StartTime,
			})
		}
		snapshot["pods"] = podList
	}

	// Get services
	services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		serviceList := []map[string]interface{}{}
		for _, s := range services.Items {
			endpoints, _ := clientset.CoreV1().Endpoints(namespace).Get(ctx, s.Name, metav1.GetOptions{})
			endpointCount := 0
			if endpoints != nil {
				for _, subset := range endpoints.Subsets {
					endpointCount += len(subset.Addresses)
				}
			}
			
			serviceList = append(serviceList, map[string]interface{}{
				"name":      s.Name,
				"type":      s.Spec.Type,
				"clusterIP": s.Spec.ClusterIP,
				"endpoints": endpointCount,
			})
		}
		snapshot["services"] = serviceList
	}

	c.JSON(http.StatusOK, gin.H{
		"timestamp": timestamp,
		"namespace": namespace,
		"snapshot":  snapshot,
	})
}

// Helper functions
func mapEventType(eventType string, reason string) string {
	// Map Kubernetes event reasons to timeline event types
	switch reason {
	case "ScalingReplicaSet", "Scaled", "ScaledUp", "ScaledDown":
		return "scale"
	// Pod/Container deletion and termination events - more comprehensive list
	case "Killing", "Killed", "Deleting", "Deleted", "Terminating", "Terminated", "Evicted",
	     "Stopping", "Stopped", "RemovingPod", "DeletingPod", "SuccessfulDelete",
	     "NodeNotReady", "NodeLost", "Preempted", "Shutdown":
		return "deletion"
	case "BackOff", "Failed", "FailedScheduling", "CrashLoopBackOff", "OOMKilled", "Error",
	     "FailedKillPod", "FailedPreStopHook", "FailedPostStartHook":
		return "crash"
	case "Started", "Created", "Scheduled", "Pulled", "Pulling", "Restarted", "Running":
		return "restart"
	case "SuccessfulCreate", "DeploymentCreated":
		return "deployment"
	case "ConfigChanged":
		return "config_change"
	case "Unhealthy", "FailedMount", "FailedAttachVolume", "FailedValidation":
		return "error"
	// Container specific events
	case "ContainerCreating", "ContainerStarted", "ContainerReady":
		return "restart"
	case "ContainerKilling", "ContainerTerminated", "ContainerStopped":
		return "deletion"
	default:
		// Debug logging for unmatched reasons (remove in production)
		// fmt.Printf("Unmatched event reason: %s (type: %s)\n", reason, eventType)
		if eventType == "Warning" {
			return "warning"
		}
		return "info"
	}
}

func mapEventSeverity(eventType string, reason string) string {
	if eventType == "Warning" {
		// Check for critical warnings
		switch reason {
		case "BackOff", "Failed", "FailedScheduling", "FailedMount", "Unhealthy", "CrashLoopBackOff", "OOMKilled", "Evicted":
			return "critical"
		case "Killing", "Deleting", "Terminating":
			return "warning"
		default:
			return "warning"
		}
	}
	
	// Check for different event severities
	switch reason {
	case "Started", "Created", "Scheduled", "SuccessfulCreate", "ContainerStarted":
		return "success"
	case "Killed", "Deleted", "Terminated", "SuccessfulDelete", "ContainerTerminated":
		return "info"
	case "Evicted", "OOMKilled", "Error", "FailedKillPod":
		return "critical"
	default:
		return "info"
	}
}

func correlateEvents(events []TimelineEvent) {
	// Simple correlation: events within 5 minutes of each other on related resources
	correlationWindow := int64(5 * 60 * 1000) // 5 minutes in milliseconds
	
	for i := range events {
		for j := range events {
			if i == j {
				continue
			}
			
			// Check if events are within correlation window
			timeDiff := events[i].Timestamp - events[j].Timestamp
			if timeDiff < 0 {
				timeDiff = -timeDiff
			}
			
			if timeDiff <= correlationWindow {
				// Check if resources are related
				if areResourcesRelated(&events[i], &events[j]) {
					// Add correlation
					if events[i].CorrelatedEvents == nil {
						events[i].CorrelatedEvents = []string{}
					}
					
					// Check if not already correlated
					found := false
					for _, id := range events[i].CorrelatedEvents {
						if id == events[j].ID {
							found = true
							break
						}
					}
					
					if !found {
						events[i].CorrelatedEvents = append(events[i].CorrelatedEvents, events[j].ID)
					}
				}
			}
		}
	}
}

func areResourcesRelated(event1, event2 *TimelineEvent) bool {
	// Check various relationships
	
	// Deployment -> ReplicaSet relationship
	if event1.ResourceType == "Deployment" && event2.ResourceType == "ReplicaSet" {
		// In production, would check actual owner references
		return true
	}
	if event1.ResourceType == "ReplicaSet" && event2.ResourceType == "Deployment" {
		return true
	}
	
	// ReplicaSet -> Pod relationship
	if event1.ResourceType == "ReplicaSet" && event2.ResourceType == "Pod" {
		return true
	}
	if event1.ResourceType == "Pod" && event2.ResourceType == "ReplicaSet" {
		return true
	}
	
	// Service -> Pod relationship
	if event1.ResourceType == "Service" && event2.ResourceType == "Pod" {
		return true
	}
	if event1.ResourceType == "Pod" && event2.ResourceType == "Service" {
		return true
	}
	
	// ConfigMap/Secret -> Pod relationship
	if (event1.ResourceType == "ConfigMap" || event1.ResourceType == "Secret") && event2.ResourceType == "Pod" {
		return true
	}
	if event1.ResourceType == "Pod" && (event2.ResourceType == "ConfigMap" || event2.ResourceType == "Secret") {
		return true
	}
	
	return false
}

func isPodReady(pod *corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady {
			return condition.Status == corev1.ConditionTrue
		}
	}
	return false
}

func getPodRestartCount(pod *corev1.Pod) int32 {
	var restarts int32
	for _, containerStatus := range pod.Status.ContainerStatuses {
		restarts += containerStatus.RestartCount
	}
	return restarts
}