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
	fmt.Printf("[DEBUG] WebSocket connected with query: Clusters=%v, Namespaces=%v, Pods=%v, Containers=%v (count: %d)\n",
		query.Clusters, query.Namespaces, query.Pods, query.Containers, len(query.Containers))

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
					// Send error to frontend
					stream.conn.WriteJSON(models.StreamMessage{
						Type:    "error",
						Data:    fmt.Sprintf("Failed to get pod %s/%s in cluster %s: %v", namespace, podName, cluster, err),
						EventID: generateSecureEventID(),
					})
					continue
				}

				// Test log access permissions by trying to get a single log line from first available container
				fmt.Printf("[DEBUG] Testing log access for pod %s/%s\n", namespace, podName)
				if len(pod.Spec.Containers) > 0 {
					testContainer := pod.Spec.Containers[0].Name
					// If we have container filters, use the first matching one for testing
					for _, container := range pod.Spec.Containers {
						if h.shouldIncludeContainer(container.Name, query.Containers) {
							testContainer = container.Name
							break
						}
					}

					testOpts := &corev1.PodLogOptions{
						Container: testContainer,
						TailLines: &[]int64{1}[0],
					}
					testReq := client.CoreV1().Pods(namespace).GetLogs(podName, testOpts)
					testStream, testErr := testReq.Stream(stream.ctx)
					if testErr != nil {
						fmt.Printf("[DEBUG] Log access test failed for %s/%s/%s: %v\n", namespace, podName, testContainer, testErr)
						stream.conn.WriteJSON(models.StreamMessage{
							Type:    "error",
							Data:    fmt.Sprintf("No log access permission for pod %s/%s container %s in cluster %s: %v", namespace, podName, testContainer, cluster, testErr),
							EventID: generateSecureEventID(),
						})
						continue
					} else {
						testStream.Close()
						fmt.Printf("[DEBUG] Log access test passed for %s/%s/%s\n", namespace, podName, testContainer)
					}
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

			// Add timeout context for EKS compatibility
			streamCtx, streamCancel := context.WithTimeout(stream.ctx, 60*time.Second)
			defer streamCancel()

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
			fmt.Printf("[DEBUG] Creating log stream request for %s/%s/%s with opts: %+v\n", cluster, pod, container, opts)
			logStream, err := req.Stream(streamCtx)
			fmt.Printf("[DEBUG] Stream creation result for %s/%s/%s - Error: %v\n", cluster, pod, container, err)
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
			fmt.Printf("[DEBUG] Starting to process log stream for %s/%s/%s\n", cluster, pod, container)
			lastLogTime = h.processLogStreamWithReconnect(stream, logStream, cluster, namespace, pod, container)
			fmt.Printf("[DEBUG] Log stream processing ended for %s/%s/%s, last log time: %v\n", cluster, pod, container, lastLogTime)
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
	var batch []models.LogEntry
	var batchMu sync.Mutex
	batchTicker := time.NewTicker(100 * time.Millisecond)
	defer batchTicker.Stop()

	lastLogTime := time.Now()
	batchChan := make(chan []models.LogEntry, 10)
	done := make(chan struct{})

	// Goroutine to handle batch sending
	go func() {
		defer close(done)
		for {
			select {
			case <-stream.ctx.Done():
				return
			case batchToSend, ok := <-batchChan:
				if !ok {
					return // Channel closed
				}
				h.sendLogBatch(stream, batchToSend)
			}
		}
	}()

	// Helper function to safely send batch
	sendBatch := func(entries []models.LogEntry) {
		if len(entries) == 0 {
			return
		}
		select {
		case batchChan <- entries:
			// Successfully sent
		case <-stream.ctx.Done():
			// Context cancelled, stop trying
		default:
			// Channel full, send directly to avoid blocking
			h.sendLogBatch(stream, entries)
		}
	}

	// Helper function to safely get and clear batch
	getBatchAndClear := func() []models.LogEntry {
		batchMu.Lock()
		defer batchMu.Unlock()
		if len(batch) == 0 {
			return nil
		}
		result := make([]models.LogEntry, len(batch))
		copy(result, batch)
		batch = batch[:0]
		return result
	}

	// Helper function to safely add to batch
	addToBatch := func(entry models.LogEntry) int {
		batchMu.Lock()
		defer batchMu.Unlock()
		batch = append(batch, entry)
		return len(batch)
	}

	fmt.Printf("[DEBUG] Starting scanner loop for %s/%s/%s\n", cluster, pod, container)

	// Periodic batch sending
	go func() {
		for {
			select {
			case <-stream.ctx.Done():
				return
			case <-batchTicker.C:
				if batchToSend := getBatchAndClear(); batchToSend != nil {
					sendBatch(batchToSend)
				}
			}
		}
	}()

	for scanner.Scan() {
		select {
		case <-stream.ctx.Done():
			fmt.Printf("[DEBUG] Context cancelled while scanning logs for %s/%s/%s\n", cluster, pod, container)
			// Send any remaining batch
			if batchToSend := getBatchAndClear(); batchToSend != nil {
				sendBatch(batchToSend)
			}
			close(batchChan)
			<-done
			return lastLogTime
		default:
			lineNum++
			line := scanner.Text()
			fmt.Printf("[DEBUG] Read log line %d from %s/%s/%s: %.100s\n", lineNum, cluster, pod, container, line)

			// Parse log line
			entry := h.parser.ParseLogLine(line, cluster, namespace, pod, container, lineNum)

			// Update last log time
			if !entry.Timestamp.IsZero() {
				lastLogTime = entry.Timestamp
			}

			// Apply filters
			if h.shouldIncludeLog(entry, stream.query) {
				batchSize := addToBatch(entry)

				// Send batch if it reaches size limit
				if batchSize >= 50 {
					if batchToSend := getBatchAndClear(); batchToSend != nil {
						sendBatch(batchToSend)
					}
				}
			}
		}
	}

	// Send remaining batch
	if batchToSend := getBatchAndClear(); batchToSend != nil {
		sendBatch(batchToSend)
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
	fmt.Printf("[DEBUG] shouldIncludeContainer: checking %s against filters %v (count: %d)\n", containerName, containers, len(containers))

	if len(containers) == 0 {
		// If no container filter is specified, default to common application containers
		// This helps with EKS pods that have multiple sidecar containers
		result := containerName == "app" || containerName == "main" || containerName == "application"
		fmt.Printf("[DEBUG] shouldIncludeContainer: no filters, defaulting to app containers - %s = %t\n", containerName, result)
		return result
	}

	for _, c := range containers {
		if containerName == c {
			fmt.Printf("[DEBUG] shouldIncludeContainer: %s matches filter %s = true\n", containerName, c)
			return true
		}
	}

	fmt.Printf("[DEBUG] shouldIncludeContainer: %s does not match any filter = false\n", containerName)
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
