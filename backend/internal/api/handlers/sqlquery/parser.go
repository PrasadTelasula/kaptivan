package sqlquery

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// SQLParser handles parsing SQL-like queries for Kubernetes resources
type SQLParser struct {
	query string
}

// NewSQLParser creates a new SQL parser instance
func NewSQLParser(query string) *SQLParser {
	return &SQLParser{query: strings.TrimSpace(query)}
}

// Parse parses the SQL query into a structured format
func (p *SQLParser) Parse() (*ParsedQuery, error) {
	if p.query == "" {
		return nil, fmt.Errorf("empty query")
	}

	// Normalize the query
	normalizedQuery := p.normalizeQuery(p.query)
	
	// Extract main components using regex
	selectRegex := regexp.MustCompile(`(?i)^SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$`)
	
	matches := selectRegex.FindStringSubmatch(normalizedQuery)
	if matches == nil {
		return nil, fmt.Errorf("invalid SQL syntax")
	}

	fieldsStr := matches[1]
	resourceType := strings.ToLower(matches[2])
	whereClause := matches[3]
	orderByClause := matches[4]
	limitStr := matches[5]

	// Validate resource type
	if !SupportedResources[resourceType] {
		return nil, fmt.Errorf("unsupported resource type: %s", resourceType)
	}

	// Parse fields
	fields, err := p.parseFields(fieldsStr, resourceType)
	if err != nil {
		return nil, fmt.Errorf("error parsing fields: %w", err)
	}

	// Parse WHERE conditions
	conditions, namespace, err := p.parseConditions(whereClause, resourceType)
	if err != nil {
		return nil, fmt.Errorf("error parsing WHERE clause: %w", err)
	}

	// Parse ORDER BY
	orderBy, err := p.parseOrderBy(orderByClause, resourceType)
	if err != nil {
		return nil, fmt.Errorf("error parsing ORDER BY clause: %w", err)
	}

	// Parse LIMIT
	limit := 100 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			if parsedLimit > 1000 { // Maximum limit for security
				limit = 1000
			} else {
				limit = parsedLimit
			}
		}
	}

	return &ParsedQuery{
		ResourceType: resourceType,
		Namespace:    namespace,
		Fields:       fields,
		Conditions:   conditions,
		OrderBy:      orderBy,
		Limit:        limit,
	}, nil
}

// normalizeQuery cleans up the SQL query
func (p *SQLParser) normalizeQuery(query string) string {
	// Remove extra whitespace
	re := regexp.MustCompile(`\s+`)
	normalized := re.ReplaceAllString(strings.TrimSpace(query), " ")
	
	// Ensure it doesn't end with semicolon
	normalized = strings.TrimSuffix(normalized, ";")
	
	return normalized
}

// parseFields parses the SELECT fields
func (p *SQLParser) parseFields(fieldsStr, resourceType string) ([]string, error) {
	if strings.TrimSpace(fieldsStr) == "*" {
		// Return "*" to indicate all fields should be returned
		return []string{"*"}, nil
	}

	fields := []string{}
	parts := strings.Split(fieldsStr, ",")
	
	for _, part := range parts {
		field := strings.TrimSpace(part)
		
		// Handle aliases (field AS alias)
		if strings.Contains(strings.ToUpper(field), " AS ") {
			parts := regexp.MustCompile(`(?i)\s+as\s+`).Split(field, 2)
			if len(parts) == 2 {
				field = strings.TrimSpace(parts[0])
			}
		}
		
		// Allow nested field paths (e.g., metadata.labels, spec.containers)
		// We'll validate these at runtime when we actually have the objects
		if !p.isValidFieldPath(field, resourceType) {
			return nil, fmt.Errorf("invalid field '%s' for resource type '%s'", field, resourceType)
		}
		
		fields = append(fields, field)
	}

	if len(fields) == 0 {
		return nil, fmt.Errorf("no valid fields specified")
	}

	return fields, nil
}

// parseConditions parses WHERE clause conditions
func (p *SQLParser) parseConditions(whereClause, resourceType string) ([]Condition, string, error) {
	conditions := []Condition{}
	namespace := ""
	
	if whereClause == "" {
		return conditions, namespace, nil
	}

	// Simple parsing - split by AND/OR (for now, only support AND)
	parts := strings.Split(whereClause, " AND ")
	
	for _, part := range parts {
		part = strings.TrimSpace(part)
		condition, err := p.parseCondition(part, resourceType)
		if err != nil {
			return nil, "", err
		}
		
		// Special handling for namespace
		if condition.Field == "namespace" {
			namespace = fmt.Sprintf("%v", condition.Value)
		}
		
		conditions = append(conditions, condition)
	}

	return conditions, namespace, nil
}

// parseCondition parses a single condition
func (p *SQLParser) parseCondition(condStr, resourceType string) (Condition, error) {
	// Find operator
	for op := range SupportedOperators {
		if strings.Contains(condStr, " "+op+" ") {
			parts := strings.SplitN(condStr, " "+op+" ", 2)
			if len(parts) != 2 {
				continue
			}
			
			field := strings.TrimSpace(parts[0])
			valueStr := strings.TrimSpace(parts[1])
			
			// Validate field path (including nested paths)
			if !p.isValidFieldPath(field, resourceType) {
				return Condition{}, fmt.Errorf("invalid field '%s' for resource type '%s'", field, resourceType)
			}
			
			// Parse value (remove quotes if present)
			value := p.parseValue(valueStr)
			
			return Condition{
				Field:    field,
				Operator: op,
				Value:    value,
			}, nil
		}
	}
	
	return Condition{}, fmt.Errorf("invalid condition: %s", condStr)
}

// parseOrderBy parses ORDER BY clause
func (p *SQLParser) parseOrderBy(orderByClause, resourceType string) ([]OrderField, error) {
	orderBy := []OrderField{}
	
	if orderByClause == "" {
		return orderBy, nil
	}

	parts := strings.Split(orderByClause, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		desc := false
		
		if strings.HasSuffix(strings.ToUpper(part), " DESC") {
			desc = true
			part = strings.TrimSuffix(part, " DESC")
			part = strings.TrimSuffix(part, " desc")
		} else if strings.HasSuffix(strings.ToUpper(part), " ASC") {
			part = strings.TrimSuffix(part, " ASC")
			part = strings.TrimSuffix(part, " asc")
		}
		
		field := strings.TrimSpace(part)
		
		// Validate field path (including nested paths)
		if !p.isValidFieldPath(field, resourceType) {
			return nil, fmt.Errorf("invalid ORDER BY field '%s' for resource type '%s'", field, resourceType)
		}
		
		orderBy = append(orderBy, OrderField{
			Field: field,
			Desc:  desc,
		})
	}

	return orderBy, nil
}

// parseValue parses a condition value, removing quotes and converting types
func (p *SQLParser) parseValue(valueStr string) interface{} {
	// Remove quotes
	if (strings.HasPrefix(valueStr, "'") && strings.HasSuffix(valueStr, "'")) ||
		(strings.HasPrefix(valueStr, "\"") && strings.HasSuffix(valueStr, "\"")) {
		return valueStr[1 : len(valueStr)-1]
	}
	
	// Try to parse as number
	if intVal, err := strconv.Atoi(valueStr); err == nil {
		return intVal
	}
	
	// Try to parse as float
	if floatVal, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return floatVal
	}
	
	// Try to parse as boolean
	if boolVal, err := strconv.ParseBool(valueStr); err == nil {
		return boolVal
	}
	
	// Return as string
	return valueStr
}

// isValidField checks if a field is valid for the given resource type
func (p *SQLParser) isValidField(field, resourceType string) bool {
	fieldMappings, exists := ResourceFieldMappings[resourceType]
	if !exists {
		return false
	}
	
	_, valid := fieldMappings[field]
	return valid
}

// isValidFieldPath checks if a field path is valid (including nested paths)
func (p *SQLParser) isValidFieldPath(field, resourceType string) bool {
	// Allow wildcard
	if field == "*" {
		return true
	}
	
	// Split the field path to check the root field
	parts := strings.Split(field, ".")
	rootField := parts[0]
	
	// Common Kubernetes metadata fields that apply to all resources
	commonFields := map[string]bool{
		"metadata":       true,
		"spec":          true,
		"status":        true,
		"kind":          true,
		"apiVersion":    true,
	}
	
	// Check if it's a common field
	if commonFields[rootField] {
		return true
	}
	
	// Check against resource-specific field mappings
	fieldMappings, exists := ResourceFieldMappings[resourceType]
	if !exists {
		return false
	}
	
	// Check if the root field or full path is in the mappings
	if _, valid := fieldMappings[rootField]; valid {
		return true
	}
	
	// Check if the full field path is in the mappings
	if _, valid := fieldMappings[field]; valid {
		return true
	}
	
	// For nested paths, we'll allow them and validate at runtime
	// when we actually have the object structure
	return true
}

// getDefaultFields returns default fields for a resource type when using SELECT *
func (p *SQLParser) getDefaultFields(resourceType string) []string {
	switch resourceType {
	case "pods":
		return []string{"name", "namespace", "phase", "node", "age"}
	case "deployments":
		return []string{"name", "namespace", "ready", "desired", "age"}
	case "services":
		return []string{"name", "namespace", "type", "cluster", "ports", "age"}
	case "nodes":
		return []string{"name", "status", "roles", "age", "version"}
	case "events":
		return []string{"reason", "message", "object", "objectKind", "firstTime"}
	default:
		return []string{"name", "namespace", "age"}
	}
}