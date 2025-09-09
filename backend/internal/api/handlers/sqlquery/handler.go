package sqlquery

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	"k8s.io/klog/v2"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets up the SQL query handlers with the cluster manager
func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

// HandleQuery handles POST /api/sql/query requests
func HandleQuery(c *gin.Context) {
	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format: " + err.Error(),
		})
		return
	}

	// Get context from request body or default
	context := c.Query("context")
	if context == "" {
		context = "default"
	}

	// Get cluster connection
	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Create validator
	validator := NewSecurityValidator()

	// Log the query (for debugging, remove in production)
	klog.Infof("SQL Query received: %s", req.Query)

	// Validate the raw query for security
	if err := validator.ValidateQuery(req.Query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Query validation failed: " + err.Error(),
		})
		return
	}

	// Parse the SQL query
	parser := NewSQLParser(req.Query)
	parsedQuery, err := parser.Parse()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Query parsing failed: " + err.Error(),
		})
		return
	}

	// Validate the parsed query
	if err := validator.ValidateParsedQuery(parsedQuery); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Parsed query validation failed: " + err.Error(),
		})
		return
	}

	// Validate namespace if specified
	if err := validator.ValidateNamespace(parsedQuery.Namespace); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid namespace: " + err.Error(),
		})
		return
	}

	// Execute the query
	executor := NewQueryExecutor(conn.ClientSet)
	
	// Set timeout for query execution
	ctx := c.Request.Context()
	
	result, err := executor.Execute(ctx, parsedQuery)
	if err != nil {
		klog.Errorf("Query execution failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Query execution failed: " + err.Error(),
		})
		return
	}

	// Return successful response
	c.JSON(http.StatusOK, result)
}

// HandleHealth handles GET /api/sql/health requests
func HandleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "SQL Query Engine",
		"timestamp": time.Now().UTC(),
		"features": gin.H{
			"supported_resources": []string{
				"pods", "deployments", "services", "nodes", 
				"namespaces", "configmaps", "secrets", "events",
			},
			"supported_operations": []string{"SELECT"},
			"security_features": []string{
				"query_validation", "injection_prevention", 
				"resource_isolation", "field_validation",
			},
		},
	})
}

// HandleSchema handles GET /api/sql/schema requests
func HandleSchema(c *gin.Context) {
	resourceType := c.Query("resource")
	dynamic := c.Query("dynamic") == "true"
	context := c.Query("context")
	
	// If dynamic discovery is requested and context is provided
	if dynamic && context != "" {
		HandleDynamicSchema(c)
		return
	}
	
	if resourceType == "" {
		// Return all supported resources and their fields
		schema := make(map[string]interface{})
		
		for resource := range SupportedResources {
			if fieldMappings, exists := ResourceFieldMappings[resource]; exists {
				fields := make([]string, 0, len(fieldMappings))
				for field := range fieldMappings {
					fields = append(fields, field)
				}
				schema[resource] = gin.H{
					"fields": fields,
					"sample_query": getSampleQuery(resource),
				}
			}
		}
		
		c.JSON(http.StatusOK, gin.H{
			"supported_resources": schema,
			"operators": []string{"=", "!=", ">", "<", ">=", "<=", "~="},
			"syntax": gin.H{
				"select": "SELECT field1, field2 FROM resource",
				"where":  "WHERE field = 'value' AND field2 > 10",
				"order":  "ORDER BY field ASC|DESC",
				"limit":  "LIMIT 100",
			},
		})
		return
	}

	// Return schema for specific resource
	if !SupportedResources[resourceType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported resource type: " + resourceType,
		})
		return
	}

	fieldMappings, exists := ResourceFieldMappings[resourceType]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No field mappings found for resource: " + resourceType,
		})
		return
	}

	fields := make([]gin.H, 0, len(fieldMappings))
	for field, path := range fieldMappings {
		fields = append(fields, gin.H{
			"name": field,
			"path": path,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"resource": resourceType,
		"fields":   fields,
		"sample_queries": []string{
			getSampleQuery(resourceType),
			getFilteredSampleQuery(resourceType),
		},
	})
}

// getSampleQuery returns a sample query for a resource type
func getSampleQuery(resourceType string) string {
	switch resourceType {
	case "pods":
		return "SELECT name, namespace, phase, node FROM pods WHERE phase = 'Running' LIMIT 10"
	case "deployments":
		return "SELECT name, namespace, ready, desired FROM deployments LIMIT 10"
	case "services":
		return "SELECT name, namespace, type, cluster FROM services WHERE type = 'LoadBalancer'"
	case "nodes":
		return "SELECT name, status, version, cpu FROM nodes"
	case "events":
		return "SELECT reason, message, object, firstTime FROM events ORDER BY firstTime DESC LIMIT 10"
	default:
		return "SELECT * FROM " + resourceType + " LIMIT 10"
	}
}

// getFilteredSampleQuery returns a sample query with filters for a resource type
func getFilteredSampleQuery(resourceType string) string {
	switch resourceType {
	case "pods":
		return "SELECT name, namespace, phase FROM pods WHERE namespace = 'default' AND phase != 'Running'"
	case "deployments":
		return "SELECT name, ready, desired FROM deployments WHERE ready < desired"
	case "services":
		return "SELECT name, type, ports FROM services WHERE namespace = 'kube-system'"
	case "nodes":
		return "SELECT name, status, cpu, memory FROM nodes WHERE status = 'True'"
	case "events":
		return "SELECT reason, message, count FROM events WHERE reason ~= 'Failed' ORDER BY count DESC"
	default:
		return "SELECT * FROM " + resourceType + " WHERE namespace = 'default'"
	}
}

// HandleDynamicSchema provides dynamic schema discovery from actual resources
func HandleDynamicSchema(c *gin.Context) {
	resourceType := c.Query("resource")
	context := c.Query("context")
	if context == "" {
		context = "default"
	}
	
	// Get cluster connection
	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}
	
	executor := NewQueryExecutor(conn.ClientSet)
	
	// Discover fields for the resource type
	fields, samples, err := executor.DiscoverSchema(c.Request.Context(), resourceType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to discover schema: " + err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"resource":      resourceType,
		"fields":        fields,
		"field_samples": samples,
		"dynamic":       true,
	})
}