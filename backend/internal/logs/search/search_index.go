package search

import (
	"strings"
	"sync"
	"time"
)

// SearchIndex provides fast text search using inverted index
type SearchIndex struct {
	invertedIndex map[string][]string // term -> [log IDs]
	logStore      map[string]LogEntry // log ID -> full log entry
	tokenizer     *Tokenizer
	mu            sync.RWMutex
	maxSize       int
}

// NewSearchIndex creates a new search index
func NewSearchIndex() *SearchIndex {
	return &SearchIndex{
		invertedIndex: make(map[string][]string),
		logStore:      make(map[string]LogEntry),
		tokenizer:     NewTokenizer(),
		maxSize:       10000, // Maximum number of indexed logs
	}
}

// Add indexes a log entry
func (si *SearchIndex) Add(log LogEntry) {
	si.mu.Lock()
	defer si.mu.Unlock()

	// Check size limit and evict if necessary
	if len(si.logStore) >= si.maxSize {
		si.evictOldest()
	}

	// Store the log entry
	si.logStore[log.ID] = log

	// Tokenize and index the message
	tokens := si.tokenizer.Tokenize(log.Message)
	for _, token := range tokens {
		if !si.isStopWord(token) {
			si.invertedIndex[token] = append(si.invertedIndex[token], log.ID)
		}
	}

	// Index metadata fields
	si.indexMetadata(log)
}

// Search finds logs matching the pattern
func (si *SearchIndex) Search(pattern *SearchPattern, opts SearchOptions) []SearchResult {
	si.mu.RLock()
	defer si.mu.RUnlock()

	// Get candidate log IDs
	candidateIDs := si.getCandidates(pattern, opts)
	
	// Score and rank results
	results := []SearchResult{}
	for logID := range candidateIDs {
		if log, exists := si.logStore[logID]; exists {
			if si.matchesFilters(log, opts) && pattern.Match(log.Message) {
				result := SearchResult{
					Timestamp: log.Timestamp,
					Namespace: log.Namespace,
					Pod:       log.Pod,
					Container: log.Container,
					Level:     log.Level,
					Message:   log.Message,
					Score:     si.calculateScore(log, pattern),
				}
				
				// Highlight matching text
				result.Highlighted = si.highlightMatch(log.Message, pattern)
				results = append(results, result)
			}
		}
	}

	// Sort by score and timestamp
	si.sortResults(results)
	
	return results
}

// getCandidates retrieves candidate log IDs from the index
func (si *SearchIndex) getCandidates(pattern *SearchPattern, opts SearchOptions) map[string]bool {
	candidates := make(map[string]bool)
	
	// Get tokens from query
	tokens := si.tokenizer.Tokenize(pattern.Query)
	
	// Find logs containing all tokens (AND operation)
	if len(tokens) > 0 {
		// Start with first token
		for _, logID := range si.invertedIndex[tokens[0]] {
			candidates[logID] = true
		}
		
		// Intersect with remaining tokens
		for i := 1; i < len(tokens); i++ {
			newCandidates := make(map[string]bool)
			for _, logID := range si.invertedIndex[tokens[i]] {
				if candidates[logID] {
					newCandidates[logID] = true
				}
			}
			candidates = newCandidates
		}
	} else {
		// No tokens, include all logs
		for logID := range si.logStore {
			candidates[logID] = true
		}
	}
	
	return candidates
}

// matchesFilters checks if a log entry matches the search filters
func (si *SearchIndex) matchesFilters(log LogEntry, opts SearchOptions) bool {
	// Check namespace filter
	if len(opts.Namespaces) > 0 && !contains(opts.Namespaces, log.Namespace) {
		return false
	}
	
	// Check pod filter
	if len(opts.Pods) > 0 && !contains(opts.Pods, log.Pod) {
		return false
	}
	
	// Check container filter
	if len(opts.Containers) > 0 && !contains(opts.Containers, log.Container) {
		return false
	}
	
	// Check level filter
	if len(opts.Levels) > 0 && !contains(opts.Levels, log.Level) {
		return false
	}
	
	// Check time range
	if opts.StartTime != nil && log.Timestamp.Before(*opts.StartTime) {
		return false
	}
	if opts.EndTime != nil && log.Timestamp.After(*opts.EndTime) {
		return false
	}
	
	// Check label selectors
	for key, value := range opts.LabelSelectors {
		if log.Labels[key] != value {
			return false
		}
	}
	
	return true
}

// calculateScore calculates relevance score for a log entry
func (si *SearchIndex) calculateScore(log LogEntry, pattern *SearchPattern) float64 {
	score := 0.0
	
	// Base score from match count
	matchCount := strings.Count(strings.ToLower(log.Message), strings.ToLower(pattern.Query))
	score += float64(matchCount)
	
	// Boost for exact match
	if strings.Contains(log.Message, pattern.Query) {
		score += 5.0
	}
	
	// Boost for recent logs
	age := time.Since(log.Timestamp)
	if age < time.Minute {
		score += 3.0
	} else if age < time.Hour {
		score += 1.0
	}
	
	// Boost for error/warning levels
	switch log.Level {
	case "ERROR", "error":
		score += 2.0
	case "WARNING", "warn":
		score += 1.0
	}
	
	return score
}

// highlightMatch highlights matching text in the message
func (si *SearchIndex) highlightMatch(message string, pattern *SearchPattern) string {
	if pattern.Regex != nil {
		return pattern.Regex.ReplaceAllString(message, "{{$0}}")
	}
	
	// Simple string replacement for highlighting
	highlighted := message
	if !pattern.CaseSensitive {
		// Case-insensitive highlighting
		lower := strings.ToLower(message)
		queryLower := strings.ToLower(pattern.Query)
		
		index := strings.Index(lower, queryLower)
		if index >= 0 {
			original := message[index : index+len(pattern.Query)]
			highlighted = strings.Replace(message, original, "{{"+original+"}}", -1)
		}
	} else {
		highlighted = strings.Replace(message, pattern.Query, "{{"+pattern.Query+"}}", -1)
	}
	
	return highlighted
}

// indexMetadata indexes metadata fields for faster filtering
func (si *SearchIndex) indexMetadata(log LogEntry) {
	// Index namespace
	si.invertedIndex["ns:"+log.Namespace] = append(si.invertedIndex["ns:"+log.Namespace], log.ID)
	
	// Index pod
	si.invertedIndex["pod:"+log.Pod] = append(si.invertedIndex["pod:"+log.Pod], log.ID)
	
	// Index container
	si.invertedIndex["container:"+log.Container] = append(si.invertedIndex["container:"+log.Container], log.ID)
	
	// Index level
	si.invertedIndex["level:"+log.Level] = append(si.invertedIndex["level:"+log.Level], log.ID)
}

// evictOldest removes the oldest log entries to maintain size limit
func (si *SearchIndex) evictOldest() {
	// Find oldest entry
	var oldestID string
	var oldestTime time.Time
	first := true
	
	for id, log := range si.logStore {
		if first || log.Timestamp.Before(oldestTime) {
			oldestID = id
			oldestTime = log.Timestamp
			first = false
		}
	}
	
	// Remove from store
	delete(si.logStore, oldestID)
	
	// Remove from inverted index
	for term, ids := range si.invertedIndex {
		newIDs := []string{}
		for _, id := range ids {
			if id != oldestID {
				newIDs = append(newIDs, id)
			}
		}
		if len(newIDs) > 0 {
			si.invertedIndex[term] = newIDs
		} else {
			delete(si.invertedIndex, term)
		}
	}
}

// sortResults sorts results by score and timestamp
func (si *SearchIndex) sortResults(results []SearchResult) {
	// Simple bubble sort for now (can be optimized)
	n := len(results)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			// Sort by score (descending), then by timestamp (descending)
			if results[j].Score < results[j+1].Score ||
				(results[j].Score == results[j+1].Score && results[j].Timestamp.Before(results[j+1].Timestamp)) {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}
}

// isStopWord checks if a token is a stop word
func (si *SearchIndex) isStopWord(token string) bool {
	stopWords := map[string]bool{
		"the": true, "is": true, "at": true, "on": true, "in": true,
		"a": true, "an": true, "and": true, "or": true, "but": true,
		"for": true, "with": true, "to": true, "from": true,
	}
	return stopWords[token]
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}