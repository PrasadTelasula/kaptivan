package linter

import "context"

// Linter defines the plug and play interface
type Linter interface {
	// LintYAML lints raw YAML content
	LintYAML(ctx context.Context, yamlContent string) ([]LintResult, error)

	// LintManifest lints a structured manifest
	LintManifest(ctx context.Context, manifest Manifest) ([]LintResult, error)

	// GetAvailableChecks returns all available checks
	GetAvailableChecks() []CheckInfo

	// GetCustomChecks returns custom checks
	GetCustomChecks() []CheckInfo
}

// LintResult represents a single lint finding
type LintResult struct {
	Check       string `json:"check"`
	Severity    string `json:"severity"`
	Message     string `json:"message"`
	Remediation string `json:"remediation"`
	Object      string `json:"object"`
	Line        int    `json:"line,omitempty"`
	Column      int    `json:"column,omitempty"`
}

// CheckInfo represents information about a check
type CheckInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Category    string `json:"category"`
}

// Manifest represents a Kubernetes manifest
type Manifest struct {
	APIVersion string                 `json:"apiVersion"`
	Kind       string                 `json:"kind"`
	Metadata   map[string]interface{} `json:"metadata"`
	Spec       map[string]interface{} `json:"spec,omitempty"`
	Data       map[string]interface{} `json:"data,omitempty"`
}

// ToYAML converts manifest to YAML string
func (m *Manifest) ToYAML() (string, error) {
	// This would use a YAML library like gopkg.in/yaml.v3
	// For now, return a placeholder
	return "", nil
}
