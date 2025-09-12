package wrapper

import (
	"context"
	"fmt"
	"os"

	"github.com/prasad/kaptivan/backend/internal/linter"
	"golang.stackrox.io/kube-linter/pkg/builtinchecks"
	"golang.stackrox.io/kube-linter/pkg/checkregistry"
	"golang.stackrox.io/kube-linter/pkg/config"
	"golang.stackrox.io/kube-linter/pkg/diagnostic"
	"golang.stackrox.io/kube-linter/pkg/lintcontext"
	"golang.stackrox.io/kube-linter/pkg/run"
	// Import all templates to register them
	_ "golang.stackrox.io/kube-linter/pkg/templates/all"
)

// Linter wraps kube-linter functionality
type Linter struct {
	config   *Config
	registry checkregistry.CheckRegistry
}

// Config represents wrapper configuration
type Config struct {
	KubeLinterConfig   *config.Config
	CustomChecks       []linter.CustomCheck
	EnableCustomChecks bool
}

// NewLinter creates a new linter instance
func NewLinter(config *Config) (*Linter, error) {
	// Create check registry and load builtin checks
	registry := checkregistry.New()
	if err := builtinchecks.LoadInto(registry); err != nil {
		return nil, fmt.Errorf("failed to load built-in checks: %w", err)
	}

	return &Linter{
		config:   config,
		registry: registry,
	}, nil
}

// LintYAML lints raw YAML content
func (l *Linter) LintYAML(ctx context.Context, yamlContent string) ([]linter.LintResult, error) {
	// Create temporary file
	tmpFile, err := os.CreateTemp("", "manifest-*.yaml")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write YAML content
	if _, err := tmpFile.WriteString(yamlContent); err != nil {
		return nil, fmt.Errorf("failed to write YAML: %w", err)
	}
	tmpFile.Close()

	// Create lint context from file
	lintCtx, err := lintcontext.CreateContexts([]string{}, tmpFile.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to load lint context: %w", err)
	}

	// Get checks to run - convert to string slice
	checksConfig := l.config.KubeLinterConfig.Checks
	var checks []string

	// Use the include list if provided, otherwise use all built-in checks
	if len(checksConfig.Include) > 0 {
		checks = checksConfig.Include
	} else if checksConfig.AddAllBuiltIn {
		// Get all available checks from the registry
		allChecks, err := builtinchecks.List()
		if err != nil {
			return nil, fmt.Errorf("failed to list built-in checks: %w", err)
		}
		for _, check := range allChecks {
			checks = append(checks, check.Name)
		}
	} else {
		// Use a minimal set of working checks as default
		checks = []string{
			"latest-tag",
			"unset-cpu-requirements",
			"unset-memory-requirements",
		}
	}

	// Debug: Check if the checks exist in the registry
	for _, checkName := range checks {
		if l.registry.Load(checkName) == nil {
			return nil, fmt.Errorf("check %q not found in registry", checkName)
		}
	}

	// Run kube-linter
	result, err := run.Run(lintCtx, l.registry, checks)
	if err != nil {
		return nil, fmt.Errorf("failed to run linter: %w", err)
	}

	// Convert kube-linter results to our format
	lintResults := l.convertResults(result.Reports)

	// Run custom checks if enabled
	if l.config.EnableCustomChecks {
		customResults := l.runCustomChecks(ctx, yamlContent)
		lintResults = append(lintResults, customResults...)
	}

	return lintResults, nil
}

// LintManifest lints a structured manifest
func (l *Linter) LintManifest(ctx context.Context, manifest linter.Manifest) ([]linter.LintResult, error) {
	// Convert manifest to YAML
	yamlContent, err := manifest.ToYAML()
	if err != nil {
		return nil, fmt.Errorf("failed to convert manifest to YAML: %w", err)
	}

	return l.LintYAML(ctx, yamlContent)
}

// GetAvailableChecks returns all available checks
func (l *Linter) GetAvailableChecks() []linter.CheckInfo {
	// For now, return a hardcoded list of common checks
	// TODO: Implement proper registry listing when available
	commonChecks := []struct {
		name        string
		description string
		category    string
	}{
		{"run-as-non-root", "Ensure containers run as non-root user", "security"},
		{"no-read-only-root-fs", "Ensure containers have read-only root filesystem", "security"},
		{"no-privilege-escalation", "Ensure containers cannot escalate privileges", "security"},
		{"no-host-namespace", "Ensure containers don't use host namespace", "security"},
		{"no-host-pid", "Ensure containers don't use host PID namespace", "security"},
		{"no-host-ipc", "Ensure containers don't use host IPC namespace", "security"},
		{"no-host-network", "Ensure containers don't use host network", "security"},
		{"no-privileged", "Ensure containers are not running in privileged mode", "security"},
		{"no-new-privileges", "Ensure containers cannot gain new privileges", "security"},
		{"drop-all-capabilities", "Ensure containers drop all capabilities", "security"},
		{"required-labels", "Ensure required labels are present", "best-practices"},
		{"required-annotations", "Ensure required annotations are present", "best-practices"},
		{"no-latest-tag", "Ensure images don't use latest tag", "best-practices"},
		{"no-undefined-env-vars", "Ensure all environment variables are defined", "best-practices"},
		{"no-missing-resources", "Ensure resource requests and limits are set", "best-practices"},
	}

	var checkInfos []linter.CheckInfo
	for _, check := range commonChecks {
		checkInfos = append(checkInfos, linter.CheckInfo{
			Name:        check.name,
			Description: check.description,
			Severity:    "warning",
			Category:    check.category,
		})
	}

	return checkInfos
}

// GetCustomChecks returns custom checks
func (l *Linter) GetCustomChecks() []linter.CheckInfo {
	var checkInfos []linter.CheckInfo
	for _, check := range l.config.CustomChecks {
		checkInfos = append(checkInfos, linter.CheckInfo{
			Name:        check.Name,
			Description: check.Description,
			Severity:    check.Severity,
			Category:    check.Category,
		})
	}
	return checkInfos
}

// convertResults converts kube-linter results to our format
func (l *Linter) convertResults(reports []diagnostic.WithContext) []linter.LintResult {
	var lintResults []linter.LintResult
	for _, report := range reports {
		// Get object name
		objectName := "unknown"
		objectInfo := report.Object.GetK8sObjectName()
		objectName = objectInfo.String()

		// Get line and column (not available in this version)
		line := 0
		column := 0

		lintResults = append(lintResults, linter.LintResult{
			Check:       report.Check,
			Severity:    "warning", // Default severity
			Message:     report.Diagnostic.Message,
			Remediation: report.Remediation,
			Object:      objectName,
			Line:        line,
			Column:      column,
		})
	}
	return lintResults
}

// runCustomChecks runs custom checks on YAML content
func (l *Linter) runCustomChecks(ctx context.Context, yamlContent string) []linter.LintResult {
	var results []linter.LintResult

	// TODO: Parse YAML to objects when kube-linter is integrated
	// For now, return empty results
	// objects, err := l.parseYAML(yamlContent)
	// if err != nil {
	//     return results
	// }

	// Run each custom check
	for range l.config.CustomChecks {
		// TODO: Run custom check on parsed objects
		// for _, obj := range objects {
		//     checkResults := check.CheckFunc(ctx, obj)
		//     results = append(results, checkResults...)
		// }
	}

	return results
}

// AddCustomCheck adds a custom check
func (l *Linter) AddCustomCheck(check linter.CustomCheck) {
	l.config.CustomChecks = append(l.config.CustomChecks, check)
}
