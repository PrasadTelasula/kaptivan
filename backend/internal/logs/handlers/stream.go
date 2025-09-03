package handlers

import (
	"context"
	"net/http"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	"github.com/prasad/kaptivan/backend/internal/logs/services"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// StreamHandler handles WebSocket connections for log streaming
type StreamHandler struct {
	aggregator *services.LogAggregator
}

// NewStreamHandler creates a new stream handler
func NewStreamHandler(manager *kubernetes.ClusterManager) *StreamHandler {
	return &StreamHandler{
		aggregator: services.NewLogAggregator(manager),
	}
}

// StreamLogs handles WebSocket connections for real-time log streaming
func (h *StreamHandler) StreamLogs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade connection"})
		return
	}
	defer conn.Close()
	
	// Create context for this connection
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	// Start ping/pong handler
	go h.handlePing(conn, cancel)
	
	// Handle incoming messages
	go h.handleMessages(ctx, conn, cancel)
	
	// Wait for context to be done
	<-ctx.Done()
}

// handlePing sends periodic ping messages to keep connection alive
func (h *StreamHandler) handlePing(conn *websocket.Conn, cancel context.CancelFunc) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			if err := conn.WriteJSON(models.StreamMessage{
				Type:    "ping",
				EventID: generateEventID(),
			}); err != nil {
				cancel()
				return
			}
		}
	}
}

// handleMessages handles incoming WebSocket messages
func (h *StreamHandler) handleMessages(ctx context.Context, conn *websocket.Conn, cancel context.CancelFunc) {
	for {
		var query models.LogQuery
		if err := conn.ReadJSON(&query); err != nil {
			cancel()
			return
		}
		
		// Start streaming logs for this query
		go h.streamLogsForQuery(ctx, conn, query)
	}
}

// streamLogsForQuery streams logs based on query
func (h *StreamHandler) streamLogsForQuery(ctx context.Context, conn *websocket.Conn, query models.LogQuery) {
	// Set follow to true for streaming
	query.Follow = true
	
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	
	lastFetch := time.Now()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Update query to fetch only new logs
			query.StartTime = lastFetch
			lastFetch = time.Now()
			
			// Fetch new logs
			response, err := h.aggregator.FetchLogs(ctx, query)
			if err != nil {
				conn.WriteJSON(models.StreamMessage{
					Type:    "error",
					Data:    err.Error(),
					EventID: generateEventID(),
				})
				continue
			}
			
			// Send logs to client
			if len(response.Logs) > 0 {
				conn.WriteJSON(models.StreamMessage{
					Type:    "logs",
					Data:    response.Logs,
					EventID: generateEventID(),
				})
			}
		}
	}
}

// generateEventID generates a unique event ID
func generateEventID() string {
	return time.Now().Format("20060102150405") + "-" + generateRandomString(8)
}

// generateRandomString generates a random string of given length
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}