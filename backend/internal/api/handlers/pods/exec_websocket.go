package pods

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// TODO: Restrict this in production
		return true
	},
}

// Message types for WebSocket communication
const (
	MessageTypeStdin  = "stdin"
	MessageTypeResize = "resize"
)

// WebSocketMessage represents a message from the client
type WebSocketMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ResizeMessage represents terminal resize data
type ResizeMessage struct {
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// ExecWebSocket handles WebSocket connections for pod exec
func ExecWebSocket(c *gin.Context) {
	contextName := c.Query("context")
	namespace := c.Query("namespace")
	podName := c.Query("name")
	container := c.Query("container")


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
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error: %v", err)))
		return
	}
	
	// If no container specified, get the first container from the pod
	if container == "" {
		pod, err := conn.ClientSet.CoreV1().Pods(namespace).Get(c.Request.Context(), podName, metav1.GetOptions{})
		if err != nil {
			ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error getting pod: %v", err)))
			return
		}
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
			fmt.Printf("No container specified, using first container: %s\n", container)
		} else {
			ws.WriteMessage(websocket.TextMessage, []byte("Error: Pod has no containers"))
			return
		}
	}

	// Create WebSocket terminal handler
	handler := &WebSocketTerminalHandler{
		ws:       ws,
		sizeChan: make(chan remotecommand.TerminalSize, 1),
		doneChan: make(chan struct{}),
	}

	// Start input handler goroutine
	go handler.handleInput()

	// Prepare exec request
	req := conn.ClientSet.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	// Use interactive shell - try bash first, sh is fallback in most containers
	// The -i flag makes the shell interactive which is important for proper terminal behavior
	command := []string{"/bin/sh", "-i"}
	
	req.VersionedParams(&v1.PodExecOptions{
		Container: container,
		Command:   command,
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	// Create executor
	exec, err := remotecommand.NewSPDYExecutor(conn.Config, "POST", req.URL())
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error creating executor: %v", err)))
		return
	}

	// Start exec stream in a goroutine
	go func() {
		fmt.Printf("Starting exec stream for pod %s/%s (container: %s)\n", namespace, podName, container)
		err = exec.Stream(remotecommand.StreamOptions{
			Stdin:             handler,
			Stdout:            handler,
			Stderr:            handler,
			Tty:               true,
			TerminalSizeQueue: handler,
		})

		if err != nil {
			errMsg := fmt.Sprintf("\r\n\x1b[31mError: Failed to connect to container '%s' in pod '%s/%s'\r\n", container, namespace, podName)
			errMsg += fmt.Sprintf("Details: %v\x1b[0m\r\n", err)
			ws.WriteMessage(websocket.TextMessage, []byte(errMsg))
		}
		
		// Close the WebSocket when exec completes
		handler.Close()
	}()
	
	// Wait for the connection to close
	<-handler.doneChan
}

// WebSocketTerminalHandler handles the WebSocket terminal communication
type WebSocketTerminalHandler struct {
	ws       *websocket.Conn
	sizeChan chan remotecommand.TerminalSize
	doneChan chan struct{}
	stdinCh  chan []byte
	mu       sync.Mutex
	closed   bool
	buffer   []byte  // Buffer for partial reads
}

// Close closes the handler and WebSocket connection
func (h *WebSocketTerminalHandler) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	if !h.closed {
		h.closed = true
		// Safely close done channel
		select {
		case <-h.doneChan:
			// Already closed
		default:
			close(h.doneChan)
		}
		h.ws.Close()
	}
}

// handleInput reads from WebSocket and processes messages
func (h *WebSocketTerminalHandler) handleInput() {
	h.stdinCh = make(chan []byte, 256)
	defer func() {
		// Safely close stdinCh only if not already closed
		h.mu.Lock()
		if h.stdinCh != nil {
			close(h.stdinCh)
			h.stdinCh = nil
		}
		h.mu.Unlock()
	}()

	for {
		select {
		case <-h.doneChan:
			return
		default:
			messageType, data, err := h.ws.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
					fmt.Printf("WebSocket read error: %v\n", err)
				}
				// Don't close doneChan here - let Close() handle it
				h.Close()
				return
			}

			if messageType == websocket.TextMessage || messageType == websocket.BinaryMessage {
				// Check if it's a resize message
				if string(data[:min(7, len(data))] ) == "resize:" {
					var cols, rows uint16
					if _, err := fmt.Sscanf(string(data), "resize:%d,%d", &cols, &rows); err == nil {
						select {
						case h.sizeChan <- remotecommand.TerminalSize{Width: cols, Height: rows}:
						default:
							// Drop the resize message if channel is full
						}
					}
				} else {
					// Regular stdin data
					select {
					case h.stdinCh <- data:
					case <-h.doneChan:
						return
					}
				}
			}
		}
	}
}

// Read implements io.Reader for stdin
func (h *WebSocketTerminalHandler) Read(p []byte) (int, error) {
	// First, check if we have buffered data
	if len(h.buffer) > 0 {
		n := copy(p, h.buffer)
		h.buffer = h.buffer[n:]
		return n, nil
	}
	
	// If no buffered data, read from channel
	select {
	case data, ok := <-h.stdinCh:
		if !ok {
			return 0, io.EOF
		}
		n := copy(p, data)
		// If we couldn't copy all data, buffer the rest
		if n < len(data) {
			h.buffer = data[n:]
		}
		return n, nil
	case <-h.doneChan:
		return 0, io.EOF
	}
}

// Write implements io.Writer for stdout/stderr
func (h *WebSocketTerminalHandler) Write(p []byte) (int, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		return 0, io.EOF
	}

	err := h.ws.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		h.closed = true
		// Don't close doneChan here - let Close() handle it
		return 0, err
	}
	return len(p), nil
}

// Next implements remotecommand.TerminalSizeQueue
func (h *WebSocketTerminalHandler) Next() *remotecommand.TerminalSize {
	select {
	case size := <-h.sizeChan:
		return &size
	case <-h.doneChan:
		return nil
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}