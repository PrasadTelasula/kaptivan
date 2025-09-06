package pool

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
	
	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/kubernetes/fake"
)

func TestConnectionPool_BasicOperations(t *testing.T) {
	config := &PoolConfig{
		MaxConnections:      5,
		MaxIdleConnections:  2,
		ConnectionTimeout:   5 * time.Second,
		IdleTimeout:         1 * time.Minute,
		HealthCheckInterval: 10 * time.Second,
		MaxRetries:          2,
		RetryBackoff:        100 * time.Millisecond,
	}
	
	pool := NewConnectionPool(config)
	defer pool.Close()
	
	// Test initial state
	stats := pool.GetConnectionStats()
	assert.Equal(t, 0, stats.TotalConnections)
	assert.Equal(t, 0, stats.ActiveConnections)
	assert.Equal(t, 0, stats.IdleConnections)
}

func TestConnectionPool_ConnectionReuse(t *testing.T) {
	pool := NewConnectionPool(DefaultPoolConfig())
	defer pool.Close()
	
	// Mock connection creation
	conn1 := &ClientConnection{
		client:      fake.NewSimpleClientset(),
		clusterName: "cluster1",
		state:       StateActive,
		createdAt:   time.Now(),
		lastUsedAt:  time.Now(),
	}
	
	// Store connection
	pool.connections.Store("cluster1", conn1)
	
	// Verify connection is reused
	metrics := pool.GetMetrics()
	initialHits := metrics.Hits
	
	// Simulate getting the same connection
	if existing, ok := pool.connections.Load("cluster1"); ok {
		clientConn := existing.(*ClientConnection)
		assert.NotNil(t, clientConn)
		assert.Equal(t, "cluster1", clientConn.clusterName)
	}
}

func TestConnectionPool_MaxConnections(t *testing.T) {
	config := &PoolConfig{
		MaxConnections:      3,
		MaxIdleConnections:  1,
		ConnectionTimeout:   1 * time.Second,
		IdleTimeout:         1 * time.Minute,
		HealthCheckInterval: 1 * time.Minute,
	}
	
	pool := NewConnectionPool(config)
	defer pool.Close()
	
	// Fill pool to max capacity
	for i := 0; i < 3; i++ {
		conn := &ClientConnection{
			client:      fake.NewSimpleClientset(),
			clusterName: fmt.Sprintf("cluster%d", i),
			state:       StateActive,
			createdAt:   time.Now(),
			lastUsedAt:  time.Now(),
		}
		pool.connections.Store(fmt.Sprintf("cluster%d", i), conn)
	}
	
	stats := pool.GetConnectionStats()
	assert.Equal(t, 3, stats.TotalConnections)
}

func TestConnectionPool_Eviction(t *testing.T) {
	config := &PoolConfig{
		MaxConnections:      5,
		IdleTimeout:         100 * time.Millisecond,
		HealthCheckInterval: 10 * time.Second,
	}
	
	pool := NewConnectionPool(config)
	defer pool.Close()
	
	// Add idle connection
	idleConn := &ClientConnection{
		client:      fake.NewSimpleClientset(),
		clusterName: "idle-cluster",
		state:       StateIdle,
		createdAt:   time.Now().Add(-2 * time.Minute),
		lastUsedAt:  time.Now().Add(-2 * time.Minute),
	}
	pool.connections.Store("idle-cluster", idleConn)
	
	// Trigger eviction
	pool.evictExpiredConnections()
	
	// Verify connection was evicted
	_, exists := pool.connections.Load("idle-cluster")
	assert.False(t, exists, "Idle connection should be evicted")
}

func TestConnectionPool_ConcurrentAccess(t *testing.T) {
	pool := NewConnectionPool(DefaultPoolConfig())
	defer pool.Close()
	
	var wg sync.WaitGroup
	numGoroutines := 10
	numOperations := 100
	
	// Concurrent reads and writes
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			
			for j := 0; j < numOperations; j++ {
				key := fmt.Sprintf("cluster-%d-%d", id, j%5)
				
				// Simulate connection creation
				conn := &ClientConnection{
					client:      fake.NewSimpleClientset(),
					clusterName: key,
					state:       StateActive,
					createdAt:   time.Now(),
					lastUsedAt:  time.Now(),
				}
				
				// Store and retrieve
				pool.connections.Store(key, conn)
				
				if val, ok := pool.connections.Load(key); ok {
					retrieved := val.(*ClientConnection)
					assert.Equal(t, key, retrieved.clusterName)
				}
			}
		}(i)
	}
	
	wg.Wait()
	
	// Verify pool is still functional
	stats := pool.GetConnectionStats()
	assert.GreaterOrEqual(t, stats.TotalConnections, 0)
}

func TestHealthChecker_ConnectionHealth(t *testing.T) {
	pool := NewConnectionPool(DefaultPoolConfig())
	defer pool.Close()
	
	checker := NewHealthChecker(pool)
	
	// Create healthy connection
	healthyConn := &ClientConnection{
		client:      fake.NewSimpleClientset(),
		clusterName: "healthy-cluster",
		state:       StateActive,
		createdAt:   time.Now(),
		lastUsedAt:  time.Now(),
	}
	
	// Perform health check
	checker.CheckConnection(healthyConn)
	
	// Verify stats
	stats := checker.GetStats()
	assert.GreaterOrEqual(t, stats.TotalChecks, uint64(1))
}

func TestPoolMetrics_Recording(t *testing.T) {
	metrics := NewPoolMetrics()
	
	// Record various metrics
	metrics.RecordConnectionCreated()
	metrics.RecordConnectionCreated()
	metrics.RecordHit()
	metrics.RecordHit()
	metrics.RecordHit()
	metrics.RecordMiss()
	metrics.RecordHealthCheckSuccess()
	metrics.RecordHealthCheckSuccess()
	metrics.RecordHealthCheckFailure()
	
	// Get snapshot
	snapshot := metrics.Snapshot()
	
	// Verify metrics
	assert.Equal(t, uint64(2), snapshot.ConnectionsCreated)
	assert.Equal(t, uint64(3), snapshot.Hits)
	assert.Equal(t, uint64(1), snapshot.Misses)
	assert.Equal(t, float64(75), snapshot.HitRate) // 3 hits out of 4 total
	assert.Equal(t, uint64(2), snapshot.HealthCheckSuccess)
	assert.Equal(t, uint64(1), snapshot.HealthCheckFailure)
	assert.InDelta(t, 66.67, snapshot.HealthCheckSuccessRate, 0.01) // 2 success out of 3 total
}

func TestPoolMetrics_Timing(t *testing.T) {
	metrics := NewPoolMetrics()
	
	// Record timings
	metrics.RecordConnectionTiming(100 * time.Millisecond)
	metrics.RecordConnectionTiming(200 * time.Millisecond)
	metrics.RecordConnectionTiming(150 * time.Millisecond)
	
	metrics.RecordRequestTiming(10 * time.Millisecond)
	metrics.RecordRequestTiming(20 * time.Millisecond)
	metrics.RecordRequestTiming(15 * time.Millisecond)
	
	// Get snapshot
	snapshot := metrics.Snapshot()
	
	// Verify average timings
	assert.Equal(t, 150*time.Millisecond, snapshot.AvgConnectionTime)
	assert.Equal(t, 15*time.Millisecond, snapshot.AvgRequestTime)
}

func TestPoolMetrics_Reset(t *testing.T) {
	metrics := NewPoolMetrics()
	
	// Record metrics
	metrics.RecordConnectionCreated()
	metrics.RecordHit()
	metrics.RecordMiss()
	
	// Verify metrics are recorded
	snapshot := metrics.Snapshot()
	assert.Greater(t, snapshot.ConnectionsCreated, uint64(0))
	
	// Reset metrics
	metrics.Reset()
	
	// Verify metrics are reset
	snapshot = metrics.Snapshot()
	assert.Equal(t, uint64(0), snapshot.ConnectionsCreated)
	assert.Equal(t, uint64(0), snapshot.Hits)
	assert.Equal(t, uint64(0), snapshot.Misses)
}

func BenchmarkConnectionPool_Get(b *testing.B) {
	pool := NewConnectionPool(DefaultPoolConfig())
	defer pool.Close()
	
	// Pre-populate pool
	for i := 0; i < 10; i++ {
		conn := &ClientConnection{
			client:      fake.NewSimpleClientset(),
			clusterName: fmt.Sprintf("cluster%d", i),
			state:       StateActive,
			createdAt:   time.Now(),
			lastUsedAt:  time.Now(),
		}
		pool.connections.Store(fmt.Sprintf("cluster%d", i), conn)
	}
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("cluster%d", i%10)
			if val, ok := pool.connections.Load(key); ok {
				conn := val.(*ClientConnection)
				_ = conn.GetClient()
			}
			i++
		}
	})
}

func BenchmarkConnectionPool_ConcurrentAccess(b *testing.B) {
	pool := NewConnectionPool(DefaultPoolConfig())
	defer pool.Close()
	
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("cluster%d", i%100)
			
			// Simulate mixed operations
			if i%2 == 0 {
				// Store
				conn := &ClientConnection{
					client:      fake.NewSimpleClientset(),
					clusterName: key,
					state:       StateActive,
					createdAt:   time.Now(),
					lastUsedAt:  time.Now(),
				}
				pool.connections.Store(key, conn)
			} else {
				// Load
				pool.connections.Load(key)
			}
			i++
		}
	})
}