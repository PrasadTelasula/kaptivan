package wrapper

import (
	"context"

	"github.com/prasad/kaptivan/backend/internal/linter"
	"golang.stackrox.io/kube-linter/pkg/config"
)

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		KubeLinterConfig: &config.Config{
			Checks: config.ChecksConfig{
				AddAllBuiltIn: true,
				Exclude:       []string{},
				Include:       []string{},
			},
		},
		CustomChecks:       []linter.CustomCheck{},
		EnableCustomChecks: true,
	}
}

// LoadConfigFromFile loads configuration from file
func LoadConfigFromFile(path string) (*Config, error) {
	// TODO: Implement configuration loading from file
	// For now, return default config
	return DefaultConfig(), nil
}

// ExampleCustomChecks returns example custom checks
func ExampleCustomChecks() []linter.CustomCheck {
	return []linter.CustomCheck{
		{
			Name:        "custom-resource-limits",
			Description: "Ensure all containers have resource limits",
			Severity:    "error",
			Category:    "resources",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// Custom check implementation
				return []linter.LintResult{}
			},
		},
		{
			Name:        "custom-security-context",
			Description: "Ensure security context is properly configured",
			Severity:    "warning",
			Category:    "security",
			CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
				// Custom check implementation
				return []linter.LintResult{}
			},
		},
	}
}
