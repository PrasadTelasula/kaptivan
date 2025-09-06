package search

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

// SearchEngine provides optimized log search capabilities
type SearchEngine struct {
	index       *SearchIndex
	cache       *SearchCache
	filters     *FilterChain
	mu          sync.RWMutex
	metrics     *SearchMetrics
}

// NewSearchEngine creates a new search engine
func NewSearchEngine() *SearchEngine {
	return &SearchEngine{
		index:   NewSearchIndex(),
		cache:   NewSearchCache(1000, 5*time.Minute),
		filters: NewFilterChain(),
		metrics: NewSearchMetrics(),
	}
}

// SearchOptions defines search parameters
type SearchOptions struct {
	Query          string
	Namespaces     []string
	Pods           []string
	Containers     []string
	Levels         []string
	StartTime      *time.Time
	EndTime        *time.Time
	Regex          bool
	CaseSensitive  bool
	Limit          int
	FieldSelectors map[string]string
	LabelSelectors map[string]string
}

// SearchResult represents a single search result
type SearchResult struct {
	Timestamp   time.Time
	Namespace   string
	Pod         string
	Container   string
	Level       string
	Message     string
	Highlighted string
	Score       float64
}

// Search performs an optimized search across logs
func (se *SearchEngine) Search(ctx context.Context, opts SearchOptions) ([]SearchResult, error) {
	start := time.Now()
	defer func() {
		se.metrics.RecordSearchLatency(time.Since(start))
	}()

	// Check cache first
	cacheKey := se.generateCacheKey(opts)
	if cached, found := se.cache.Get(cacheKey); found {
		se.metrics.RecordCacheHit()
		return cached.([]SearchResult), nil
	}
	se.metrics.RecordCacheMiss()

	// Apply filters in order of efficiency
	results := []SearchResult{}
	
	// Build query pattern
	pattern, err := se.buildSearchPattern(opts)
	if err != nil {
		se.metrics.RecordSearchError()
		return nil, fmt.Errorf("invalid search pattern: %w", err)
	}

	// Search through index
	matches := se.index.Search(pattern, opts)
	
	// Apply post-processing filters
	for _, match := range matches {
		if se.filters.Apply(match, opts) {
			results = append(results, match)
			if opts.Limit > 0 && len(results) >= opts.Limit {
				break
			}
		}
	}

	// Cache results
	se.cache.Set(cacheKey, results, 5*time.Minute)
	se.metrics.RecordSearchSuccess(len(results))

	return results, nil
}

// buildSearchPattern creates an optimized search pattern
func (se *SearchEngine) buildSearchPattern(opts SearchOptions) (*SearchPattern, error) {
	pattern := &SearchPattern{
		Query:         opts.Query,
		CaseSensitive: opts.CaseSensitive,
	}

	if opts.Regex {
		regex, err := regexp.Compile(opts.Query)
		if err != nil {
			return nil, err
		}
		pattern.Regex = regex
	} else {
		// Convert to optimized text search
		if !opts.CaseSensitive {
			pattern.Query = strings.ToLower(opts.Query)
		}
	}

	return pattern, nil
}

// generateCacheKey creates a unique cache key for search options
func (se *SearchEngine) generateCacheKey(opts SearchOptions) string {
	parts := []string{
		opts.Query,
		strings.Join(opts.Namespaces, ","),
		strings.Join(opts.Pods, ","),
		strings.Join(opts.Containers, ","),
		strings.Join(opts.Levels, ","),
	}
	
	if opts.StartTime != nil {
		parts = append(parts, opts.StartTime.Format(time.RFC3339))
	}
	if opts.EndTime != nil {
		parts = append(parts, opts.EndTime.Format(time.RFC3339))
	}
	
	return strings.Join(parts, "|")
}

// IndexLog adds a log entry to the search index
func (se *SearchEngine) IndexLog(log LogEntry) {
	se.index.Add(log)
	se.metrics.RecordIndexedLog()
}

// ClearCache clears the search cache
func (se *SearchEngine) ClearCache() {
	se.cache.Clear()
}

// GetMetrics returns search engine metrics
func (se *SearchEngine) GetMetrics() SearchMetricsSnapshot {
	return se.metrics.Snapshot()
}

// LogEntry represents a log entry for indexing
type LogEntry struct {
	ID        string
	Timestamp time.Time
	Namespace string
	Pod       string
	Container string
	Level     string
	Message   string
	Labels    map[string]string
}

// SearchPattern defines a compiled search pattern
type SearchPattern struct {
	Query         string
	Regex         *regexp.Regexp
	CaseSensitive bool
}

// Match checks if a log entry matches the pattern
func (sp *SearchPattern) Match(text string) bool {
	if sp.Regex != nil {
		return sp.Regex.MatchString(text)
	}
	
	if !sp.CaseSensitive {
		text = strings.ToLower(text)
	}
	
	return strings.Contains(text, sp.Query)
}