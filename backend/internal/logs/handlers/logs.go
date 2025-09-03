package handlers

import (
	"net/http"
	"strconv"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	"github.com/prasad/kaptivan/backend/internal/logs/services"
)

// LogsHandler handles log-related HTTP requests
type LogsHandler struct {
	aggregator *services.LogAggregator
}

// NewLogsHandler creates a new logs handler
func NewLogsHandler(manager *kubernetes.ClusterManager) *LogsHandler {
	return &LogsHandler{
		aggregator: services.NewLogAggregator(manager),
	}
}

// GetLogs handles GET /api/logs request
func (h *LogsHandler) GetLogs(c *gin.Context) {
	query := models.LogQuery{
		Clusters:   c.QueryArray("clusters"),
		Namespaces: c.QueryArray("namespaces"),
		Pods:       c.QueryArray("pods"),
		Containers: c.QueryArray("containers"),
		LogLevels:  c.QueryArray("logLevels"),
		SearchTerm: c.Query("searchTerm"),
	}
	
	// Parse numeric parameters
	if limit := c.Query("limit"); limit != "" {
		if val, err := strconv.Atoi(limit); err == nil {
			query.Limit = val
		}
	}
	
	if tail := c.Query("tail"); tail != "" {
		if val, err := strconv.Atoi(tail); err == nil {
			query.Tail = val
		}
	}
	
	// Set defaults
	if query.Limit == 0 {
		query.Limit = 1000
	}
	
	// Parse time range if provided
	if startTime := c.Query("startTime"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			query.StartTime = t
		}
	}
	
	if endTime := c.Query("endTime"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			query.EndTime = t
		}
	}
	
	// Fetch logs
	response, err := h.aggregator.FetchLogs(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, response)
}

// SearchLogs handles POST /api/logs/search request
func (h *LogsHandler) SearchLogs(c *gin.Context) {
	var query models.LogQuery
	
	if err := c.ShouldBindJSON(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Set defaults
	if query.Limit == 0 {
		query.Limit = 1000
	}
	
	// Fetch logs
	response, err := h.aggregator.FetchLogs(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, response)
}