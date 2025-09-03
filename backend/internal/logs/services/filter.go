package services

import (
	"strings"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
)

// LogFilter provides filtering capabilities for log entries
type LogFilter struct{}

// NewLogFilter creates a new log filter
func NewLogFilter() *LogFilter {
	return &LogFilter{}
}

// ByLevel filters log entries by log level
func (f *LogFilter) ByLevel(entries []models.LogEntry, levels []string) []models.LogEntry {
	if len(levels) == 0 {
		return entries
	}

	levelMap := make(map[string]bool)
	for _, level := range levels {
		levelMap[strings.ToUpper(level)] = true
	}

	filtered := make([]models.LogEntry, 0)
	for _, entry := range entries {
		if levelMap[entry.Level] {
			filtered = append(filtered, entry)
		}
	}

	return filtered
}

// BySearchTerm filters log entries by search term
func (f *LogFilter) BySearchTerm(entries []models.LogEntry, searchTerm string) []models.LogEntry {
	if searchTerm == "" {
		return entries
	}

	searchLower := strings.ToLower(searchTerm)
	filtered := make([]models.LogEntry, 0)
	
	for _, entry := range entries {
		if strings.Contains(strings.ToLower(entry.Message), searchLower) {
			entry.Highlighted = true
			filtered = append(filtered, entry)
		}
	}

	return filtered
}

// ByPod filters log entries by pod names
func (f *LogFilter) ByPod(entries []models.LogEntry, pods []string) []models.LogEntry {
	if len(pods) == 0 {
		return entries
	}

	podMap := make(map[string]bool)
	for _, pod := range pods {
		podMap[pod] = true
	}

	filtered := make([]models.LogEntry, 0)
	for _, entry := range entries {
		if podMap[entry.Pod] {
			filtered = append(filtered, entry)
		}
	}

	return filtered
}

// ByNamespace filters log entries by namespace
func (f *LogFilter) ByNamespace(entries []models.LogEntry, namespaces []string) []models.LogEntry {
	if len(namespaces) == 0 {
		return entries
	}

	nsMap := make(map[string]bool)
	for _, ns := range namespaces {
		nsMap[ns] = true
	}

	filtered := make([]models.LogEntry, 0)
	for _, entry := range entries {
		if nsMap[entry.Namespace] {
			filtered = append(filtered, entry)
		}
	}

	return filtered
}