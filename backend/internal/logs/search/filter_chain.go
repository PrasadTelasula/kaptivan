package search

import (
	"regexp"
	"strings"
	"sync"
)

// FilterChain applies multiple filters in sequence
type FilterChain struct {
	filters []Filter
	mu      sync.RWMutex
}

// Filter interface for log filters
type Filter interface {
	Apply(result SearchResult, opts SearchOptions) bool
	Priority() int
}

// NewFilterChain creates a new filter chain
func NewFilterChain() *FilterChain {
	fc := &FilterChain{
		filters: []Filter{},
	}
	
	// Add default filters in priority order
	fc.AddFilter(&NamespaceFilter{})
	fc.AddFilter(&PodFilter{})
	fc.AddFilter(&LevelFilter{})
	fc.AddFilter(&TimeRangeFilter{})
	
	return fc
}

// AddFilter adds a filter to the chain
func (fc *FilterChain) AddFilter(filter Filter) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	
	fc.filters = append(fc.filters, filter)
	// Sort by priority
	fc.sortFilters()
}

// Apply runs all filters on a result
func (fc *FilterChain) Apply(result SearchResult, opts SearchOptions) bool {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	
	for _, filter := range fc.filters {
		if !filter.Apply(result, opts) {
			return false
		}
	}
	return true
}

// sortFilters sorts filters by priority
func (fc *FilterChain) sortFilters() {
	// Simple bubble sort for small number of filters
	n := len(fc.filters)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if fc.filters[j].Priority() > fc.filters[j+1].Priority() {
				fc.filters[j], fc.filters[j+1] = fc.filters[j+1], fc.filters[j]
			}
		}
	}
}

// NamespaceFilter filters by namespace
type NamespaceFilter struct{}

func (f *NamespaceFilter) Apply(result SearchResult, opts SearchOptions) bool {
	if len(opts.Namespaces) == 0 {
		return true
	}
	return contains(opts.Namespaces, result.Namespace)
}

func (f *NamespaceFilter) Priority() int {
	return 1
}

// PodFilter filters by pod name
type PodFilter struct{}

func (f *PodFilter) Apply(result SearchResult, opts SearchOptions) bool {
	if len(opts.Pods) == 0 {
		return true
	}
	
	// Support wildcard matching
	for _, podPattern := range opts.Pods {
		if strings.Contains(podPattern, "*") {
			pattern := strings.ReplaceAll(podPattern, "*", ".*")
			if matched, _ := regexp.MatchString(pattern, result.Pod); matched {
				return true
			}
		} else if result.Pod == podPattern {
			return true
		}
	}
	return false
}

func (f *PodFilter) Priority() int {
	return 2
}

// LevelFilter filters by log level
type LevelFilter struct{}

func (f *LevelFilter) Apply(result SearchResult, opts SearchOptions) bool {
	if len(opts.Levels) == 0 {
		return true
	}
	
	// Normalize level for comparison
	normalizedLevel := strings.ToUpper(result.Level)
	for _, level := range opts.Levels {
		if strings.ToUpper(level) == normalizedLevel {
			return true
		}
	}
	return false
}

func (f *LevelFilter) Priority() int {
	return 3
}

// TimeRangeFilter filters by time range
type TimeRangeFilter struct{}

func (f *TimeRangeFilter) Apply(result SearchResult, opts SearchOptions) bool {
	if opts.StartTime != nil && result.Timestamp.Before(*opts.StartTime) {
		return false
	}
	if opts.EndTime != nil && result.Timestamp.After(*opts.EndTime) {
		return false
	}
	return true
}

func (f *TimeRangeFilter) Priority() int {
	return 0 // Highest priority - fail fast
}