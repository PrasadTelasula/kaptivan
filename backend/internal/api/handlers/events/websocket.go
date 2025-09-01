package events

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/watch"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// HandleEventWebSocket streams real-time events via WebSocket
func HandleEventWebSocket(c *gin.Context) {
	clusterContext := c.Query("context")
	namespace := c.Query("namespace")
	resourceName := c.Query("resourceName")
	resourceType := c.Query("resourceType")
	
	if clusterContext == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Upgrade to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer ws.Close()

	clientset := conn.ClientSet
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Build field selector for watching events
	fieldSelector := fields.Everything()
	// For deployments, we need to watch all events and filter later
	if resourceName != "" && resourceType != "" && resourceType != "Deployment" {
		fieldSelector = fields.ParseSelectorOrDie(fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", resourceName, resourceType))
	}

	// Create watcher for events
	watcher, err := clientset.CoreV1().Events(namespace).Watch(ctx, metav1.ListOptions{
		FieldSelector: fieldSelector.String(),
	})
	if err != nil {
		log.Printf("Failed to create event watcher: %v", err)
		ws.WriteJSON(map[string]interface{}{
			"type":  "error",
			"error": fmt.Sprintf("Failed to watch events: %v", err),
		})
		return
	}
	defer watcher.Stop()

	// Send initial connected message
	ws.WriteJSON(map[string]interface{}{
		"type":    "connected",
		"message": "Connected to event stream",
	})

	// Create channels for handling WebSocket messages and events
	done := make(chan struct{})
	
	// Handle incoming WebSocket messages (for ping/pong or control messages)
	go func() {
		defer close(done)
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				return
			}
		}
	}()

	// Send events to WebSocket
	for {
		select {
		case event := <-watcher.ResultChan():
			if event.Type == watch.Error {
				ws.WriteJSON(map[string]interface{}{
					"type":  "error",
					"error": "Watch error occurred",
				})
				return
			}

			if k8sEvent, ok := event.Object.(*v1.Event); ok {
				// Filter for deployment-related events if needed
				if resourceType == "Deployment" && resourceName != "" {
					// Check if this event belongs to the deployment's resources
					if k8sEvent.InvolvedObject.Kind == "ReplicaSet" {
						// ReplicaSet name should start with deployment name
						if !strings.HasPrefix(k8sEvent.InvolvedObject.Name, resourceName+"-") {
							continue
						}
					} else if k8sEvent.InvolvedObject.Kind == "Pod" {
						// Pod name should start with deployment name
						if !strings.HasPrefix(k8sEvent.InvolvedObject.Name, resourceName+"-") &&
						   !strings.Contains(k8sEvent.InvolvedObject.Name, resourceName) {
							continue
						}
					} else if k8sEvent.InvolvedObject.Kind == "Deployment" {
						// Deployment must match exactly
						if k8sEvent.InvolvedObject.Name != resourceName {
							continue
						}
					} else {
						// Skip events for other resource types when filtering by deployment
						continue
					}
				}
				
				timelineEvent := convertToTimelineEvent(k8sEvent)
				
				ws.WriteJSON(map[string]interface{}{
					"type":  "event",
					"event": timelineEvent,
					"watchType": string(event.Type),
				})
			}

		case <-done:
			return

		case <-ctx.Done():
			return

		case <-time.After(30 * time.Second):
			// Send periodic ping to keep connection alive
			if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// convertToTimelineEvent converts a Kubernetes event to a TimelineEvent
func convertToTimelineEvent(event *v1.Event) TimelineEvent {
	eventTime := event.LastTimestamp.Time
	if event.LastTimestamp.IsZero() {
		eventTime = event.FirstTimestamp.Time
	}

	timelineEvent := TimelineEvent{
		ID:             string(event.UID),
		Timestamp:      eventTime.UnixMilli(),
		Type:           mapEventType(event.Type, event.Reason),
		ResourceType:   event.InvolvedObject.Kind,
		ResourceName:   event.InvolvedObject.Name,
		Namespace:      event.Namespace,
		Message:        event.Message,
		Severity:       mapEventSeverity(event.Type, event.Reason),
		Reason:         event.Reason,
		Count:          event.Count,
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

	return timelineEvent
}