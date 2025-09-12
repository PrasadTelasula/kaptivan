# Kube-Linter Integration

This directory contains the kube-linter integration for Kaptivan using a **plug and play architecture**.

## 📁 Directory Structure

```
backend/internal/linter/
├── kube-linter/          # Entire kube-linter source code (to be added)
│   ├── cmd/
│   ├── pkg/
│   ├── internal/
│   ├── go.mod
│   └── README.md
├── wrapper/              # Wrapper around kube-linter
│   ├── linter.go         # Main wrapper implementation
│   ├── config.go         # Configuration management
│   ├── custom_checks.go  # Custom checks
│   └── types.go          # Wrapper types
├── types.go              # Common types
├── interface.go          # Linter interface
└── README.md             # This file
```

## 🚀 Quick Start

### 1. Setup Kube-Linter Source

```bash
# Navigate to the linter directory
cd backend/internal/linter/

# Clone kube-linter repository
git clone https://github.com/stackrox/kube-linter.git kube-linter

# Navigate to kube-linter directory
cd kube-linter

# Checkout latest stable version
git checkout v0.7.5

# Remove .git to avoid conflicts
rm -rf .git
```

### 2. Update Go Module

Update `backend/internal/linter/kube-linter/go.mod`:

```go
module github.com/your-org/kaptivan/internal/linter/kube-linter

go 1.21

// Update module path to match your project
replace golang.stackrox.io/kube-linter => ./

require (
    // kube-linter dependencies will be here
)
```

### 3. Update Wrapper Implementation

Uncomment the kube-linter imports in `wrapper/linter.go`:

```go
// Uncomment these lines:
// kubeLinter "github.com/your-org/kaptivan/internal/linter/kube-linter/pkg/linter"
// kubeLinterConfig "github.com/your-org/kaptivan/internal/linter/kube-linter/pkg/config"
```

### 4. Test Integration

```bash
# Navigate to backend directory
cd ../../

# Run tests
go test ./internal/linter/...

# Start the server
go run cmd/server/main.go
```

## 🔧 Configuration

### Default Configuration

```go
config := wrapper.DefaultConfig()
linter, err := wrapper.NewLinter(config)
```

### Custom Configuration

```go
config := &wrapper.Config{
    KubeLinterConfig: &kubeLinterConfig.Config{
        Checks: []string{"all"},
        ExcludeChecks: []string{},
        Format: "json",
    },
    CustomChecks: []linter.CustomCheck{
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
    },
    EnableCustomChecks: true,
}
```

## 📚 API Endpoints

The linter integration provides the following API endpoints:

- `POST /api/v1/linter/lint` - Lint a single manifest
- `POST /api/v1/linter/lint-multiple` - Lint multiple manifests
- `GET /api/v1/linter/checks` - Get available checks
- `GET /api/v1/linter/checks/custom` - Get custom checks
- `GET /api/v1/linter/checks/:check` - Get check details
- `GET /api/v1/linter/summary` - Get lint summary
- `GET /api/v1/linter/statistics` - Get lint statistics

## 🎨 Frontend Integration

The frontend integration includes:

- **LintButton**: Button component for linting individual resources
- **LintResultsModal**: Modal for displaying lint results
- **LintChecksModal**: Modal for viewing available checks
- **LinterService**: Service for API communication

### Usage Example

```tsx
import { LintButton } from './components/LintButton';

<LintButton
  yaml={manifestYaml}
  namespace={namespace}
  kind={kind}
  onResults={(results) => {
    console.log('Lint results:', results);
  }}
/>
```

## 🔄 Updating Kube-Linter

### Update to New Version

```bash
# Navigate to kube-linter directory
cd backend/internal/linter/kube-linter

# Fetch latest changes
git fetch origin

# Checkout new version
git checkout v0.7.6

# Remove .git to avoid conflicts
rm -rf .git
```

### Test After Update

```bash
# Run tests
go test ./internal/linter/...

# Test with sample manifests
go run cmd/server/main.go
```

## 🛠️ Custom Checks

### Adding Custom Checks

```go
// In wrapper/custom_checks.go
func (l *Linter) AddCustomCheck(check linter.CustomCheck) {
    l.config.CustomChecks = append(l.config.CustomChecks, check)
}

// Example custom check
customCheck := linter.CustomCheck{
    Name:        "kaptivan-resource-limits",
    Description: "Ensure all containers have resource limits defined",
    Severity:    "error",
    Category:    "resources",
    CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
        // Implement your custom check logic
        return []linter.LintResult{}
    },
}

linter.AddCustomCheck(customCheck)
```

## 🧪 Testing

### Unit Tests

```bash
go test ./internal/linter/...
```

### Integration Tests

```bash
# Test with sample YAML
curl -X POST http://localhost:8080/api/v1/linter/lint \
  -H "Content-Type: application/json" \
  -d '{"yaml": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pod"}'
```

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**: Make sure kube-linter is properly cloned and go.mod is updated
2. **Build Errors**: Check that all dependencies are properly installed
3. **Runtime Errors**: Verify that the linter is properly initialized

### Debug Mode

Enable debug logging by setting the log level:

```go
// In wrapper/linter.go
log.SetLevel(log.DebugLevel)
```

## 📖 Additional Resources

- [Kube-Linter Documentation](https://github.com/stackrox/kube-linter)
- [Kube-Linter Checks](https://docs.kubelinter.io/en/latest/checks/)
- [Kube-Linter Configuration](https://docs.kubelinter.io/en/latest/configuration/)

## 🤝 Contributing

When adding new features or custom checks:

1. Follow the existing code patterns
2. Add appropriate tests
3. Update documentation
4. Test with various Kubernetes manifests

## 📝 License

This integration follows the same license as the main Kaptivan project.
