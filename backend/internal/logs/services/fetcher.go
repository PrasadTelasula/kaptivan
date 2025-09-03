package services

import (
	"bufio"
	"context"
	"io"
	"strings"
	
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// fetchPodLogs fetches logs from a specific pod
func (a *LogAggregator) fetchPodLogs(ctx context.Context, client kubernetes.Interface, cluster string, pod corev1.Pod, query models.LogQuery) []models.LogEntry {
	logs := make([]models.LogEntry, 0)
	
	for _, container := range pod.Spec.Containers {
		if !a.shouldIncludeContainer(container.Name, query) {
			continue
		}
		
		opts := &corev1.PodLogOptions{
			Container:  container.Name,
			Timestamps: true,
		}
		
		if query.Tail > 0 {
			tailLines := int64(query.Tail)
			opts.TailLines = &tailLines
		}
		
		if !query.StartTime.IsZero() {
			startTime := metav1.NewTime(query.StartTime)
			opts.SinceTime = &startTime
		}
		
		req := client.CoreV1().Pods(pod.Namespace).GetLogs(pod.Name, opts)
		stream, err := req.Stream(ctx)
		if err != nil {
			continue
		}
		defer stream.Close()
		
		containerLogs := a.parseLogStream(stream, cluster, pod.Namespace, pod.Name, container.Name)
		logs = append(logs, containerLogs...)
	}
	
	return logs
}

// parseLogStream parses log stream into log entries
func (a *LogAggregator) parseLogStream(stream io.ReadCloser, cluster, namespace, pod, container string) []models.LogEntry {
	logs := make([]models.LogEntry, 0)
	scanner := bufio.NewScanner(stream)
	lineNum := 0
	
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		
		// Skip empty lines
		if strings.TrimSpace(line) == "" {
			continue
		}
		
		entry := a.parser.ParseLogLine(line, cluster, namespace, pod, container, lineNum)
		logs = append(logs, entry)
	}
	
	return logs
}

// shouldIncludePod checks if pod should be included based on query
func (a *LogAggregator) shouldIncludePod(pod corev1.Pod, query models.LogQuery) bool {
	// Check if specific pods are requested
	if len(query.Pods) > 0 {
		found := false
		for _, p := range query.Pods {
			if pod.Name == p || strings.Contains(pod.Name, p) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	
	// Skip pods that are not running
	if pod.Status.Phase != corev1.PodRunning && pod.Status.Phase != corev1.PodSucceeded {
		return false
	}
	
	return true
}

// shouldIncludeContainer checks if container should be included
func (a *LogAggregator) shouldIncludeContainer(containerName string, query models.LogQuery) bool {
	if len(query.Containers) == 0 {
		return true
	}
	
	for _, c := range query.Containers {
		if containerName == c {
			return true
		}
	}
	
	return false
}

// applyFilters applies all filters to log entries
func (a *LogAggregator) applyFilters(logs []models.LogEntry, query models.LogQuery) []models.LogEntry {
	// Apply log level filter
	if len(query.LogLevels) > 0 {
		logs = a.filter.ByLevel(logs, query.LogLevels)
	}
	
	// Apply search term filter
	if query.SearchTerm != "" {
		logs = a.filter.BySearchTerm(logs, query.SearchTerm)
	}
	
	// Apply time range filter
	if !query.StartTime.IsZero() || !query.EndTime.IsZero() {
		filtered := make([]models.LogEntry, 0)
		for _, log := range logs {
			if !query.StartTime.IsZero() && log.Timestamp.Before(query.StartTime) {
				continue
			}
			if !query.EndTime.IsZero() && log.Timestamp.After(query.EndTime) {
				continue
			}
			filtered = append(filtered, log)
		}
		logs = filtered
	}
	
	return logs
}