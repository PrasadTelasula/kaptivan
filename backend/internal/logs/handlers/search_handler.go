package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	"github.com/prasad/kaptivan/backend/internal/logs/search"
	corev1 "k8s.io/api/core/v1"
)

// SearchHandler handles log search operations with optimization
type SearchHandler struct {
	clusterManager *ClusterManagerWithPool
	searchEngine   *search.SearchEngine
	wsUpgrader     websocket.Upgrader
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(manager *ClusterManagerWithPool) *SearchHandler {
	return &SearchHandler{
		clusterManager: manager,
		searchEngine:   search.NewSearchEngine(),
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins in development
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024 * 10, // Larger write buffer for batch sending
		},
	}
}

// HandleSearchLogs handles optimized log search requests
func (h *SearchHandler) HandleSearchLogs(c *gin.Context) {
	// Parse search options from query parameters
	opts := h.parseSearchOptions(c)
	
	// Upgrade to WebSocket
	conn, err := h.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade to WebSocket"})
		return
	}
	defer conn.Close()
	
	// Set up channels for communication
	searchCh := make(chan search.LogEntry, 1000)
	errorCh := make(chan error, 1)
	done := make(chan struct{})
	
	// Start search goroutine
	go h.performSearch(c.Request.Context(), opts, searchCh, errorCh, done)
	
	// Batch processor for sending results
	batchSize := 50
	batchInterval := 100 * time.Millisecond
	batch := make([]search.SearchResult, 0, batchSize)
	ticker := time.NewTicker(batchInterval)
	defer ticker.Stop()
	
	for {
		select {
		case log := <-searchCh:
			// Index the log for future searches
			h.searchEngine.IndexLog(log)
			
			// Perform search on the log
			result := h.searchLog(log, opts)
			if result != nil {
				batch = append(batch, *result)
				
				// Send batch if full
				if len(batch) >= batchSize {
					h.sendBatch(conn, batch)
					batch = batch[:0]
				}
			}
			
		case <-ticker.C:
			// Send partial batch on interval
			if len(batch) > 0 {
				h.sendBatch(conn, batch)
				batch = batch[:0]
			}
			
		case err := <-errorCh:
			// Send error message
			msg := models.StreamMessage{
				Type:    "error",
				Data:    err.Error(),
				EventID: generateSecureEventID(),
			}
			conn.WriteJSON(msg)
			
		case <-done:
			// Send final batch
			if len(batch) > 0 {
				h.sendBatch(conn, batch)
			}
			
			// Send completion message with metrics
			metrics := h.searchEngine.GetMetrics()
			msg := models.StreamMessage{
				Type: "complete",
				Data: map[string]interface{}{
					"metrics": metrics,
				},
				EventID: generateSecureEventID(),
			}
			conn.WriteJSON(msg)
			return
		}
	}
}

// parseSearchOptions parses search options from request
func (h *SearchHandler) parseSearchOptions(c *gin.Context) search.SearchOptions {
	opts := search.SearchOptions{
		Query:          c.Query("query"),
		Regex:          c.Query("regex") == "true",
		CaseSensitive:  c.Query("caseSensitive") == "true",
		FieldSelectors: make(map[string]string),
		LabelSelectors: make(map[string]string),
	}
	
	// Parse arrays
	if ns := c.QueryArray("namespaces[]"); len(ns) > 0 {
		opts.Namespaces = ns
	}
	if pods := c.QueryArray("pods[]"); len(pods) > 0 {
		opts.Pods = pods
	}
	if containers := c.QueryArray("containers[]"); len(containers) > 0 {
		opts.Containers = containers
	}
	if levels := c.QueryArray("levels[]"); len(levels) > 0 {
		opts.Levels = levels
	}
	
	// Parse limit
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			opts.Limit = limit
		} else {
			opts.Limit = 100
		}
	} else {
		opts.Limit = 100
	}
	
	// Parse time range
	if startStr := c.Query("startTime"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			opts.StartTime = &t
		}
	}
	if endStr := c.Query("endTime"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			opts.EndTime = &t
		}
	}
	
	// Parse field selectors
	for key, values := range c.Request.URL.Query() {
		if len(key) > 6 && key[:6] == "field." {
			fieldName := key[6:]
			if len(values) > 0 {
				opts.FieldSelectors[fieldName] = values[0]
			}
		}
	}
	
	// Parse label selectors
	for key, values := range c.Request.URL.Query() {
		if len(key) > 6 && key[:6] == "label." {
			labelName := key[6:]
			if len(values) > 0 {
				opts.LabelSelectors[labelName] = values[0]
			}
		}
	}
	
	// Optimize the query
	opts = search.OptimizeQuery(opts)
	
	return opts
}

// performSearch performs the actual search operation
func (h *SearchHandler) performSearch(ctx context.Context, opts search.SearchOptions, searchCh chan<- search.LogEntry, errorCh chan<- error, done chan<- struct{}) {
	defer close(done)
	
	// Build Kubernetes field selectors
	builder := search.NewFieldSelectorBuilder()
	listOpts := builder.CreateListOptions(opts)
	
	// Get clients for specified namespaces
	// For now, use default cluster
	client, err := h.clusterManager.GetPooledClient(ctx, "default")
	if err != nil {
		errorCh <- err
		return
	}
	
	// List pods with field selectors
	pods, err := client.CoreV1().Pods("").List(ctx, listOpts)
	if err != nil {
		errorCh <- err
		return
	}
	
	// Stream logs from matching pods
	for _, pod := range pods.Items {
		// Check if pod matches search criteria
		if !h.matchesPod(&pod, opts) {
			continue
		}
		
		// Stream logs from each container
		for _, container := range pod.Spec.Containers {
			if len(opts.Containers) > 0 && !contains(opts.Containers, container.Name) {
				continue
			}
			
			// Stream container logs
			// TODO: Implement streamContainerLogs
		}
	}
}

// matchesPod checks if a pod matches search criteria
func (h *SearchHandler) matchesPod(pod *corev1.Pod, opts search.SearchOptions) bool {
	// Check namespace
	if len(opts.Namespaces) > 0 && !contains(opts.Namespaces, pod.Namespace) {
		return false
	}
	
	// Check pod name
	if len(opts.Pods) > 0 {
		matched := false
		for _, podPattern := range opts.Pods {
			if strings.Contains(podPattern, "*") {
				// Wildcard matching
				pattern := strings.ReplaceAll(podPattern, "*", "")
				if strings.Contains(pod.Name, pattern) {
					matched = true
					break
				}
			} else if pod.Name == podPattern {
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

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// searchLog applies search to a log entry
func (h *SearchHandler) searchLog(log search.LogEntry, opts search.SearchOptions) *search.SearchResult {
	// Quick filter checks before full search
	if len(opts.Namespaces) > 0 && !contains(opts.Namespaces, log.Namespace) {
		return nil
	}
	if len(opts.Pods) > 0 && !contains(opts.Pods, log.Pod) {
		return nil
	}
	if len(opts.Levels) > 0 && !contains(opts.Levels, log.Level) {
		return nil
	}
	
	// Perform pattern matching
	if opts.Query == "" {
		return nil
	}
	
	pattern := &search.SearchPattern{
		Query:         opts.Query,
		CaseSensitive: opts.CaseSensitive,
	}
	
	if !pattern.Match(log.Message) {
		return nil
	}
	
	// Create search result
	result := &search.SearchResult{
		Timestamp: log.Timestamp,
		Namespace: log.Namespace,
		Pod:       log.Pod,
		Container: log.Container,
		Level:     log.Level,
		Message:   log.Message,
	}
	
	return result
}

// sendBatch sends a batch of results over WebSocket
func (h *SearchHandler) sendBatch(conn *websocket.Conn, batch []search.SearchResult) {
	msg := models.StreamMessage{
		Type: "batch",
		Data: batch,
	}
	
	if err := conn.WriteJSON(msg); err != nil {
		// Log error but don't stop processing
		println("Error sending batch:", err.Error())
	}
}

// GetSearchMetrics returns current search metrics
func (h *SearchHandler) GetSearchMetrics(c *gin.Context) {
	metrics := h.searchEngine.GetMetrics()
	c.JSON(http.StatusOK, gin.H{
		"metrics": metrics,
	})
}

// ClearSearchCache clears the search cache
func (h *SearchHandler) ClearSearchCache(c *gin.Context) {
	h.searchEngine.ClearCache()
	c.JSON(http.StatusOK, gin.H{
		"message": "Search cache cleared",
	})
}