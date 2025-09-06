package pool

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// PoolMetrics tracks metrics for the connection pool
type PoolMetrics struct {
	// Connection metrics
	connectionsCreated   uint64
	connectionsEvicted   uint64
	connectionErrors     uint64
	reconnections        uint64
	
	// Request metrics
	hits                 uint64
	misses               uint64
	
	// Health check metrics
	healthCheckSuccess   uint64
	healthCheckFailure   uint64
	
	// Timing metrics
	connectionTimings    []time.Duration
	requestTimings       []time.Duration
	mu                   sync.RWMutex
	
	// Performance metrics
	startTime           time.Time
	lastResetTime       time.Time
}

// NewPoolMetrics creates new pool metrics
func NewPoolMetrics() *PoolMetrics {
	now := time.Now()
	return &PoolMetrics{
		startTime:     now,
		lastResetTime: now,
		connectionTimings: make([]time.Duration, 0, 100),
		requestTimings:    make([]time.Duration, 0, 1000),
	}
}

// RecordConnectionCreated records a new connection creation
func (m *PoolMetrics) RecordConnectionCreated() {
	atomic.AddUint64(&m.connectionsCreated, 1)
}

// RecordEviction records a connection eviction
func (m *PoolMetrics) RecordEviction() {
	atomic.AddUint64(&m.connectionsEvicted, 1)
}

// RecordConnectionError records a connection error
func (m *PoolMetrics) RecordConnectionError() {
	atomic.AddUint64(&m.connectionErrors, 1)
}

// RecordReconnection records a successful reconnection
func (m *PoolMetrics) RecordReconnection() {
	atomic.AddUint64(&m.reconnections, 1)
}

// RecordHit records a cache hit
func (m *PoolMetrics) RecordHit() {
	atomic.AddUint64(&m.hits, 1)
}

// RecordMiss records a cache miss
func (m *PoolMetrics) RecordMiss() {
	atomic.AddUint64(&m.misses, 1)
}

// RecordHealthCheckSuccess records successful health check
func (m *PoolMetrics) RecordHealthCheckSuccess() {
	atomic.AddUint64(&m.healthCheckSuccess, 1)
}

// RecordHealthCheckFailure records failed health check
func (m *PoolMetrics) RecordHealthCheckFailure() {
	atomic.AddUint64(&m.healthCheckFailure, 1)
}

// RecordConnectionTiming records connection establishment timing
func (m *PoolMetrics) RecordConnectionTiming(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.connectionTimings = append(m.connectionTimings, duration)
	
	// Keep only last 100 timings
	if len(m.connectionTimings) > 100 {
		m.connectionTimings = m.connectionTimings[len(m.connectionTimings)-100:]
	}
}

// RecordRequestTiming records request timing
func (m *PoolMetrics) RecordRequestTiming(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.requestTimings = append(m.requestTimings, duration)
	
	// Keep only last 1000 timings
	if len(m.requestTimings) > 1000 {
		m.requestTimings = m.requestTimings[len(m.requestTimings)-1000:]
	}
}

// Snapshot returns a snapshot of current metrics
func (m *PoolMetrics) Snapshot() PoolMetricsSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	snapshot := PoolMetricsSnapshot{
		ConnectionsCreated:   atomic.LoadUint64(&m.connectionsCreated),
		ConnectionsEvicted:   atomic.LoadUint64(&m.connectionsEvicted),
		ConnectionErrors:     atomic.LoadUint64(&m.connectionErrors),
		Reconnections:        atomic.LoadUint64(&m.reconnections),
		Hits:                 atomic.LoadUint64(&m.hits),
		Misses:               atomic.LoadUint64(&m.misses),
		HealthCheckSuccess:   atomic.LoadUint64(&m.healthCheckSuccess),
		HealthCheckFailure:   atomic.LoadUint64(&m.healthCheckFailure),
		Uptime:               time.Since(m.startTime),
		TimeSinceReset:       time.Since(m.lastResetTime),
	}
	
	// Calculate hit rate
	total := snapshot.Hits + snapshot.Misses
	if total > 0 {
		snapshot.HitRate = float64(snapshot.Hits) / float64(total) * 100
	}
	
	// Calculate health check success rate
	totalHealth := snapshot.HealthCheckSuccess + snapshot.HealthCheckFailure
	if totalHealth > 0 {
		snapshot.HealthCheckSuccessRate = float64(snapshot.HealthCheckSuccess) / float64(totalHealth) * 100
	}
	
	// Calculate average timings
	if len(m.connectionTimings) > 0 {
		var sum time.Duration
		for _, d := range m.connectionTimings {
			sum += d
		}
		snapshot.AvgConnectionTime = sum / time.Duration(len(m.connectionTimings))
	}
	
	if len(m.requestTimings) > 0 {
		var sum time.Duration
		for _, d := range m.requestTimings {
			sum += d
		}
		snapshot.AvgRequestTime = sum / time.Duration(len(m.requestTimings))
	}
	
	return snapshot
}

// Reset resets the metrics
func (m *PoolMetrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	atomic.StoreUint64(&m.connectionsCreated, 0)
	atomic.StoreUint64(&m.connectionsEvicted, 0)
	atomic.StoreUint64(&m.connectionErrors, 0)
	atomic.StoreUint64(&m.reconnections, 0)
	atomic.StoreUint64(&m.hits, 0)
	atomic.StoreUint64(&m.misses, 0)
	atomic.StoreUint64(&m.healthCheckSuccess, 0)
	atomic.StoreUint64(&m.healthCheckFailure, 0)
	
	m.connectionTimings = m.connectionTimings[:0]
	m.requestTimings = m.requestTimings[:0]
	m.lastResetTime = time.Now()
}

// PoolMetricsSnapshot represents a point-in-time snapshot of metrics
type PoolMetricsSnapshot struct {
	// Connection metrics
	ConnectionsCreated   uint64
	ConnectionsEvicted   uint64
	ConnectionErrors     uint64
	Reconnections        uint64
	
	// Request metrics
	Hits                 uint64
	Misses               uint64
	HitRate              float64
	
	// Health check metrics
	HealthCheckSuccess   uint64
	HealthCheckFailure   uint64
	HealthCheckSuccessRate float64
	
	// Timing metrics
	AvgConnectionTime    time.Duration
	AvgRequestTime       time.Duration
	
	// Runtime metrics
	Uptime               time.Duration
	TimeSinceReset       time.Duration
}

// String returns a string representation of the metrics
func (s PoolMetricsSnapshot) String() string {
	return fmt.Sprintf(`Connection Pool Metrics:
	Connections Created: %d
	Connections Evicted: %d
	Connection Errors: %d
	Reconnections: %d
	Hit Rate: %.2f%%
	Health Check Success Rate: %.2f%%
	Avg Connection Time: %v
	Avg Request Time: %v
	Uptime: %v`,
		s.ConnectionsCreated,
		s.ConnectionsEvicted,
		s.ConnectionErrors,
		s.Reconnections,
		s.HitRate,
		s.HealthCheckSuccessRate,
		s.AvgConnectionTime,
		s.AvgRequestTime,
		s.Uptime,
	)
}