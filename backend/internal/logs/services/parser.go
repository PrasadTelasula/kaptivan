package services

import (
	"time"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
)

// LogParser parses raw log lines into structured LogEntry objects
type LogParser struct {
	patterns  *LogPatterns
	timestamp *TimestampParser
}

// NewLogParser creates a new log parser
func NewLogParser() *LogParser {
	return &LogParser{
		patterns:  NewLogPatterns(),
		timestamp: NewTimestampParser(),
	}
}

// ParseLogLine parses a raw log line into a LogEntry
func (p *LogParser) ParseLogLine(line string, cluster, namespace, pod, container string, lineNum int) models.LogEntry {
	entry := models.LogEntry{
		Message:    line,
		Cluster:    cluster,
		Namespace:  namespace,
		Pod:        pod,
		Container:  container,
		LineNumber: lineNum,
		Source:     "stdout",
		Timestamp:  time.Now(),
	}

	// Extract timestamp
	entry.Timestamp = p.timestamp.ExtractTimestamp(line, []*LogPatterns{p.patterns})

	// Extract log level
	entry.Level = p.patterns.ExtractLogLevel(line)

	// Determine source (stderr typically for errors)
	if entry.Level == "ERROR" || entry.Level == "FATAL" {
		entry.Source = "stderr"
	}

	return entry
}