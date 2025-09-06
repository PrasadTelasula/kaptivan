package search

import (
	"fmt"
	"strings"
	
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
)

// FieldSelectorBuilder constructs Kubernetes field selectors for efficient queries
type FieldSelectorBuilder struct {
	selectors []string
}

// NewFieldSelectorBuilder creates a new field selector builder
func NewFieldSelectorBuilder() *FieldSelectorBuilder {
	return &FieldSelectorBuilder{
		selectors: []string{},
	}
}

// BuildForPods creates field selectors for pod queries
func (fsb *FieldSelectorBuilder) BuildForPods(opts SearchOptions) string {
	fsb.reset()
	
	// Add pod-specific field selectors
	if len(opts.Pods) == 1 && !strings.Contains(opts.Pods[0], "*") {
		fsb.addSelector("metadata.name", opts.Pods[0])
	}
	
	// Add namespace selector
	if len(opts.Namespaces) == 1 {
		fsb.addSelector("metadata.namespace", opts.Namespaces[0])
	}
	
	// Add status phase selector if provided
	if phase, ok := opts.FieldSelectors["status.phase"]; ok {
		fsb.addSelector("status.phase", phase)
	}
	
	// Add node selector if provided
	if nodeName, ok := opts.FieldSelectors["spec.nodeName"]; ok {
		fsb.addSelector("spec.nodeName", nodeName)
	}
	
	return fsb.build()
}

// BuildForEvents creates field selectors for event queries
func (fsb *FieldSelectorBuilder) BuildForEvents(namespace, podName string) string {
	fsb.reset()
	
	if namespace != "" {
		fsb.addSelector("metadata.namespace", namespace)
	}
	
	if podName != "" {
		fsb.addSelector("involvedObject.name", podName)
		fsb.addSelector("involvedObject.kind", "Pod")
	}
	
	return fsb.build()
}

// BuildForServices creates field selectors for service queries
func (fsb *FieldSelectorBuilder) BuildForServices(opts SearchOptions) string {
	fsb.reset()
	
	if len(opts.Namespaces) == 1 {
		fsb.addSelector("metadata.namespace", opts.Namespaces[0])
	}
	
	// Add service type selector if provided
	if serviceType, ok := opts.FieldSelectors["spec.type"]; ok {
		fsb.addSelector("spec.type", serviceType)
	}
	
	return fsb.build()
}

// BuildCustom creates a custom field selector from a map
func (fsb *FieldSelectorBuilder) BuildCustom(fields map[string]string) string {
	fsb.reset()
	
	for field, value := range fields {
		fsb.addSelector(field, value)
	}
	
	return fsb.build()
}

// CreateListOptions creates Kubernetes ListOptions with field selectors
func (fsb *FieldSelectorBuilder) CreateListOptions(opts SearchOptions) metav1.ListOptions {
	listOpts := metav1.ListOptions{}
	
	// Build field selector
	if fieldSelector := fsb.BuildForPods(opts); fieldSelector != "" {
		listOpts.FieldSelector = fieldSelector
	}
	
	// Add label selector if provided
	if len(opts.LabelSelectors) > 0 {
		labelPairs := []string{}
		for key, value := range opts.LabelSelectors {
			labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", key, value))
		}
		listOpts.LabelSelector = strings.Join(labelPairs, ",")
	}
	
	// Add resource version for watch operations
	if rv, ok := opts.FieldSelectors["resourceVersion"]; ok {
		listOpts.ResourceVersion = rv
	}
	
	// Set limit if specified
	if opts.Limit > 0 {
		listOpts.Limit = int64(opts.Limit)
	}
	
	return listOpts
}

// ParseFieldSelector parses a field selector string into a map
func (fsb *FieldSelectorBuilder) ParseFieldSelector(selector string) (map[string]string, error) {
	result := make(map[string]string)
	
	if selector == "" {
		return result, nil
	}
	
	// Parse using Kubernetes fields package
	fs, err := fields.ParseSelector(selector)
	if err != nil {
		return nil, fmt.Errorf("invalid field selector: %w", err)
	}
	
	// Extract requirements
	requirements := fs.Requirements()
	for _, req := range requirements {
		result[req.Field] = req.Value
	}
	
	return result, nil
}

// ValidateFieldSelector validates if a field selector is supported
func (fsb *FieldSelectorBuilder) ValidateFieldSelector(resourceType, field string) bool {
	// Define supported field selectors per resource type
	supportedFields := map[string][]string{
		"pods": {
			"metadata.name",
			"metadata.namespace",
			"spec.nodeName",
			"spec.restartPolicy",
			"spec.schedulerName",
			"spec.serviceAccountName",
			"status.phase",
			"status.podIP",
			"status.nominatedNodeName",
		},
		"services": {
			"metadata.name",
			"metadata.namespace",
			"spec.type",
		},
		"nodes": {
			"metadata.name",
			"spec.unschedulable",
		},
		"events": {
			"metadata.name",
			"metadata.namespace",
			"involvedObject.apiVersion",
			"involvedObject.fieldPath",
			"involvedObject.kind",
			"involvedObject.name",
			"involvedObject.namespace",
			"involvedObject.resourceVersion",
			"involvedObject.uid",
			"reason",
			"reportingController",
			"source",
			"type",
		},
		"namespaces": {
			"metadata.name",
			"status.phase",
		},
	}
	
	if fields, ok := supportedFields[resourceType]; ok {
		for _, supportedField := range fields {
			if supportedField == field {
				return true
			}
		}
	}
	
	return false
}

// addSelector adds a field selector
func (fsb *FieldSelectorBuilder) addSelector(field, value string) {
	if value != "" {
		fsb.selectors = append(fsb.selectors, fmt.Sprintf("%s=%s", field, value))
	}
}

// reset clears all selectors
func (fsb *FieldSelectorBuilder) reset() {
	fsb.selectors = []string{}
}

// build creates the final field selector string
func (fsb *FieldSelectorBuilder) build() string {
	return strings.Join(fsb.selectors, ",")
}

// OptimizeQuery optimizes search options for Kubernetes API efficiency
func OptimizeQuery(opts SearchOptions) SearchOptions {
	optimized := opts
	
	// If searching in a single namespace, use field selector instead of filtering
	if len(opts.Namespaces) == 1 {
		if optimized.FieldSelectors == nil {
			optimized.FieldSelectors = make(map[string]string)
		}
		optimized.FieldSelectors["metadata.namespace"] = opts.Namespaces[0]
	}
	
	// If searching for a specific pod, use field selector
	if len(opts.Pods) == 1 && !strings.Contains(opts.Pods[0], "*") {
		if optimized.FieldSelectors == nil {
			optimized.FieldSelectors = make(map[string]string)
		}
		optimized.FieldSelectors["metadata.name"] = opts.Pods[0]
	}
	
	// Optimize limit - never request more than 1000 items at once
	if optimized.Limit == 0 || optimized.Limit > 1000 {
		optimized.Limit = 1000
	}
	
	return optimized
}