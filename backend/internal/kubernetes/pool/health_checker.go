package pool

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// HealthChecker performs health checks on connections
type HealthChecker struct {
	pool              *ConnectionPool
	checkTimeout      time.Duration
	maxConcurrent     int
	semaphore         chan struct{}
	healthCheckCount  uint64
	failedCheckCount  uint64
	mu                sync.RWMutex
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(pool *ConnectionPool) *HealthChecker {
	return &HealthChecker{
		pool:          pool,
		checkTimeout:  5 * time.Second,
		maxConcurrent: 10, // Max concurrent health checks
		semaphore:     make(chan struct{}, 10),
	}
}

// CheckConnection performs a health check on a connection
func (h *HealthChecker) CheckConnection(conn *ClientConnection) {
	// Acquire semaphore to limit concurrent checks
	h.semaphore <- struct{}{}
	defer func() { <-h.semaphore }()
	
	atomic.AddUint64(&h.healthCheckCount, 1)
	
	ctx, cancel := context.WithTimeout(context.Background(), h.checkTimeout)
	defer cancel()
	
	// Perform health check by listing namespaces (lightweight operation)
	_, err := conn.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		Limit: 1,
	})
	
	conn.mu.Lock()
	defer conn.mu.Unlock()
	
	conn.lastHealthCheck = time.Now()
	
	if err != nil {
		atomic.AddUint64(&h.failedCheckCount, 1)
		conn.state = StateUnhealthy
		atomic.AddUint32(&conn.errorCount, 1)
		h.pool.metrics.RecordHealthCheckFailure()
		
		// Try to reconnect if unhealthy
		go h.attemptReconnection(conn)
	} else {
		// Update state based on usage
		if time.Since(conn.lastUsedAt) > h.pool.config.IdleTimeout/2 {
			if conn.state != StateIdle {
				conn.state = StateIdle
				atomic.AddInt32(&h.pool.activeConnections, -1)
				atomic.AddInt32(&h.pool.idleConnections, 1)
			}
		} else {
			if conn.state != StateActive {
				conn.state = StateActive
				atomic.AddInt32(&h.pool.idleConnections, -1)
				atomic.AddInt32(&h.pool.activeConnections, 1)
			}
		}
		h.pool.metrics.RecordHealthCheckSuccess()
	}
}

// attemptReconnection tries to reconnect an unhealthy connection
func (h *HealthChecker) attemptReconnection(conn *ClientConnection) {
	// Wait before attempting reconnection
	time.Sleep(h.pool.config.RetryBackoff)
	
	ctx, cancel := context.WithTimeout(context.Background(), h.pool.config.ConnectionTimeout)
	defer cancel()
	
	// Test the existing client
	_, err := conn.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		Limit: 1,
	})
	
	if err == nil {
		// Connection recovered
		conn.mu.Lock()
		conn.state = StateActive
		conn.errorCount = 0
		conn.mu.Unlock()
		
		atomic.AddInt32(&h.pool.activeConnections, 1)
		h.pool.metrics.RecordReconnection()
	}
}

// GetStats returns health check statistics
func (h *HealthChecker) GetStats() HealthCheckStats {
	return HealthCheckStats{
		TotalChecks:  atomic.LoadUint64(&h.healthCheckCount),
		FailedChecks: atomic.LoadUint64(&h.failedCheckCount),
		SuccessRate:  h.calculateSuccessRate(),
	}
}

// calculateSuccessRate calculates the success rate of health checks
func (h *HealthChecker) calculateSuccessRate() float64 {
	total := atomic.LoadUint64(&h.healthCheckCount)
	if total == 0 {
		return 100.0
	}
	
	failed := atomic.LoadUint64(&h.failedCheckCount)
	return float64(total-failed) / float64(total) * 100
}

// HealthCheckStats holds health check statistics
type HealthCheckStats struct {
	TotalChecks  uint64
	FailedChecks uint64
	SuccessRate  float64
}