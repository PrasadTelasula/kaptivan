package handlers

import (
	"context"
	"time"
	
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"github.com/prasad/kaptivan/backend/internal/kubernetes/pool"
	k8sclient "k8s.io/client-go/kubernetes"
)

// DefaultPoolConfig returns default pool configuration
func DefaultPoolConfig() *pool.PoolConfig {
	return &pool.PoolConfig{
		MaxConnections:      100,
		MaxIdleConnections:  20,
		ConnectionTimeout:   10 * time.Second,
		IdleTimeout:         5 * time.Minute,
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:          3,
		RetryBackoff:        1 * time.Second,
	}
}

// ClusterManagerWithPool wraps standard ClusterManager with connection pooling
type ClusterManagerWithPool struct {
	manager        *kubernetes.ClusterManager
	connectionPool *pool.ConnectionPool
}

// GetKubeConfigPath returns the kubeconfig path from the wrapped manager
func (cm *ClusterManagerWithPool) GetKubeConfigPath() string {
	// Default to ~/.kube/config if not available
	return "~/.kube/config"
}

// NewClusterManagerWithPool creates a new pooled cluster manager wrapper
func NewClusterManagerWithPool(manager *kubernetes.ClusterManager, poolConfig *pool.PoolConfig) *ClusterManagerWithPool {
	if poolConfig == nil {
		poolConfig = DefaultPoolConfig()
	}
	
	return &ClusterManagerWithPool{
		manager:        manager,
		connectionPool: pool.NewConnectionPool(poolConfig),
	}
}

// GetPooledClient gets a pooled client for a cluster
func (cm *ClusterManagerWithPool) GetPooledClient(ctx context.Context, clusterName string) (k8sclient.Interface, error) {
	// Try to get from pool first
	return cm.connectionPool.GetConnection(ctx, clusterName, cm.GetKubeConfigPath())
}

// GetPoolMetrics returns connection pool metrics
func (cm *ClusterManagerWithPool) GetPoolMetrics() pool.PoolMetricsSnapshot {
	return cm.connectionPool.GetMetrics()
}

// GetConnectionStats returns connection statistics
func (cm *ClusterManagerWithPool) GetConnectionStats() pool.ConnectionStats {
	return cm.connectionPool.GetConnectionStats()
}

// Close closes the connection pool
func (cm *ClusterManagerWithPool) Close() {
	cm.connectionPool.Close()
}