package sqlquery

import (
	"fmt"
	"strings"
	"unicode"
)

// SecurityValidator validates SQL queries for security risks
type SecurityValidator struct{}

// NewSecurityValidator creates a new security validator
func NewSecurityValidator() *SecurityValidator {
	return &SecurityValidator{}
}

// ValidateQuery validates a SQL query for security issues
func (v *SecurityValidator) ValidateQuery(query string) error {
	// Normalize the query
	normalizedQuery := strings.ToUpper(strings.TrimSpace(query))

	// Check for dangerous SQL operations
	if err := v.checkDangerousOperations(normalizedQuery); err != nil {
		return err
	}

	// Check for injection patterns
	if err := v.checkInjectionPatterns(query); err != nil {
		return err
	}

	// Check query length
	if err := v.checkQueryLength(query); err != nil {
		return err
	}

	// Check for nested queries
	if err := v.checkNestedQueries(normalizedQuery); err != nil {
		return err
	}

	// Validate only SELECT operations
	if err := v.validateSelectOnly(normalizedQuery); err != nil {
		return err
	}

	return nil
}

// checkDangerousOperations checks for dangerous SQL operations
func (v *SecurityValidator) checkDangerousOperations(query string) error {
	dangerousOperations := []string{
		"DROP", "DELETE", "INSERT", "UPDATE", "CREATE", "ALTER",
		"TRUNCATE", "EXEC", "EXECUTE", "MERGE", "CALL", "DO",
		"HANDLER", "LOAD", "REPLACE", "IMPORT", "EXPORT",
		"BACKUP", "RESTORE", "GRANT", "REVOKE", "COMMIT", "ROLLBACK",
	}

	for _, op := range dangerousOperations {
		if strings.Contains(query, op) {
			return fmt.Errorf("dangerous operation '%s' is not allowed", op)
		}
	}

	return nil
}

// checkInjectionPatterns checks for common SQL injection patterns
func (v *SecurityValidator) checkInjectionPatterns(query string) error {
	// Check for comment patterns
	if strings.Contains(query, "--") || strings.Contains(query, "/*") || strings.Contains(query, "*/") {
		return fmt.Errorf("comments are not allowed in queries")
	}

	// Check for semicolon (command separation)
	if strings.Count(query, ";") > 1 || (strings.Contains(query, ";") && !strings.HasSuffix(strings.TrimSpace(query), ";")) {
		return fmt.Errorf("multiple statements are not allowed")
	}

	// Check for union attacks
	if strings.Contains(strings.ToUpper(query), "UNION") {
		return fmt.Errorf("UNION operations are not allowed")
	}

	// Check for information schema queries
	if strings.Contains(strings.ToUpper(query), "INFORMATION_SCHEMA") {
		return fmt.Errorf("information schema queries are not allowed")
	}

	// Check for system functions
	systemFunctions := []string{
		"VERSION()", "USER()", "DATABASE()", "@@VERSION", "@@USER",
		"SYSTEM_USER()", "SESSION_USER()", "CURRENT_USER()",
	}

	queryUpper := strings.ToUpper(query)
	for _, fn := range systemFunctions {
		if strings.Contains(queryUpper, fn) {
			return fmt.Errorf("system function '%s' is not allowed", fn)
		}
	}

	return nil
}

// checkQueryLength validates query length to prevent DoS
func (v *SecurityValidator) checkQueryLength(query string) error {
	const maxQueryLength = 2000 // Maximum allowed query length

	if len(query) > maxQueryLength {
		return fmt.Errorf("query too long: maximum %d characters allowed", maxQueryLength)
	}

	return nil
}

// checkNestedQueries ensures no nested SELECT statements
func (v *SecurityValidator) checkNestedQueries(query string) error {
	selectCount := strings.Count(query, "SELECT")
	if selectCount > 1 {
		return fmt.Errorf("nested queries are not allowed")
	}

	// Check for subqueries in parentheses
	if strings.Contains(query, "(SELECT") {
		return fmt.Errorf("subqueries are not allowed")
	}

	return nil
}

// validateSelectOnly ensures the query is a SELECT statement
func (v *SecurityValidator) validateSelectOnly(query string) error {
	if !strings.HasPrefix(query, "SELECT") {
		return fmt.Errorf("only SELECT statements are allowed")
	}

	return nil
}

// ValidateParsedQuery validates a parsed query for additional security checks
func (v *SecurityValidator) ValidateParsedQuery(query *ParsedQuery) error {
	// Validate resource type
	if !SupportedResources[query.ResourceType] {
		return fmt.Errorf("unsupported resource type: %s", query.ResourceType)
	}

	// Validate field names
	for _, field := range query.Fields {
		if err := v.validateFieldName(field); err != nil {
			return fmt.Errorf("invalid field '%s': %w", field, err)
		}
	}

	// Validate condition values
	for _, condition := range query.Conditions {
		if err := v.validateCondition(condition); err != nil {
			return fmt.Errorf("invalid condition: %w", err)
		}
	}

	// Validate limit
	if query.Limit > 1000 {
		return fmt.Errorf("limit too high: maximum 1000 rows allowed")
	}

	return nil
}

// validateFieldName validates a field name for security issues
func (v *SecurityValidator) validateFieldName(field string) error {
	// Check for empty field
	if strings.TrimSpace(field) == "" {
		return fmt.Errorf("empty field name")
	}

	// Allow * for SELECT * queries
	if field == "*" {
		return nil
	}

	// Check for dangerous characters
	for _, char := range field {
		if !unicode.IsLetter(char) && !unicode.IsDigit(char) && char != '.' && char != '_' && char != '[' && char != ']' {
			return fmt.Errorf("invalid character '%c' in field name", char)
		}
	}

	// Check for field injection patterns
	if strings.Contains(field, "..") {
		return fmt.Errorf("relative path traversal not allowed")
	}

	return nil
}

// validateCondition validates a WHERE condition for security
func (v *SecurityValidator) validateCondition(condition Condition) error {
	// Validate field name
	if err := v.validateFieldName(condition.Field); err != nil {
		return fmt.Errorf("invalid field in condition: %w", err)
	}

	// Validate operator
	if !SupportedOperators[condition.Operator] {
		return fmt.Errorf("unsupported operator: %s", condition.Operator)
	}

	// Validate condition value
	if err := v.validateConditionValue(condition.Value); err != nil {
		return fmt.Errorf("invalid condition value: %w", err)
	}

	return nil
}

// validateConditionValue validates a condition value for security
func (v *SecurityValidator) validateConditionValue(value interface{}) error {
	if value == nil {
		return fmt.Errorf("null values not allowed")
	}

	// Convert to string for validation
	strValue := fmt.Sprintf("%v", value)

	// Check length
	if len(strValue) > 500 {
		return fmt.Errorf("condition value too long")
	}

	// Check for dangerous patterns
	dangerousPatterns := []string{
		"<script", "javascript:", "vbscript:", "onload=", "onerror=",
		"eval(", "exec(", "system(", "cmd(", "`", "${",
	}

	strValueLower := strings.ToLower(strValue)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(strValueLower, pattern) {
			return fmt.Errorf("potentially dangerous pattern detected")
		}
	}

	return nil
}

// ValidateNamespace validates a namespace name
func (v *SecurityValidator) ValidateNamespace(namespace string) error {
	if namespace == "" {
		return nil // Empty namespace is allowed (means all namespaces)
	}

	// Kubernetes namespace naming rules
	if len(namespace) > 63 {
		return fmt.Errorf("namespace name too long: maximum 63 characters")
	}

	// Must start and end with alphanumeric
	if !unicode.IsLetter(rune(namespace[0])) && !unicode.IsDigit(rune(namespace[0])) {
		return fmt.Errorf("namespace must start with alphanumeric character")
	}

	if !unicode.IsLetter(rune(namespace[len(namespace)-1])) && !unicode.IsDigit(rune(namespace[len(namespace)-1])) {
		return fmt.Errorf("namespace must end with alphanumeric character")
	}

	// Check allowed characters
	for _, char := range namespace {
		if !unicode.IsLetter(char) && !unicode.IsDigit(char) && char != '-' {
			return fmt.Errorf("namespace contains invalid character: %c", char)
		}
	}

	return nil
}