package kubernetes

import (
	"net/url"
	"strings"
)

// normalizeContextName normalizes a context name to handle both encoded and decoded formats
// This helps match contexts regardless of how they were sent from the frontend
func normalizeContextName(context string) string {
	// First, try to decode if it's URL encoded
	decoded, err := url.QueryUnescape(context)
	if err != nil {
		// If decoding fails, use the original
		return context
	}
	return decoded
}

// findContextCaseInsensitive finds a context by name, handling various formats
// This is useful for matching EKS ARN contexts that might be formatted differently
// Note: This function assumes the caller already holds the appropriate lock
func (cm *ClusterManager) findContextCaseInsensitive(contextName string) string {
	// First try exact match
	if _, exists := cm.connections[contextName]; exists {
		return contextName
	}

	// Try normalized match
	normalized := normalizeContextName(contextName)
	if _, exists := cm.connections[normalized]; exists {
		return normalized
	}

	// Try case-insensitive match for the cluster name part
	// This handles cases where eksctl uses different naming conventions
	for key := range cm.connections {
		if strings.EqualFold(key, contextName) {
			return key
		}
		if strings.EqualFold(key, normalized) {
			return key
		}
	}

	// No match found
	return ""
}