package models

import (
	"time"
)

// LogEntry represents a single log entry from a pod
type LogEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	Message     string    `json:"message"`
	Level       string    `json:"level"`       // INFO, WARN, ERROR, DEBUG, TRACE
	Cluster     string    `json:"cluster"`
	Namespace   string    `json:"namespace"`
	Pod         string    `json:"pod"`
	Container   string    `json:"container"`
	Source      string    `json:"source"`      // stdout or stderr
	LineNumber  int       `json:"lineNumber"`
	Highlighted bool      `json:"highlighted"` // For search results
}

// LogQuery represents a query for fetching logs
type LogQuery struct {
	Clusters   []string  `json:"clusters" form:"clusters"`
	Namespaces []string  `json:"namespaces" form:"namespaces"`
	Pods       []string  `json:"pods" form:"pods"`
	Containers []string  `json:"containers" form:"containers"`
	StartTime  time.Time `json:"startTime" form:"startTime"`
	EndTime    time.Time `json:"endTime" form:"endTime"`
	SearchTerm string    `json:"searchTerm" form:"searchTerm"`
	LogLevels  []string  `json:"logLevels" form:"logLevels"`
	Limit      int       `json:"limit" form:"limit"`
	Tail       int       `json:"tail" form:"tail"`
	Follow     bool      `json:"follow" form:"follow"`
}

// LogResponse represents the response containing logs
type LogResponse struct {
	Logs       []LogEntry `json:"logs"`
	TotalCount int        `json:"totalCount"`
	HasMore    bool       `json:"hasMore"`
	Clusters   []string   `json:"clusters"`
	Query      LogQuery   `json:"query"`
}

// LogHistogram represents log count over time for visualization
type LogHistogram struct {
	Timestamp time.Time         `json:"timestamp"`
	Count     int               `json:"count"`
	Levels    map[string]int    `json:"levels"`
}

// LogStats represents statistics about logs
type LogStats struct {
	TotalLogs     int                    `json:"totalLogs"`
	LogsPerLevel  map[string]int         `json:"logsPerLevel"`
	LogsPerPod    map[string]int         `json:"logsPerPod"`
	ErrorRate     float64                `json:"errorRate"`
	Histogram     []LogHistogram         `json:"histogram"`
}

// StreamMessage represents a message sent over WebSocket
type StreamMessage struct {
	Type    string      `json:"type"` // log, error, stats, ping
	Data    interface{} `json:"data"`
	EventID string      `json:"eventId"`
}