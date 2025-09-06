package search

import (
	"sync/atomic"
	"time"
)

// SearchMetrics tracks search performance metrics
type SearchMetrics struct {
	// Search operations
	totalSearches      uint64
	successfulSearches uint64
	failedSearches     uint64
	
	// Cache metrics
	cacheHits   uint64
	cacheMisses uint64
	
	// Index metrics
	indexedLogs uint64
	indexSize   uint64
	
	// Performance metrics
	searchLatencies []time.Duration
	maxLatency      time.Duration
	minLatency      time.Duration
	
	// Result metrics
	totalResults uint64
	avgResults   float64
}

// NewSearchMetrics creates new search metrics
func NewSearchMetrics() *SearchMetrics {
	return &SearchMetrics{
		searchLatencies: make([]time.Duration, 0, 100),
		minLatency:      time.Hour, // Start with high value
	}
}

// RecordSearch records a search operation
func (m *SearchMetrics) RecordSearch() {
	atomic.AddUint64(&m.totalSearches, 1)
}

// RecordSearchSuccess records a successful search
func (m *SearchMetrics) RecordSearchSuccess(resultCount int) {
	atomic.AddUint64(&m.successfulSearches, 1)
	atomic.AddUint64(&m.totalResults, uint64(resultCount))
	
	// Update average
	total := atomic.LoadUint64(&m.successfulSearches)
	if total > 0 {
		m.avgResults = float64(atomic.LoadUint64(&m.totalResults)) / float64(total)
	}
}

// RecordSearchError records a failed search
func (m *SearchMetrics) RecordSearchError() {
	atomic.AddUint64(&m.failedSearches, 1)
}

// RecordCacheHit records a cache hit
func (m *SearchMetrics) RecordCacheHit() {
	atomic.AddUint64(&m.cacheHits, 1)
}

// RecordCacheMiss records a cache miss
func (m *SearchMetrics) RecordCacheMiss() {
	atomic.AddUint64(&m.cacheMisses, 1)
}

// RecordIndexedLog records a newly indexed log
func (m *SearchMetrics) RecordIndexedLog() {
	atomic.AddUint64(&m.indexedLogs, 1)
}

// RecordSearchLatency records search operation latency
func (m *SearchMetrics) RecordSearchLatency(duration time.Duration) {
	m.searchLatencies = append(m.searchLatencies, duration)
	
	// Keep only last 100 latencies
	if len(m.searchLatencies) > 100 {
		m.searchLatencies = m.searchLatencies[len(m.searchLatencies)-100:]
	}
	
	// Update min/max
	if duration > m.maxLatency {
		m.maxLatency = duration
	}
	if duration < m.minLatency {
		m.minLatency = duration
	}
}

// Snapshot returns a snapshot of current metrics
func (m *SearchMetrics) Snapshot() SearchMetricsSnapshot {
	snapshot := SearchMetricsSnapshot{
		TotalSearches:      atomic.LoadUint64(&m.totalSearches),
		SuccessfulSearches: atomic.LoadUint64(&m.successfulSearches),
		FailedSearches:     atomic.LoadUint64(&m.failedSearches),
		CacheHits:          atomic.LoadUint64(&m.cacheHits),
		CacheMisses:        atomic.LoadUint64(&m.cacheMisses),
		IndexedLogs:        atomic.LoadUint64(&m.indexedLogs),
		TotalResults:       atomic.LoadUint64(&m.totalResults),
		AvgResults:         m.avgResults,
		MaxLatency:         m.maxLatency,
		MinLatency:         m.minLatency,
	}
	
	// Calculate cache hit rate
	totalCacheOps := snapshot.CacheHits + snapshot.CacheMisses
	if totalCacheOps > 0 {
		snapshot.CacheHitRate = float64(snapshot.CacheHits) / float64(totalCacheOps) * 100
	}
	
	// Calculate success rate
	if snapshot.TotalSearches > 0 {
		snapshot.SuccessRate = float64(snapshot.SuccessfulSearches) / float64(snapshot.TotalSearches) * 100
	}
	
	// Calculate average latency
	if len(m.searchLatencies) > 0 {
		var sum time.Duration
		for _, latency := range m.searchLatencies {
			sum += latency
		}
		snapshot.AvgLatency = sum / time.Duration(len(m.searchLatencies))
	}
	
	return snapshot
}

// Reset resets all metrics
func (m *SearchMetrics) Reset() {
	atomic.StoreUint64(&m.totalSearches, 0)
	atomic.StoreUint64(&m.successfulSearches, 0)
	atomic.StoreUint64(&m.failedSearches, 0)
	atomic.StoreUint64(&m.cacheHits, 0)
	atomic.StoreUint64(&m.cacheMisses, 0)
	atomic.StoreUint64(&m.indexedLogs, 0)
	atomic.StoreUint64(&m.totalResults, 0)
	m.avgResults = 0
	m.searchLatencies = m.searchLatencies[:0]
	m.maxLatency = 0
	m.minLatency = time.Hour
}

// SearchMetricsSnapshot represents a point-in-time snapshot of search metrics
type SearchMetricsSnapshot struct {
	// Search operations
	TotalSearches      uint64
	SuccessfulSearches uint64
	FailedSearches     uint64
	SuccessRate        float64
	
	// Cache metrics
	CacheHits    uint64
	CacheMisses  uint64
	CacheHitRate float64
	
	// Index metrics
	IndexedLogs uint64
	
	// Performance metrics
	AvgLatency time.Duration
	MaxLatency time.Duration
	MinLatency time.Duration
	
	// Result metrics
	TotalResults uint64
	AvgResults   float64
}