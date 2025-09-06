package events

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

type EventUpdate struct {
	Type      string     `json:"type"`      // added, modified, deleted
	Event     *EventInfo `json:"event"`
	Cluster   string     `json:"cluster"`
	Timestamp time.Time  `json:"timestamp"`
}

type EventSubscription struct {
	Clusters   []string `json:"clusters"`
	Namespaces []string `json:"namespaces"`
	Types      []string `json:"types"`
	Reasons    []string `json:"reasons"`
}

// EventsWebSocket handles WebSocket connections for real-time event streaming
func EventsWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connected from %s", c.Request.RemoteAddr)

	// Mutex to protect WebSocket writes
	var writeMutex sync.Mutex

	// Create a context for this connection
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Use unbuffered channel with proper goroutine handling
	updates := make(chan EventUpdate, 10000)
	
	// Track sent events to avoid duplicates
	sentEvents := make(map[string]time.Time)
	eventCleanupTicker := time.NewTicker(30 * time.Second)
	defer eventCleanupTicker.Stop()
	
	// Start goroutine to send updates to client with rate limiting
	go func() {
		ticker := time.NewTicker(10 * time.Millisecond) // Rate limit: max 100 events/second
		defer ticker.Stop()
		
		for {
			select {
			case <-ticker.C:
				select {
				case update := <-updates:
					// Check for duplicate events
					eventKey := fmt.Sprintf("%s-%s-%s", update.Cluster, update.Event.Namespace, update.Event.Name)
					if lastSent, exists := sentEvents[eventKey]; exists {
						// Skip if we sent this event in the last 5 seconds
						if time.Since(lastSent) < 5*time.Second {
							continue
						}
					}
					
					writeMutex.Lock()
					err := conn.WriteJSON(update)
					writeMutex.Unlock()
					if err != nil {
						log.Printf("Error writing to websocket: %v", err)
						cancel()
						return
					}
					sentEvents[eventKey] = time.Now()
				default:
					// No events to send
				}
			case <-eventCleanupTicker.C:
				// Clean up old entries from sentEvents map
				now := time.Now()
				for key, timestamp := range sentEvents {
					if now.Sub(timestamp) > 60*time.Second {
						delete(sentEvents, key)
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// Handle ping/pong to keep connection alive
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	// Send periodic pings
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				writeMutex.Lock()
				err := conn.WriteMessage(websocket.PingMessage, nil)
				writeMutex.Unlock()
				if err != nil {
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	
	// Track active watchers
	var watcherCtx context.Context
	var watcherCancel context.CancelFunc
	
	// Read subscription messages from client
	for {
		var sub EventSubscription
		if err := conn.ReadJSON(&sub); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error from %s: %v", c.Request.RemoteAddr, err)
			}
			break
		}
		
		log.Printf("WebSocket received subscription from %s: %+v", c.Request.RemoteAddr, sub)

		// Only cancel previous watchers if we have them
		if watcherCancel != nil {
			log.Printf("Canceling previous watchers for new subscription")
			watcherCancel()
			// Give watchers time to cleanup
			time.Sleep(100 * time.Millisecond)
		}
		
		// Create new context for watchers
		watcherCtx, watcherCancel = context.WithCancel(ctx)

		// Clear the updates channel to avoid stale events
		for len(updates) > 0 {
			select {
			case <-updates:
			default:
			}
		}

		// Start watchers for each cluster
		for _, clusterContext := range sub.Clusters {
			go watchClusterEvents(watcherCtx, clusterContext, sub, updates)
		}
	}
	
	// Cleanup watchers on exit
	if watcherCancel != nil {
		watcherCancel()
	}
}

func watchClusterEvents(ctx context.Context, clusterContext string, sub EventSubscription, updates chan<- EventUpdate) {
	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		log.Printf("Failed to get connection for cluster %s: %v", clusterContext, err)
		return
	}

	// Determine namespaces to watch
	namespaces := sub.Namespaces
	if len(namespaces) == 0 || (len(namespaces) == 1 && namespaces[0] == "all") {
		namespaces = []string{metav1.NamespaceAll}
	}

	for _, namespace := range namespaces {
		go watchNamespaceEvents(ctx, conn.ClientSet, clusterContext, namespace, sub, updates)
	}
}

func watchNamespaceEvents(ctx context.Context, clientSet kubernetes.Interface, clusterContext, namespace string, sub EventSubscription, updates chan<- EventUpdate) {
	// Create watch options
	watchOptions := metav1.ListOptions{
		Watch: true,
	}

	// Create watcher
	watcher, err := clientSet.CoreV1().Events(namespace).Watch(ctx, watchOptions)
	if err != nil {
		log.Printf("Failed to create watcher for namespace %s: %v", namespace, err)
		return
	}
	defer watcher.Stop()

	// Process events
	for {
		select {
		case event, ok := <-watcher.ResultChan():
			if !ok {
				log.Printf("Watcher channel closed for namespace %s", namespace)
				return
			}

			k8sEvent, ok := event.Object.(*corev1.Event)
			if !ok {
				continue
			}

			// Filter based on subscription
			if !matchesFilter(k8sEvent, sub) {
				continue
			}

			// Transform to EventInfo
			eventInfo := transformEvent(k8sEvent)

			// Send update
			update := EventUpdate{
				Type:      string(event.Type),
				Event:     eventInfo,
				Cluster:   clusterContext,
				Timestamp: time.Now(),
			}

			select {
			case updates <- update:
				// Successfully queued event
			case <-time.After(100 * time.Millisecond):
				// Timeout sending, channel might be full but don't block forever
				log.Printf("Timeout sending event update, skipping")
			case <-ctx.Done():
				return
			}

		case <-ctx.Done():
			return
		}
	}
}

func matchesFilter(event *corev1.Event, sub EventSubscription) bool {
	// Filter by type
	if len(sub.Types) > 0 && sub.Types[0] != "all" {
		matched := false
		for _, t := range sub.Types {
			if event.Type == t {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Filter by reason
	if len(sub.Reasons) > 0 && sub.Reasons[0] != "all" {
		matched := false
		for _, r := range sub.Reasons {
			if event.Reason == r {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

func transformEvent(event *corev1.Event) *EventInfo {
	lastTime := event.LastTimestamp.Time
	if event.EventTime.Time.After(lastTime) {
		lastTime = event.EventTime.Time
	}
	
	age := calculateAge(lastTime)
	
	source := ""
	if event.Source.Component != "" || event.Source.Host != "" {
		source = event.Source.Component
		if event.Source.Host != "" {
			source += "@" + event.Source.Host
		}
	}
	if event.ReportingController != "" {
		source = event.ReportingController
	}
	
	return &EventInfo{
		Name:               event.Name,
		Namespace:          event.Namespace,
		Type:               event.Type,
		Reason:             event.Reason,
		Message:            event.Message,
		Count:              event.Count,
		FirstTimestamp:     event.FirstTimestamp.Time,
		LastTimestamp:      lastTime,
		InvolvedObjectKind: event.InvolvedObject.Kind,
		InvolvedObjectName: event.InvolvedObject.Name,
		Source:             source,
		SourceComponent:    event.Source.Component,
		SourceHost:         event.Source.Host,
		Age:                age,
	}
}