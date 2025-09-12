package wrapper

import (
	"context"
	"fmt"

	"github.com/prasad/kaptivan/backend/internal/linter"
)

// CustomCheckRegistry manages custom checks
type CustomCheckRegistry struct {
	checks map[string]linter.CustomCheck
}

// NewCustomCheckRegistry creates a new registry
func NewCustomCheckRegistry() *CustomCheckRegistry {
	return &CustomCheckRegistry{
		checks: make(map[string]linter.CustomCheck),
	}
}

// RegisterCheck registers a custom check
func (r *CustomCheckRegistry) RegisterCheck(check linter.CustomCheck) error {
	if check.Name == "" {
		return fmt.Errorf("check name cannot be empty")
	}

	if check.CheckFunc == nil {
		return fmt.Errorf("check function cannot be nil")
	}

	r.checks[check.Name] = check
	return nil
}

// GetCheck returns a custom check by name
func (r *CustomCheckRegistry) GetCheck(name string) (linter.CustomCheck, bool) {
	check, exists := r.checks[name]
	return check, exists
}

// GetAllChecks returns all registered custom checks
func (r *CustomCheckRegistry) GetAllChecks() []linter.CustomCheck {
	var checks []linter.CustomCheck
	for _, check := range r.checks {
		checks = append(checks, check)
	}
	return checks
}

// PredefinedCustomChecks returns a set of predefined custom checks
func PredefinedCustomChecks() []linter.CustomCheck {
	return []linter.CustomCheck{
		{
			Name:        "kaptivan-resource-limits",
			Description: "Ensure all containers have resource limits defined",
			Severity:    "error",
			Category:    "resources",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// TODO: Implement actual check logic
				return []linter.LintResult{}
			},
		},
		{
			Name:        "kaptivan-security-context",
			Description: "Ensure security context is properly configured",
			Severity:    "warning",
			Category:    "security",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// TODO: Implement actual check logic
				return []linter.LintResult{}
			},
		},
		{
			Name:        "kaptivan-image-tag",
			Description: "Ensure images use specific tags instead of 'latest'",
			Severity:    "warning",
			Category:    "images",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// TODO: Implement actual check logic
				return []linter.LintResult{}
			},
		},
		{
			Name:        "kaptivan-labels",
			Description: "Ensure all resources have required labels",
			Severity:    "info",
			Category:    "metadata",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// TODO: Implement actual check logic
				return []linter.LintResult{}
			},
		},
	}
}
