package sqlquery

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
)

// QueryExecutor executes parsed SQL queries against Kubernetes API
type QueryExecutor struct {
	client kubernetes.Interface
}

// NewQueryExecutor creates a new query executor
func NewQueryExecutor(client kubernetes.Interface) *QueryExecutor {
	return &QueryExecutor{client: client}
}

// Execute executes a parsed query and returns results
func (e *QueryExecutor) Execute(ctx context.Context, query *ParsedQuery) (*QueryResponse, error) {
	startTime := time.Now()

	// Fetch data from Kubernetes API
	items, err := e.fetchResourceData(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch resource data: %w", err)
	}

	// Convert to map format and apply filters
	results := []map[string]interface{}{}
	for _, item := range items {
		itemMap := e.convertToMap(item)
		
		// Apply WHERE conditions
		if e.matchesConditions(itemMap, query.Conditions) {
			// Extract requested fields
			result := e.extractFields(itemMap, query.Fields, query.ResourceType)
			results = append(results, result)
		}
	}

	// Apply ORDER BY
	if len(query.OrderBy) > 0 {
		e.sortResults(results, query.OrderBy)
	}

	// Apply LIMIT
	if query.Limit > 0 && len(results) > query.Limit {
		results = results[:query.Limit]
	}

	executionTime := time.Since(startTime).Milliseconds()

	return &QueryResponse{
		Data: results,
		Metadata: QueryMetadata{
			ExecutionTime: executionTime,
			RowCount:      len(results),
			ResourceType:  query.ResourceType,
		},
	}, nil
}

// fetchResourceData fetches resources from Kubernetes API based on query
func (e *QueryExecutor) fetchResourceData(ctx context.Context, query *ParsedQuery) ([]runtime.Object, error) {
	namespace := ""
	if query.Namespace != "" {
		namespace = query.Namespace
	}

	switch query.ResourceType {
	case "pods":
		podList, err := e.client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(podList.Items))
		for i := range podList.Items {
			items[i] = &podList.Items[i]
		}
		return items, nil

	case "deployments":
		deployList, err := e.client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(deployList.Items))
		for i := range deployList.Items {
			items[i] = &deployList.Items[i]
		}
		return items, nil

	case "services":
		svcList, err := e.client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(svcList.Items))
		for i := range svcList.Items {
			items[i] = &svcList.Items[i]
		}
		return items, nil

	case "nodes":
		nodeList, err := e.client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(nodeList.Items))
		for i := range nodeList.Items {
			items[i] = &nodeList.Items[i]
		}
		return items, nil

	case "namespaces":
		nsList, err := e.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(nsList.Items))
		for i := range nsList.Items {
			items[i] = &nsList.Items[i]
		}
		return items, nil

	case "configmaps":
		cmList, err := e.client.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(cmList.Items))
		for i := range cmList.Items {
			items[i] = &cmList.Items[i]
		}
		return items, nil

	case "secrets":
		secretList, err := e.client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(secretList.Items))
		for i := range secretList.Items {
			items[i] = &secretList.Items[i]
		}
		return items, nil

	case "events":
		eventList, err := e.client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(eventList.Items))
		for i := range eventList.Items {
			items[i] = &eventList.Items[i]
		}
		return items, nil

	case "statefulsets":
		ssList, err := e.client.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(ssList.Items))
		for i := range ssList.Items {
			items[i] = &ssList.Items[i]
		}
		return items, nil

	case "daemonsets":
		dsList, err := e.client.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(dsList.Items))
		for i := range dsList.Items {
			items[i] = &dsList.Items[i]
		}
		return items, nil

	case "replicasets":
		rsList, err := e.client.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(rsList.Items))
		for i := range rsList.Items {
			items[i] = &rsList.Items[i]
		}
		return items, nil

	case "jobs":
		jobList, err := e.client.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(jobList.Items))
		for i := range jobList.Items {
			items[i] = &jobList.Items[i]
		}
		return items, nil

	case "cronjobs":
		cjList, err := e.client.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		items := make([]runtime.Object, len(cjList.Items))
		for i := range cjList.Items {
			items[i] = &cjList.Items[i]
		}
		return items, nil

	default:
		return nil, fmt.Errorf("unsupported resource type: %s", query.ResourceType)
	}
}

// convertToMap converts a Kubernetes object to a flattened map using JSON marshaling
func (e *QueryExecutor) convertToMap(obj runtime.Object) map[string]interface{} {
	// Convert object to JSON then to map for complete structure
	jsonBytes, err := json.Marshal(obj)
	if err != nil {
		// Fallback to basic conversion if JSON marshal fails
		return e.basicConvertToMap(obj)
	}

	var fullMap map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &fullMap); err != nil {
		// Fallback to basic conversion if JSON unmarshal fails
		return e.basicConvertToMap(obj)
	}

	// Flatten the nested structure
	flattened := e.flattenMap(fullMap, "")
	
	// Add computed fields
	e.addComputedFields(flattened, obj)
	
	return flattened
}

// DiscoverSchema dynamically discovers fields from actual resources
func (e *QueryExecutor) DiscoverSchema(ctx context.Context, resourceType string) ([]FieldInfo, map[string]interface{}, error) {
	if !SupportedResources[resourceType] {
		return nil, nil, fmt.Errorf("unsupported resource type: %s", resourceType)
	}
	
	// Get a sample of resources to discover fields
	query := &ParsedQuery{
		ResourceType: resourceType,
		Namespace:    "",
		Fields:       []string{"*"},
		Conditions:   []Condition{},
		OrderBy:      []OrderField{},
		Limit:        5, // Get just 5 samples for discovery
	}
	
	result, err := e.Execute(ctx, query)
	if err != nil {
		return nil, nil, err
	}
	
	// Collect all unique fields from the samples
	fieldMap := make(map[string]FieldInfo)
	fieldSamples := make(map[string]interface{})
	
	if result != nil && len(result.Data) > 0 {
		data := result.Data
		for _, item := range data {
			for field, value := range item {
				if _, exists := fieldMap[field]; !exists {
					// Determine field type
					fieldType := getFieldType(value)
					fieldMap[field] = FieldInfo{
						Name:        field,
						Type:        fieldType,
						Description: getFieldDescription(resourceType, field),
						Path:        field,
					}
					
					// Store a sample value
					if value != nil && value != "" {
						fieldSamples[field] = value
					}
				}
			}
		}
	}
	
	// Convert map to slice
	fields := make([]FieldInfo, 0, len(fieldMap))
	for _, info := range fieldMap {
		fields = append(fields, info)
	}
	
	// Sort fields for consistent ordering
	sort.Slice(fields, func(i, j int) bool {
		// Priority order: name, namespace, then alphabetical
		order := map[string]int{"name": 0, "namespace": 1}
		iOrder, iHasPriority := order[fields[i].Name]
		jOrder, jHasPriority := order[fields[j].Name]
		
		if iHasPriority && jHasPriority {
			return iOrder < jOrder
		}
		if iHasPriority {
			return true
		}
		if jHasPriority {
			return false
		}
		return fields[i].Name < fields[j].Name
	})
	
	return fields, fieldSamples, nil
}

// flattenMap flattens a nested map structure using dot notation
func (e *QueryExecutor) flattenMap(m map[string]interface{}, prefix string) map[string]interface{} {
	result := make(map[string]interface{})
	
	for key, value := range m {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}
		
		switch v := value.(type) {
		case map[string]interface{}:
			// Recursively flatten nested maps
			nested := e.flattenMap(v, fullKey)
			for k, val := range nested {
				result[k] = val
			}
			// Also keep the original nested structure for complex queries
			result[fullKey] = v
		case []interface{}:
			// Keep arrays as is
			result[fullKey] = v
		default:
			// Keep primitive values
			result[fullKey] = v
		}
	}
	
	// Add top-level aliases for common fields
	if prefix == "" {
		e.addFieldAliases(result)
	}
	
	return result
}

// addFieldAliases adds common field aliases for easier querying
func (e *QueryExecutor) addFieldAliases(m map[string]interface{}) {
	// Add short aliases for commonly used fields
	if val, ok := m["metadata.name"]; ok {
		m["name"] = val
	}
	if val, ok := m["metadata.namespace"]; ok {
		m["namespace"] = val
	}
	if val, ok := m["metadata.labels"]; ok {
		m["labels"] = val
	}
	if val, ok := m["metadata.annotations"]; ok {
		m["annotations"] = val
	}
	if val, ok := m["status.phase"]; ok {
		m["phase"] = val
	}
	if val, ok := m["spec.nodeName"]; ok {
		m["node"] = val
	}
	if val, ok := m["spec.type"]; ok {
		m["type"] = val
	}
	if val, ok := m["status.readyReplicas"]; ok {
		m["ready"] = val
	}
	if val, ok := m["spec.replicas"]; ok {
		m["desired"] = val
	}
	if val, ok := m["status.replicas"]; ok && m["desired"] == nil {
		m["replicas"] = val
	}
}

// addComputedFields adds computed fields like age
func (e *QueryExecutor) addComputedFields(m map[string]interface{}, obj runtime.Object) {
	// Add age field
	if creationTime, ok := m["metadata.creationTimestamp"]; ok {
		if timeStr, ok := creationTime.(string); ok {
			if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
				age := time.Since(t)
				m["age"] = formatDuration(age)
				m["ageSeconds"] = int64(age.Seconds())
			}
		}
	}
	
	// Add resource-specific computed fields based on type
	switch obj.(type) {
	case *corev1.Pod:
		// Add container count
		if containers, ok := m["spec.containers"]; ok {
			if containerList, ok := containers.([]interface{}); ok {
				m["containerCount"] = len(containerList)
			}
		}
		
		// Add simplified IP field - check flattened field
		if podIP, ok := m["status.podIP"]; ok {
			// The field exists in the flattened structure
			if podIP != nil {
				ipStr := fmt.Sprintf("%v", podIP)
				if ipStr != "" && ipStr != "<nil>" {
					m["ip"] = podIP
				}
			}
		}
		
		// Add simplified node field  
		if nodeName, ok := m["spec.nodeName"]; ok {
			if nodeName != nil && fmt.Sprintf("%v", nodeName) != "" {
				m["node"] = nodeName
			}
		}
		
		// Add simplified phase field
		if phase, ok := m["status.phase"]; ok {
			if phase != nil && fmt.Sprintf("%v", phase) != "" {
				m["phase"] = phase
			}
		}
		
		// Also check for nested status object (in case it wasn't flattened)
		if status, ok := m["status"].(map[string]interface{}); ok {
			if podIP, ok := status["podIP"]; ok && podIP != nil {
				m["ip"] = podIP
			}
			if phase, ok := status["phase"]; ok && phase != nil {
				m["phase"] = phase
			}
		}
		
		// Check spec for nodeName as well
		if spec, ok := m["spec"].(map[string]interface{}); ok {
			if nodeName, ok := spec["nodeName"]; ok && nodeName != nil {
				m["node"] = nodeName
			}
		}
		
		// Extract first container image as simplified field
		if containers, ok := m["spec.containers"]; ok {
			if containerList, ok := containers.([]interface{}); ok && len(containerList) > 0 {
				if firstContainer, ok := containerList[0].(map[string]interface{}); ok {
					if image, ok := firstContainer["image"]; ok {
						m["image"] = image
					}
					// Extract resource requests
					if resources, ok := firstContainer["resources"].(map[string]interface{}); ok {
						if requests, ok := resources["requests"].(map[string]interface{}); ok {
							if cpu, ok := requests["cpu"]; ok {
								m["cpu"] = cpu
							}
							if memory, ok := requests["memory"]; ok {
								m["memory"] = memory
							}
						}
					}
				}
			}
		}
		
	case *appsv1.Deployment:
		// Add availability status
		ready := getIntValue(m["status.readyReplicas"])
		desired := getIntValue(m["spec.replicas"])
		if desired > 0 {
			m["availability"] = fmt.Sprintf("%d/%d", ready, desired)
			m["available"] = ready == desired
		}
		
		// Add simplified replicas fields
		if ready := m["status.readyReplicas"]; ready != nil {
			m["ready"] = ready
		}
		if desired := m["spec.replicas"]; desired != nil {
			m["desired"] = desired
		}
	}
}

// basicConvertToMap provides basic conversion as fallback
func (e *QueryExecutor) basicConvertToMap(obj runtime.Object) map[string]interface{} {
	result := make(map[string]interface{})
	
	switch v := obj.(type) {
	case *corev1.Pod:
		result["name"] = v.Name
		result["namespace"] = v.Namespace
		result["phase"] = string(v.Status.Phase)
		result["node"] = v.Spec.NodeName
		if !v.CreationTimestamp.IsZero() {
			result["age"] = formatDuration(time.Since(v.CreationTimestamp.Time))
		}
	case *appsv1.Deployment:
		result["name"] = v.Name
		result["namespace"] = v.Namespace
		if v.Spec.Replicas != nil {
			result["desired"] = *v.Spec.Replicas
		}
		result["ready"] = v.Status.ReadyReplicas
		if !v.CreationTimestamp.IsZero() {
			result["age"] = formatDuration(time.Since(v.CreationTimestamp.Time))
		}
	// Add other resource types as needed
	}
	
	return result
}

// matchesConditions checks if an item matches all WHERE conditions
func (e *QueryExecutor) matchesConditions(item map[string]interface{}, conditions []Condition) bool {
	for _, condition := range conditions {
		if !e.matchesCondition(item, condition) {
			return false
		}
	}
	return true
}

// matchesCondition checks if an item matches a single WHERE condition
func (e *QueryExecutor) matchesCondition(item map[string]interface{}, condition Condition) bool {
	value := e.getFieldValue(item, condition.Field)
	
	// Handle null checks
	if condition.Operator == "IS" && strings.ToUpper(fmt.Sprintf("%v", condition.Value)) == "NULL" {
		return value == nil || value == ""
	}
	if condition.Operator == "IS NOT" && strings.ToUpper(fmt.Sprintf("%v", condition.Value)) == "NULL" {
		return value != nil && value != ""
	}
	
	if value == nil {
		return false
	}

	switch condition.Operator {
	case "=":
		return e.compareValues(value, condition.Value) == 0
	case "!=":
		return e.compareValues(value, condition.Value) != 0
	case ">":
		return e.compareValues(value, condition.Value) > 0
	case "<":
		return e.compareValues(value, condition.Value) < 0
	case ">=":
		return e.compareValues(value, condition.Value) >= 0
	case "<=":
		return e.compareValues(value, condition.Value) <= 0
	case "~=":
		return strings.Contains(fmt.Sprintf("%v", value), fmt.Sprintf("%v", condition.Value))
	default:
		return false
	}
}

// getFieldValue gets a field value from the item map, supporting nested paths
func (e *QueryExecutor) getFieldValue(item map[string]interface{}, field string) interface{} {
	// First try direct lookup (for flattened fields and aliases)
	if val, exists := item[field]; exists {
		return val
	}
	
	// Try to map simplified field name to actual Kubernetes path
	// Get resource type from the item if available
	var resourceType string
	if kind, ok := item["kind"]; ok {
		resourceType = strings.ToLower(fmt.Sprintf("%v", kind)) + "s"
	}
	
	// Check if this is a simplified field that needs mapping
	if resourceType != "" {
		if mappings, ok := ResourceFieldMappings[resourceType]; ok {
			if actualPath, ok := mappings[field]; ok {
				// Try to get value using the actual Kubernetes path
				if val, exists := item[actualPath]; exists {
					return val
				}
			}
		}
	}
	
	// Try with dot notation for nested fields
	if strings.Contains(field, ".") {
		// First check if the full path exists in flattened map
		if val, exists := item[field]; exists {
			return val
		}
		
		// Then try navigating through nested structure
		parts := strings.Split(field, ".")
		current := item
		
		for i, part := range parts {
			if i == len(parts)-1 {
				// Last part - return the value
				return current[part]
			}
			
			// Navigate deeper
			if next, ok := current[part]; ok {
				if nextMap, ok := next.(map[string]interface{}); ok {
					current = nextMap
				} else {
					return nil
				}
			} else {
				return nil
			}
		}
	}
	
	return nil
}

// compareValues compares two values and returns -1, 0, or 1
func (e *QueryExecutor) compareValues(a, b interface{}) int {
	// Handle nil values
	if a == nil && b == nil {
		return 0
	}
	if a == nil {
		return -1
	}
	if b == nil {
		return 1
	}

	// Try numeric comparison first
	aFloat, aErr := toFloat64(a)
	bFloat, bErr := toFloat64(b)
	if aErr == nil && bErr == nil {
		if aFloat < bFloat {
			return -1
		}
		if aFloat > bFloat {
			return 1
		}
		return 0
	}

	// Fall back to string comparison
	aStr := fmt.Sprintf("%v", a)
	bStr := fmt.Sprintf("%v", b)
	return strings.Compare(aStr, bStr)
}

// extractFields extracts requested fields from an item
func (e *QueryExecutor) extractFields(item map[string]interface{}, fields []string, resourceType string) map[string]interface{} {
	// If SELECT *, return all flattened fields
	if len(fields) == 1 && fields[0] == "*" {
		result := make(map[string]interface{})
		for key, value := range item {
			// Skip deeply nested structures for readability
			if !strings.Contains(key, ".") || isImportantNestedField(key) {
				result[key] = e.formatValue(value, key)
			}
		}
		return result
	}
	
	// Extract specific fields
	result := make(map[string]interface{})
	for _, field := range fields {
		// Check if this is a simplified field that needs mapping
		actualField := field
		if mappings, ok := ResourceFieldMappings[resourceType]; ok {
			if mappedPath, ok := mappings[field]; ok {
				// Use the mapped path to get the value, but keep the simplified name in result
				if val, exists := item[mappedPath]; exists {
					result[field] = e.formatValue(val, field)
					continue
				}
			}
		}
		
		// Try getting the field directly
		value := e.getFieldValue(item, actualField)
		if value != nil {
			result[field] = e.formatValue(value, field)
		} else {
			result[field] = nil
		}
	}
	
	return result
}

// isImportantNestedField checks if a nested field should be included in SELECT *
func isImportantNestedField(field string) bool {
	importantPrefixes := []string{
		"metadata.name",
		"metadata.namespace",
		"metadata.labels",
		"metadata.annotations",
		"metadata.creationTimestamp",
		"metadata.uid",
		"status.phase",
		"status.conditions",
		"spec.type",
		"spec.replicas",
		"spec.nodeName",
	}
	
	for _, prefix := range importantPrefixes {
		if strings.HasPrefix(field, prefix) {
			return true
		}
	}
	return false
}

// formatValue formats a value for display
func (e *QueryExecutor) formatValue(value interface{}, field string) interface{} {
	if value == nil {
		return nil
	}

	// Handle complex types
	switch v := value.(type) {
	case map[string]interface{}:
		// For labels and annotations, return as JSON string for readability
		if strings.Contains(field, "labels") || strings.Contains(field, "annotations") {
			if len(v) == 0 {
				return "{}"
			}
			jsonBytes, _ := json.Marshal(v)
			return string(jsonBytes)
		}
		return v
	case []interface{}:
		// Format arrays
		if len(v) == 0 {
			return "[]"
		}
		jsonBytes, _ := json.Marshal(v)
		return string(jsonBytes)
	}

	return value
}

// sortResults sorts the results based on ORDER BY clauses
func (e *QueryExecutor) sortResults(results []map[string]interface{}, orderBy []OrderField) {
	sort.Slice(results, func(i, j int) bool {
		for _, order := range orderBy {
			valI := e.getFieldValue(results[i], order.Field)
			valJ := e.getFieldValue(results[j], order.Field)

			cmp := e.compareValues(valI, valJ)
			if cmp != 0 {
				if order.Desc {
					return cmp > 0
				}
				return cmp < 0
			}
		}
		return false
	})
}

// Helper functions

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	days := int(d.Hours() / 24)
	return fmt.Sprintf("%dd", days)
}

func toFloat64(v interface{}) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
	case float32:
		return float64(val), nil
	case int:
		return float64(val), nil
	case int32:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case string:
		return strconv.ParseFloat(val, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", v)
	}
}

func getIntValue(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case int32:
		return int(val)
	case int64:
		return int(val)
	default:
		return 0
	}
}

// FieldInfo contains information about a field
type FieldInfo struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Path        string `json:"path"`
}

// getFieldType determines the type of a field value
func getFieldType(value interface{}) string {
	if value == nil {
		return "null"
	}
	
	switch v := value.(type) {
	case string:
		return "string"
	case int, int32, int64, float32, float64:
		return "number"
	case bool:
		return "boolean"
	case map[string]interface{}:
		return "object"
	case []interface{}:
		return "array"
	default:
		return fmt.Sprintf("%T", v)
	}
}

// getFieldDescription provides descriptions for common Kubernetes fields
func getFieldDescription(resourceType, field string) string {
	commonDescriptions := map[string]string{
		"name":                     "Name of the resource",
		"namespace":                "Namespace where the resource is located",
		"uid":                      "Unique identifier for the resource",
		"creationTimestamp":        "Time when the resource was created",
		"labels":                   "Key-value pairs for organizing resources",
		"annotations":              "Key-value pairs for storing metadata",
		"phase":                    "Current lifecycle phase of the resource",
		"status":                   "Current status of the resource",
		"spec":                     "Desired state specification",
		"metadata":                 "Resource metadata",
		"metadata.name":            "Name of the resource",
		"metadata.namespace":       "Namespace of the resource",
		"metadata.labels":          "Labels attached to the resource",
		"metadata.annotations":     "Annotations attached to the resource",
		"metadata.creationTimestamp": "Creation time of the resource",
		"metadata.generation":      "Generation number",
		"metadata.resourceVersion": "Version of the resource",
		"metadata.uid":            "Unique identifier",
		"spec.containers":         "Container specifications",
		"spec.replicas":           "Number of desired replicas",
		"spec.selector":           "Label selector for pods",
		"spec.template":           "Pod template specification",
		"status.phase":            "Current phase of the pod",
		"status.conditions":       "Current conditions",
		"status.containerStatuses": "Status of containers",
		"status.replicas":         "Current number of replicas",
		"status.readyReplicas":    "Number of ready replicas",
	}
	
	// Check for exact match
	if desc, exists := commonDescriptions[field]; exists {
		return desc
	}
	
	// Check for partial matches
	for key, desc := range commonDescriptions {
		if strings.HasSuffix(field, "."+key) {
			return desc
		}
	}
	
	// Resource-specific descriptions
	switch resourceType {
	case "pods":
		switch field {
		case "node":
			return "Node where the pod is running"
		case "hostIP":
			return "IP address of the host node"
		case "podIP":
			return "IP address allocated to the pod"
		case "startTime":
			return "Time when the pod started"
		}
	case "deployments":
		switch field {
		case "ready":
			return "Number of ready replicas"
		case "desired":
			return "Desired number of replicas"
		case "available":
			return "Number of available replicas"
		}
	case "services":
		switch field {
		case "type":
			return "Service type (ClusterIP, NodePort, LoadBalancer)"
		case "clusterIP":
			return "Cluster-internal IP address"
		case "ports":
			return "List of exposed ports"
		}
	case "nodes":
		switch field {
		case "cpu":
			return "CPU capacity and allocatable"
		case "memory":
			return "Memory capacity and allocatable"
		case "version":
			return "Kubernetes version"
		}
	}
	
	return ""
}