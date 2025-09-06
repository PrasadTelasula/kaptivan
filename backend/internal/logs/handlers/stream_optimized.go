package handlers

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	"github.com/prasad/kaptivan/backend/internal/logs/services"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
)

// StreamManager manages multiple log streams
type StreamManager struct {
	streams map[string]*LogStream
	mu      sync.RWMutex
}

// LogStream represents a single log stream
type LogStream struct {
	id         string
	ctx        context.Context
	cancel     context.CancelFunc
	conn       *SafeWebSocketConn
	query      models.LogQuery
	manager    *kubernetes.ClusterManager
	parser     *services.LogParser
	activeJobs sync.WaitGroup
}

// StreamHandlerOptimized handles WebSocket connections for real-time log streaming
type StreamHandlerOptimized struct {
	manager       *kubernetes.ClusterManager
	parser        *services.LogParser
	streamManager *StreamManager
	clientPool    *ClientPool
}

// ClientPool manages Kubernetes client connections
type ClientPool struct {
	clients sync.Map // cluster -> k8sclient.Interface
	mu      sync.RWMutex
}

// NewStreamHandlerOptimized creates a new optimized stream handler
func NewStreamHandlerOptimized(manager *kubernetes.ClusterManager) *StreamHandlerOptimized {
	return &StreamHandlerOptimized{
		manager: manager,
		parser:  services.NewLogParser(),
		streamManager: &StreamManager{
			streams: make(map[string]*LogStream),
		},
		clientPool: &ClientPool{},
	}
}

// getClient gets or creates a Kubernetes client for a cluster
func (cp *ClientPool) getClient(manager *kubernetes.ClusterManager, cluster string) (k8sclient.Interface, error) {
	// Try to get existing client
	if client, ok := cp.clients.Load(cluster); ok {
		return client.(k8sclient.Interface), nil
	}
	
	// Create new client
	cp.mu.Lock()
	defer cp.mu.Unlock()
	
	// Double-check after acquiring lock
	if client, ok := cp.clients.Load(cluster); ok {
		return client.(k8sclient.Interface), nil
	}
	
	client, err := manager.GetClientset(cluster)
	if err != nil {
		return nil, fmt.Errorf("failed to get client for cluster %s: %w", cluster, err)
	}
	
	cp.clients.Store(cluster, client)
	return client, nil
}

// StreamLogs handles WebSocket connections for real-time log streaming
func (h *StreamHandlerOptimized) StreamLogs(c *gin.Context) {
	rawConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade connection"})
		return
	}
	conn := &SafeWebSocketConn{conn: rawConn}
	defer conn.Close()
	
	// Create stream context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	// Parse query parameters from URL
	query := models.LogQuery{
		Clusters:   c.QueryArray("clusters"),
		Namespaces: c.QueryArray("namespaces"),
		Pods:       c.QueryArray("pods"),
		Containers: c.QueryArray("containers"),
		LogLevels:  c.QueryArray("logLevels"),
	}
	
	// Parse time parameters
	if startTimeStr := c.Query("startTime"); startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			query.StartTime = t
		}
	}
	if endTimeStr := c.Query("endTime"); endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			query.EndTime = t
		}
	}
	
	// Create log stream
	streamID := generateSecureEventID()
	stream := &LogStream{
		id:      streamID,
		ctx:     ctx,
		cancel:  cancel,
		conn:    conn,
		manager: h.manager,
		parser:  h.parser,
		query:   query, // Set initial query from URL params
	}
	
	// Register stream
	h.streamManager.mu.Lock()
	h.streamManager.streams[streamID] = stream
	h.streamManager.mu.Unlock()
	
	// Cleanup on exit
	defer func() {
		h.streamManager.mu.Lock()
		delete(h.streamManager.streams, streamID)
		h.streamManager.mu.Unlock()
		stream.activeJobs.Wait() // Wait for all goroutines to finish
	}()
	
	// Start connection health monitor
	go h.monitorConnection(stream)
	
	// Log received query parameters for debugging
	fmt.Printf("[DEBUG] WebSocket connected with query: Clusters=%v, Namespaces=%v, Pods=%v, Containers=%v\n", 
		query.Clusters, query.Namespaces, query.Pods, query.Containers)
	
	// Start streaming immediately with URL query params
	if len(query.Clusters) > 0 && len(query.Namespaces) > 0 && len(query.Pods) > 0 {
		fmt.Printf("[DEBUG] Starting native streaming for query\n")
		h.startNativeStreaming(stream)
	} else {
		fmt.Printf("[DEBUG] Not starting streaming - missing required params\n")
		// Send initial message to indicate connection is ready
		conn.WriteJSON(models.StreamMessage{
			Type:    "info",
			Data:    "WebSocket connected. Send query to start streaming.",
			EventID: generateSecureEventID(),
		})
	}
	
	// Handle incoming messages for query updates
	go h.handleStreamMessages(stream)
	
	// Wait for context to be done
	<-ctx.Done()
}

// monitorConnection monitors WebSocket connection health
func (h *StreamHandlerOptimized) monitorConnection(stream *LogStream) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-stream.ctx.Done():
			return
		case <-ticker.C:
			if err := stream.conn.WriteJSON(models.StreamMessage{
				Type:    "ping",
				EventID: generateSecureEventID(),
			}); err != nil {
				stream.cancel()
				return
			}
		}
	}
}

// handleStreamMessages handles incoming WebSocket messages
func (h *StreamHandlerOptimized) handleStreamMessages(stream *LogStream) {
	for {
		var query models.LogQuery
		if err := stream.conn.ReadJSON(&query); err != nil {
			stream.cancel()
			return
		}
		
		// Cancel previous query streams if any
		stream.activeJobs.Wait()
		
		// Update query
		stream.query = query
		
		// Start native Kubernetes log streaming for each pod/container
		h.startNativeStreaming(stream)
	}
}

// startNativeStreaming starts native Kubernetes log streaming
func (h *StreamHandlerOptimized) startNativeStreaming(stream *LogStream) {
	query := stream.query
	fmt.Printf("[DEBUG] Starting native streaming with query: %+v\n", query)
	
	// First, send initial logs based on time range
	if !query.StartTime.IsZero() {
		h.sendInitialLogs(stream)
	}
	
	// Then start streaming for each cluster/namespace/pod/container combination
	for _, cluster := range query.Clusters {
		fmt.Printf("[DEBUG] Attempting to connect to cluster: %s\n", cluster)
		client, err := h.clientPool.getClient(h.manager, cluster)
		if err != nil {
			fmt.Printf("[DEBUG] Failed to connect to cluster %s: %v\n", cluster, err)
			stream.conn.WriteJSON(models.StreamMessage{
				Type:    "error",
				Data:    fmt.Sprintf("Failed to connect to cluster %s: %v", cluster, err),
				EventID: generateSecureEventID(),
			})
			continue
		}
		
		for _, namespace := range query.Namespaces {
			for _, podName := range query.Pods {
				fmt.Printf("[DEBUG] Getting pod %s in namespace %s\n", podName, namespace)
				// Get pod details
				pod, err := client.CoreV1().Pods(namespace).Get(stream.ctx, podName, metav1.GetOptions{})
				if err != nil {
					fmt.Printf("[DEBUG] Failed to get pod %s/%s: %v\n", namespace, podName, err)
					continue
				}
				
				// Stream logs from each container
				for _, container := range pod.Spec.Containers {
					fmt.Printf("[DEBUG] Checking container %s against filter %v\n", container.Name, query.Containers)
					if h.shouldIncludeContainer(container.Name, query.Containers) {
						fmt.Printf("[DEBUG] Starting log stream for %s/%s/%s\n", namespace, podName, container.Name)
						stream.activeJobs.Add(1)
						go h.streamContainerLogs(stream, client, cluster, namespace, podName, container.Name)
					}
				}
			}
		}
	}
}

// streamContainerLogs streams logs from a specific container using native Kubernetes streaming
func (h *StreamHandlerOptimized) streamContainerLogs(
	stream *LogStream,
	client k8sclient.Interface,
	cluster, namespace, pod, container string,
) {
	defer stream.activeJobs.Done()
	fmt.Printf("[DEBUG] streamContainerLogs started for %s/%s/%s/%s\n", cluster, namespace, pod, container)
	
	retryCount := 0
	maxRetries := 5
	lastLogTime := time.Now()
	
	for {
		select {
		case <-stream.ctx.Done():
			fmt.Printf("[DEBUG] Context done, stopping stream for %s/%s/%s\n", namespace, pod, container)
			return
		default:
			fmt.Printf("[DEBUG] Configuring log options for %s/%s/%s\n", namespace, pod, container)
			// Configure log options for streaming
			opts := &corev1.PodLogOptions{
				Container:  container,
				Follow:     true, // Enable native streaming
				Timestamps: true,
				TailLines:  &[]int64{10}[0], // Start with last 10 lines for reconnection
			}
			
			// Use the last log time for reconnection to avoid duplicates
			if retryCount > 0 {
				sinceTime := metav1.NewTime(lastLogTime)
				opts.SinceTime = &sinceTime
				opts.TailLines = nil
			} else if !stream.query.StartTime.IsZero() {
				sinceTime := metav1.NewTime(stream.query.StartTime)
				opts.SinceTime = &sinceTime
				opts.TailLines = nil
			}
			
			// Create log stream request
			req := client.CoreV1().Pods(namespace).GetLogs(pod, opts)
			logStream, err := req.Stream(stream.ctx)
			if err != nil {
				if retryCount >= maxRetries {
					stream.conn.WriteJSON(models.StreamMessage{
						Type:    "error",
						Data:    fmt.Sprintf("Failed to stream logs from %s/%s/%s after %d retries: %v", cluster, pod, container, retryCount, err),
						EventID: generateSecureEventID(),
					})
					return
				}
				
				// Wait before retry with exponential backoff
				retryCount++
				waitTime := time.Duration(retryCount) * time.Second
				if waitTime > 30*time.Second {
					waitTime = 30 * time.Second
				}
				
				stream.conn.WriteJSON(models.StreamMessage{
					Type:    "info",
					Data:    fmt.Sprintf("Reconnecting to %s/%s/%s (attempt %d/%d)...", cluster, pod, container, retryCount, maxRetries),
					EventID: generateSecureEventID(),
				})
				
				time.Sleep(waitTime)
				continue
			}
			
			// Reset retry count on successful connection
			if retryCount > 0 {
				stream.conn.WriteJSON(models.StreamMessage{
					Type:    "info",
					Data:    fmt.Sprintf("Successfully reconnected to %s/%s/%s", cluster, pod, container),
					EventID: generateSecureEventID(),
				})
				retryCount = 0
			}
			
			// Process log stream in real-time
			// This will return when the stream ends (timeout or pod restart)
			lastLogTime = h.processLogStreamWithReconnect(stream, logStream, cluster, namespace, pod, container)
			logStream.Close()
			
			// If stream ended normally, try to reconnect after a short delay
			time.Sleep(2 * time.Second)
		}
	}
}

// processLogStream processes the log stream and sends to WebSocket
func (h *StreamHandlerOptimized) processLogStream(
	stream *LogStream,
	reader io.ReadCloser,
	cluster, namespace, pod, container string,
) {
	scanner := bufio.NewScanner(reader)
	lineNum := 0
	batch := make([]models.LogEntry, 0, 10)
	batchTicker := time.NewTicker(100 * time.Millisecond) // Send batches every 100ms
	defer batchTicker.Stop()
	
	// Goroutine to send batches periodically
	go func() {
		for {
			select {
			case <-stream.ctx.Done():
				return
			case <-batchTicker.C:
				if len(batch) > 0 {
					h.sendLogBatch(stream, batch)
					batch = batch[:0] // Reset batch
				}
			}
		}
	}()
	
	for scanner.Scan() {
		select {
		case <-stream.ctx.Done():
			return
		default:
			lineNum++
			line := scanner.Text()
			
			// Parse log line
			entry := h.parser.ParseLogLine(line, cluster, namespace, pod, container, lineNum)
			
			// Apply filters
			if h.shouldIncludeLog(entry, stream.query) {
				batch = append(batch, entry)
				
				// Send batch if it reaches size limit
				if len(batch) >= 50 {
					h.sendLogBatch(stream, batch)
					batch = batch[:0]
				}
			}
		}
	}
	
	// Send any remaining logs
	if len(batch) > 0 {
		h.sendLogBatch(stream, batch)
	}
	
	if err := scanner.Err(); err != nil && err != io.EOF {
		stream.conn.WriteJSON(models.StreamMessage{
			Type:    "error",
			Data:    fmt.Sprintf("Error reading log stream: %v", err),
			EventID: generateSecureEventID(),
		})
	}
}

// processLogStreamWithReconnect processes the log stream and returns the last log timestamp
func (h *StreamHandlerOptimized) processLogStreamWithReconnect(
	stream *LogStream,
	reader io.ReadCloser,
	cluster, namespace, pod, container string,
) time.Time {
	scanner := bufio.NewScanner(reader)
	lineNum := 0
	batch := make([]models.LogEntry, 0, 10)
	batchTicker := time.NewTicker(100 * time.Millisecond)
	defer batchTicker.Stop()
	
	lastLogTime := time.Now()
	batchChan := make(chan []models.LogEntry, 100)
	done := make(chan struct{})
	
	// Goroutine to send batches periodically
	go func() {
		defer close(done)
		for {
			select {
			case <-stream.ctx.Done():
				return
			case <-batchTicker.C:
				if len(batch) > 0 {
					batchCopy := make([]models.LogEntry, len(batch))
					copy(batchCopy, batch)
					select {
					case batchChan <- batchCopy:
						batch = batch[:0]
					default:
						// Channel full, skip this batch
					}
				}
			case batchToSend := <-batchChan:
				h.sendLogBatch(stream, batchToSend)
			}
		}
	}()
	
	for scanner.Scan() {
		select {
		case <-stream.ctx.Done():
			close(batchChan)
			<-done
			return lastLogTime
		default:
			lineNum++
			line := scanner.Text()
			
			// Parse log line
			entry := h.parser.ParseLogLine(line, cluster, namespace, pod, container, lineNum)
			
			// Update last log time
			if !entry.Timestamp.IsZero() {
				lastLogTime = entry.Timestamp
			}
			
			// Apply filters
			if h.shouldIncludeLog(entry, stream.query) {
				batch = append(batch, entry)
				
				// Send batch if it reaches size limit
				if len(batch) >= 50 {
					batchCopy := make([]models.LogEntry, len(batch))
					copy(batchCopy, batch)
					select {
					case batchChan <- batchCopy:
						batch = batch[:0]
					default:
						// Channel full, keep accumulating
					}
				}
			}
		}
	}
	
	// Send remaining batch
	if len(batch) > 0 {
		batchCopy := make([]models.LogEntry, len(batch))
		copy(batchCopy, batch)
		select {
		case batchChan <- batchCopy:
		case <-time.After(100 * time.Millisecond):
			// Timeout, send directly
			h.sendLogBatch(stream, batchCopy)
		}
	}
	
	close(batchChan)
	<-done
	
	// Log when stream ends for debugging
	stream.conn.WriteJSON(models.StreamMessage{
		Type:    "info",
		Data:    fmt.Sprintf("Log stream ended for %s/%s/%s, will reconnect...", cluster, pod, container),
		EventID: generateSecureEventID(),
	})
	
	return lastLogTime
}

// sendLogBatch sends a batch of logs to the client
func (h *StreamHandlerOptimized) sendLogBatch(stream *LogStream, logs []models.LogEntry) {
	if len(logs) == 0 {
		return
	}
	
	// Create a copy to avoid race conditions
	logsCopy := make([]models.LogEntry, len(logs))
	copy(logsCopy, logs)
	
	stream.conn.WriteJSON(models.StreamMessage{
		Type:    "logs",
		Data:    logsCopy,
		EventID: generateSecureEventID(),
	})
}

// sendInitialLogs sends historical logs based on time range
func (h *StreamHandlerOptimized) sendInitialLogs(stream *LogStream) {
	query := stream.query
	
	for _, cluster := range query.Clusters {
		client, err := h.clientPool.getClient(h.manager, cluster)
		if err != nil {
			continue
		}
		
		for _, namespace := range query.Namespaces {
			for _, podName := range query.Pods {
				pod, err := client.CoreV1().Pods(namespace).Get(stream.ctx, podName, metav1.GetOptions{})
				if err != nil {
					continue
				}
				
				for _, container := range pod.Spec.Containers {
					if h.shouldIncludeContainer(container.Name, query.Containers) {
						h.fetchHistoricalLogs(stream, client, cluster, namespace, podName, container.Name)
					}
				}
			}
		}
	}
}

// fetchHistoricalLogs fetches historical logs for initial load
func (h *StreamHandlerOptimized) fetchHistoricalLogs(
	stream *LogStream,
	client k8sclient.Interface,
	cluster, namespace, pod, container string,
) {
	opts := &corev1.PodLogOptions{
		Container:  container,
		Timestamps: true,
	}
	
	if !stream.query.StartTime.IsZero() {
		sinceTime := metav1.NewTime(stream.query.StartTime)
		opts.SinceTime = &sinceTime
	} else {
		// Default to last 500 lines if no time range specified
		tailLines := int64(500)
		opts.TailLines = &tailLines
	}
	
	req := client.CoreV1().Pods(namespace).GetLogs(pod, opts)
	logStream, err := req.Stream(stream.ctx)
	if err != nil {
		return
	}
	defer logStream.Close()
	
	scanner := bufio.NewScanner(logStream)
	logs := make([]models.LogEntry, 0, 100)
	lineNum := 0
	
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		entry := h.parser.ParseLogLine(line, cluster, namespace, pod, container, lineNum)
		
		if h.shouldIncludeLog(entry, stream.query) {
			logs = append(logs, entry)
		}
	}
	
	if len(logs) > 0 {
		h.sendLogBatch(stream, logs)
	}
}

// shouldIncludeContainer checks if container should be included
func (h *StreamHandlerOptimized) shouldIncludeContainer(containerName string, containers []string) bool {
	if len(containers) == 0 {
		return true
	}
	
	for _, c := range containers {
		if containerName == c {
			return true
		}
	}
	
	return false
}

// shouldIncludeLog checks if log entry passes filters
func (h *StreamHandlerOptimized) shouldIncludeLog(entry models.LogEntry, query models.LogQuery) bool {
	// Check log level filter
	if len(query.LogLevels) > 0 {
		found := false
		for _, level := range query.LogLevels {
			if entry.Level == level {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	
	// Check search term
	if query.SearchTerm != "" {
		// Simple case-insensitive search in message
		if !containsIgnoreCase(entry.Message, query.SearchTerm) {
			return false
		}
	}
	
	// Check time range
	if !query.EndTime.IsZero() && entry.Timestamp.After(query.EndTime) {
		return false
	}
	
	return true
}

// containsIgnoreCase checks if string contains substring (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	// Simple implementation - could be optimized with strings.ToLower caching
	return len(s) >= len(substr) && 
		   len(substr) > 0 && 
		   (s == substr || 
		    len(s) > len(substr) && 
		    containsSubstring(s, substr))
}

// containsSubstring is a helper for case-insensitive substring search
func containsSubstring(s, substr string) bool {
	// Convert both to lowercase for comparison
	sLower := make([]byte, len(s))
	substrLower := make([]byte, len(substr))
	
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c = c + 32 // Convert to lowercase
		}
		sLower[i] = c
	}
	
	for i := 0; i < len(substr); i++ {
		c := substr[i]
		if c >= 'A' && c <= 'Z' {
			c = c + 32 // Convert to lowercase
		}
		substrLower[i] = c
	}
	
	// Search for substring
	for i := 0; i <= len(sLower)-len(substrLower); i++ {
		match := true
		for j := 0; j < len(substrLower); j++ {
			if sLower[i+j] != substrLower[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	
	return false
}

// generateSecureEventID generates a cryptographically secure event ID
func generateSecureEventID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", time.Now().Format("20060102150405"), hex.EncodeToString(b))
}