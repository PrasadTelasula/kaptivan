n is # Kube-Linter Setup Guide

This guide provides step-by-step instructions for setting up the kube-linter integration in Kaptivan.

## Prerequisites

- Go 1.21 or later
- Git
- Access to the kube-linter repository

## Step-by-Step Setup

### Step 1: Clone Kube-Linter

```bash
# Navigate to the backend linter directory
cd backend/internal/linter/

# Clone the kube-linter repository
git clone https://github.com/stackrox/kube-linter.git kube-linter

# Navigate to the kube-linter directory
cd kube-linter

# Checkout the latest stable version
git checkout v0.7.5

# Remove .git to avoid conflicts
rm -rf .git
```

### Step 2: Update Go Module

Edit `backend/internal/linter/kube-linter/go.mod`:

```go
module github.com/your-org/kaptivan/internal/linter/kube-linter

go 1.21

// Update module path to match your project
replace golang.stackrox.io/kube-linter => ./

require (
    // kube-linter dependencies will be here
)
```

### Step 3: Update Wrapper Implementation

Edit `backend/internal/linter/wrapper/linter.go` and uncomment the kube-linter imports:

```go
// Uncomment these lines:
import (
    "context"
    "fmt"
    "os"
    "path/filepath"
    "temp"
    
    // Uncomment these imports:
    kubeLinter "github.com/your-org/kaptivan/internal/linter/kube-linter/pkg/linter"
    kubeLinterConfig "github.com/your-org/kaptivan/internal/linter/kube-linter/pkg/config"
    
    "github.com/your-org/kaptivan/internal/linter"
)
```

### Step 4: Update Configuration

Edit `backend/internal/linter/wrapper/config.go` and update the DefaultConfig function:

```go
func DefaultConfig() *Config {
    return &Config{
        KubeLinterConfig: &kubeLinterConfig.Config{
            Checks: []string{"all"},
            ExcludeChecks: []string{},
            Format: "json",
        },
        CustomChecks:     []linter.CustomCheck{},
        EnableCustomChecks: true,
    }
}
```

### Step 5: Test the Integration

```bash
# Navigate to the backend directory
cd ../../

# Run tests
go test ./internal/linter/...

# If tests pass, start the server
go run cmd/server/main.go
```

### Step 6: Verify API Endpoints

Test the linter API endpoints:

```bash
# Test lint endpoint
curl -X POST http://localhost:8080/api/v1/linter/lint \
  -H "Content-Type: application/json" \
  -d '{
    "yaml": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pod\nspec:\n  containers:\n  - name: test-container\n    image: nginx:latest"
  }'

# Test checks endpoint
curl http://localhost:8080/api/v1/linter/checks
```

## Frontend Setup

The frontend components are already integrated. To use them:

1. **LintButton**: Automatically appears next to each resource in the ResourceTree
2. **LintResultsModal**: Opens when lint results are available
3. **LintChecksModal**: Opens when clicking the Shield icon in the toolbar

## Customization

### Adding Custom Checks

1. Edit `backend/internal/linter/wrapper/custom_checks.go`
2. Add your custom check to the `PredefinedCustomChecks()` function
3. Implement the check logic in the `CheckFunc`

Example:

```go
{
    Name:        "kaptivan-custom-check",
    Description: "Your custom check description",
    Severity:    "warning",
    Category:    "custom",
    CheckFunc: func(ctx context.Context, obj interface{}) []linter.LintResult {
        // Implement your check logic here
        return []linter.LintResult{}
    },
}
```

### Modifying Configuration

Edit `backend/internal/linter/wrapper/config.go` to modify:

- Enabled checks
- Excluded checks
- Custom checks
- Output format

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Ensure kube-linter is properly cloned
   - Check that go.mod is updated correctly
   - Run `go mod tidy` in the backend directory

2. **Build Errors**
   - Verify all dependencies are installed
   - Check Go version compatibility
   - Ensure all imports are correct

3. **Runtime Errors**
   - Check that the linter is properly initialized
   - Verify API endpoints are accessible
   - Check server logs for errors

### Debug Mode

Enable debug logging:

```go
// In wrapper/linter.go
import "log"

func NewLinter(config *Config) (*Linter, error) {
    log.SetLevel(log.DebugLevel)
    // ... rest of the function
}
```

## Updating Kube-Linter

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

## Production Deployment

### Docker Build

```bash
# Build the Docker image
docker build -t kaptivan:latest .

# Run the container
docker run -p 8080:8080 kaptivan:latest
```

### Environment Variables

Set these environment variables for production:

```bash
export PORT=8080
export LOG_LEVEL=info
export KUBE_LINTER_CONFIG_PATH=/path/to/config.yaml
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the kube-linter documentation
3. Check the server logs for errors
4. Verify that all dependencies are properly installed

## Next Steps

After successful setup:

1. Test with various Kubernetes manifests
2. Customize checks for your organization
3. Set up monitoring and alerting
4. Train users on the new linting features
