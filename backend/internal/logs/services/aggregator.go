package services

import (
	"context"
	"sort"
	"sync"
	
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"github.com/prasad/kaptivan/backend/internal/logs/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LogAggregator aggregates logs from multiple clusters
type LogAggregator struct {
	parser  *LogParser
	filter  *LogFilter
	manager *kubernetes.ClusterManager
}

// NewLogAggregator creates a new log aggregator
func NewLogAggregator(manager *kubernetes.ClusterManager) *LogAggregator {
	return &LogAggregator{
		parser:  NewLogParser(),
		filter:  NewLogFilter(),
		manager: manager,
	}
}

// FetchLogs fetches logs from multiple clusters in parallel
func (a *LogAggregator) FetchLogs(ctx context.Context, query models.LogQuery) (*models.LogResponse, error) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	allLogs := make([]models.LogEntry, 0)
	
	// Fetch from each cluster in parallel
	for _, cluster := range query.Clusters {
		wg.Add(1)
		go func(clusterName string) {
			defer wg.Done()
			
			logs, err := a.fetchClusterLogs(ctx, clusterName, query)
			if err != nil {
				return // Log error but continue
			}
			
			mu.Lock()
			allLogs = append(allLogs, logs...)
			mu.Unlock()
		}(cluster)
	}
	
	wg.Wait()
	
	// Sort by timestamp
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].Timestamp.After(allLogs[j].Timestamp)
	})
	
	// Apply filters
	allLogs = a.applyFilters(allLogs, query)
	
	// Apply limit
	if query.Limit > 0 && len(allLogs) > query.Limit {
		allLogs = allLogs[:query.Limit]
	}
	
	return &models.LogResponse{
		Logs:       allLogs,
		TotalCount: len(allLogs),
		HasMore:    false,
		Clusters:   query.Clusters,
		Query:      query,
	}, nil
}

// fetchClusterLogs fetches logs from a single cluster
func (a *LogAggregator) fetchClusterLogs(ctx context.Context, cluster string, query models.LogQuery) ([]models.LogEntry, error) {
	client, err := a.manager.GetClientset(cluster)
	if err != nil {
		return nil, err
	}
	
	logs := make([]models.LogEntry, 0)
	
	// Fetch pods based on query
	for _, ns := range query.Namespaces {
		pods, err := client.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}
		
		for _, pod := range pods.Items {
			if !a.shouldIncludePod(pod, query) {
				continue
			}
			
			podLogs := a.fetchPodLogs(ctx, client, cluster, pod, query)
			logs = append(logs, podLogs...)
		}
	}
	
	return logs, nil
}