package linter

import "context"

// LintSummary represents a summary of lint results
type LintSummary struct {
	Total    int `json:"total"`
	Errors   int `json:"errors"`
	Warnings int `json:"warnings"`
	Info     int `json:"info"`
}

// LintRequest represents a lint request
type LintRequest struct {
	YAML      string `json:"yaml" binding:"required"`
	Namespace string `json:"namespace,omitempty"`
	Kind      string `json:"kind,omitempty"`
}

// LintResponse represents a lint response
type LintResponse struct {
	Results []LintResult `json:"results"`
	Summary LintSummary  `json:"summary"`
}

// CustomCheck represents a custom check
type CustomCheck struct {
	Name        string
	Description string
	Severity    string
	Category    string
	CheckFunc   func(ctx context.Context, obj interface{}) []LintResult
}

// Config represents linter configuration
type Config struct {
	KubeLinterConfig   interface{} // Will be kube-linter config when integrated
	CustomChecks       []CustomCheck
	EnableCustomChecks bool
}
