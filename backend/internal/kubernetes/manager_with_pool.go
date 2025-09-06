package kubernetes

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prasad/kaptivan/backend/internal/kubernetes/pool"
	"k8s.io/client-go/kubernetes"
)

// ClusterManagerWithPool extends ClusterManager with connection pooling
type ClusterManagerWithPool struct {
	*ClusterManager
	connectionPool *pool.ConnectionPool
	mu             sync.RWMutex
}

// NewClusterManagerWithPool creates a new cluster manager with connection pooling
func NewClusterManagerWithPool(kubeConfigPath string, poolConfig *pool.PoolConfig) *ClusterManagerWithPool {
	if poolConfig == nil {
		poolConfig = pool.DefaultPoolConfig()
	}
	
	return &ClusterManagerWithPool{
		ClusterManager: NewClusterManager(kubeConfigPath),
		connectionPool: pool.NewConnectionPool(poolConfig),
	}
}

// GetPooledClient gets a pooled client for a cluster
func (cm *ClusterManagerWithPool) GetPooledClient(ctx context.Context, clusterName string) (kubernetes.Interface, error) {
	return cm.connectionPool.GetConnection(ctx, clusterName, cm.kubeConfigPath)
}

// GetPooledClientWithTimeout gets a pooled client with a custom timeout
func (cm *ClusterManagerWithPool) GetPooledClientWithTimeout(clusterName string, timeout time.Duration) (kubernetes.Interface, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	
	return cm.connectionPool.GetConnection(ctx, clusterName, cm.kubeConfigPath)
}

// GetPoolMetrics returns connection pool metrics
func (cm *ClusterManagerWithPool) GetPoolMetrics() pool.PoolMetricsSnapshot {
	return cm.connectionPool.GetMetrics()
}

// GetConnectionStats returns connection statistics
func (cm *ClusterManagerWithPool) GetConnectionStats() pool.ConnectionStats {
	return cm.connectionPool.GetConnectionStats()
}

// PrewarmConnections creates connections to specified clusters
func (cm *ClusterManagerWithPool) PrewarmConnections(clusterNames []string) error {
	ctx := context.Background()
	var wg sync.WaitGroup
	errCh := make(chan error, len(clusterNames))
	
	for _, cluster := range clusterNames {
		wg.Add(1)
		go func(clusterName string) {
			defer wg.Done()
			
			_, err := cm.connectionPool.GetConnection(ctx, clusterName, cm.kubeConfigPath)
			if err != nil {
				errCh <- fmt.Errorf("failed to prewarm connection to %s: %w", clusterName, err)
			}
		}(cluster)
	}
	
	wg.Wait()
	close(errCh)
	
	// Collect any errors
	var errors []error
	for err := range errCh {
		errors = append(errors, err)
	}
	
	if len(errors) > 0 {
		return fmt.Errorf("prewarm failed for %d clusters: %v", len(errors), errors)
	}
	
	return nil
}

// Close closes the connection pool
func (cm *ClusterManagerWithPool) Close() {
	cm.connectionPool.Close()
}

// HealthCheck performs health check on all pooled connections
func (cm *ClusterManagerWithPool) HealthCheck() map[string]bool {
	stats := cm.connectionPool.GetConnectionStats()
	result := make(map[string]bool)
	
	// Get all clusters from the base manager
	cm.mu.RLock()
	for name, conn := range cm.connections {
		if conn.Connected {
			result[name] = stats.HealthyConnections > 0
		}
	}
	cm.mu.RUnlock()
	
	return result
}