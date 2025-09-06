package search

import (
	"regexp"
	"strings"
	"unicode"
)

// Tokenizer handles text tokenization for search indexing
type Tokenizer struct {
	wordRegex *regexp.Regexp
	minLength int
	maxLength int
}

// NewTokenizer creates a new tokenizer
func NewTokenizer() *Tokenizer {
	return &Tokenizer{
		wordRegex: regexp.MustCompile(`\b[\w\-\.]+\b`),
		minLength: 2,
		maxLength: 50,
	}
}

// Tokenize splits text into searchable tokens
func (t *Tokenizer) Tokenize(text string) []string {
	tokens := []string{}
	
	// Convert to lowercase for indexing
	text = strings.ToLower(text)
	
	// Extract words
	matches := t.wordRegex.FindAllString(text, -1)
	for _, match := range matches {
		// Filter by length
		if len(match) >= t.minLength && len(match) <= t.maxLength {
			// Clean token
			token := t.cleanToken(match)
			if token != "" {
				tokens = append(tokens, token)
			}
		}
	}
	
	// Extract special patterns
	tokens = append(tokens, t.extractPatterns(text)...)
	
	return t.deduplicateTokens(tokens)
}

// cleanToken removes unwanted characters from a token
func (t *Tokenizer) cleanToken(token string) string {
	// Trim spaces and special characters
	token = strings.TrimFunc(token, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_'
	})
	
	return token
}

// extractPatterns extracts special patterns like IPs, UUIDs, etc.
func (t *Tokenizer) extractPatterns(text string) []string {
	patterns := []string{}
	
	// IP addresses
	ipRegex := regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	patterns = append(patterns, ipRegex.FindAllString(text, -1)...)
	
	// Kubernetes resource names (namespace/name format)
	k8sRegex := regexp.MustCompile(`\b[\w\-]+/[\w\-]+\b`)
	patterns = append(patterns, k8sRegex.FindAllString(text, -1)...)
	
	// UUIDs
	uuidRegex := regexp.MustCompile(`[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
	patterns = append(patterns, uuidRegex.FindAllString(text, -1)...)
	
	// Error codes (e.g., HTTP status codes, error codes)
	errorRegex := regexp.MustCompile(`\b(?:error|err|code|status)[:\s]*(\d{3,5})\b`)
	if matches := errorRegex.FindAllStringSubmatch(text, -1); matches != nil {
		for _, match := range matches {
			if len(match) > 1 {
				patterns = append(patterns, "error:"+match[1])
			}
		}
	}
	
	return patterns
}

// deduplicateTokens removes duplicate tokens
func (t *Tokenizer) deduplicateTokens(tokens []string) []string {
	seen := make(map[string]bool)
	unique := []string{}
	
	for _, token := range tokens {
		if !seen[token] {
			seen[token] = true
			unique = append(unique, token)
		}
	}
	
	return unique
}