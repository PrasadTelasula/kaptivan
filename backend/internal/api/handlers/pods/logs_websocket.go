package pods

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
)

// LogsWebSocket handles WebSocket connections for streaming pod logs
func LogsWebSocket(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container")
	tailLinesStr := c.DefaultQuery("tailLines", "100")
	follow := c.DefaultQuery("follow", "true") == "true"

	// Parse tail lines
	tailLines, err := strconv.ParseInt(tailLinesStr, 10, 64)
	if err != nil {
		tailLines = 100
	}

	// Upgrade HTTP connection to WebSocket
	ws, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade connection"})
		return
	}
	defer ws.Close()

	// Get cluster connection
	conn, err := clusterManager.GetConnection(contextName)
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"error": "Failed to get cluster connection: %v"}`, err)))
		return
	}

	// Configure log options
	podLogOptions := &corev1.PodLogOptions{
		Container:  container,
		Follow:     follow,
		Timestamps: true,
		TailLines:  &tailLines,
	}

	// Get log stream
	req := conn.ClientSet.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	logStream, err := req.Stream(context.Background())
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"error": "Failed to get log stream: %v"}`, err)))
		return
	}
	defer logStream.Close()

	// Create channels for coordinating goroutines
	done := make(chan struct{})
	defer close(done)

	// Handle WebSocket ping/pong and client disconnection
	go func() {
		ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		ws.SetPongHandler(func(string) error {
			ws.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		for {
			select {
			case <-done:
				return
			default:
				// Read messages from client (mainly for detecting disconnection)
				_, _, err := ws.ReadMessage()
				if err != nil {
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
						fmt.Printf("WebSocket error: %v\n", err)
					}
					close(done)
					return
				}
			}
		}
	}()

	// Send ping messages periodically
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ticker.C:
				ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Stream logs to WebSocket
	scanner := bufio.NewScanner(logStream)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer

	for scanner.Scan() {
		select {
		case <-done:
			return
		default:
			line := scanner.Text()
			
			// Send log line as JSON
			message := fmt.Sprintf(`{"type": "log", "data": %q, "timestamp": %q}`, line, time.Now().Format(time.RFC3339))
			
			ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteMessage(websocket.TextMessage, []byte(message)); err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					fmt.Printf("Error writing to WebSocket: %v\n", err)
				}
				return
			}
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf(`{"error": "Scanner error: %v"}`, err)))
	}

	// Send end-of-stream message if not following
	if !follow {
		ws.WriteMessage(websocket.TextMessage, []byte(`{"type": "end", "message": "Log stream ended"}`))
	}
}