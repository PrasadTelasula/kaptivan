package sqlquery

// QueryRequest represents the incoming SQL query request
type QueryRequest struct {
	Query string `json:"query" binding:"required"`
}

// QueryResponse represents the response from a SQL query execution
type QueryResponse struct {
	Data     []map[string]interface{} `json:"data"`
	Metadata QueryMetadata            `json:"metadata"`
	Error    string                   `json:"error,omitempty"`
}

// QueryMetadata contains execution information
type QueryMetadata struct {
	ExecutionTime int64  `json:"executionTime"` // in milliseconds
	RowCount      int    `json:"rowCount"`
	ResourceType  string `json:"resourceType"`
	Namespace     string `json:"namespace,omitempty"`
}

// ParsedQuery represents a parsed SQL query
type ParsedQuery struct {
	ResourceType string
	Namespace    string
	Fields       []string
	Conditions   []Condition
	OrderBy      []OrderField
	Limit        int
}

// Condition represents a WHERE clause condition
type Condition struct {
	Field    string
	Operator string
	Value    interface{}
}

// OrderField represents an ORDER BY field
type OrderField struct {
	Field string
	Desc  bool
}

// SupportedOperators defines valid SQL operators
var SupportedOperators = map[string]bool{
	"=":  true,
	"!=": true,
	">":  true,
	"<":  true,
	">=": true,
	"<=": true,
	"~=": true, // approximate match like kubectl-sql
}

// SupportedResources defines valid Kubernetes resources
var SupportedResources = map[string]bool{
	"pods":         true,
	"deployments":  true,
	"services":     true,
	"nodes":        true,
	"namespaces":   true,
	"configmaps":   true,
	"secrets":      true,
	"events":       true,
	"replicasets":  true,
	"daemonsets":   true,
	"statefulsets": true,
	"jobs":         true,
	"cronjobs":     true,
}

// ResourceFieldMappings maps simplified field names to Kubernetes resource paths
var ResourceFieldMappings = map[string]map[string]string{
	"pods": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"phase":     "status.phase",
		"node":      "spec.nodeName",
		"ip":        "status.podIP",
		"ready":     "status.containerStatuses[0].ready",
		"restarts":  "status.containerStatuses[0].restartCount",
		"age":       "metadata.creationTimestamp",
		"image":     "spec.containers[0].image",
		"cpu":       "spec.containers[0].resources.requests.cpu",
		"memory":    "spec.containers[0].resources.requests.memory",
	},
	"deployments": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"ready":     "status.readyReplicas",
		"desired":   "status.replicas",
		"updated":   "status.updatedReplicas",
		"available": "status.availableReplicas",
		"age":       "metadata.creationTimestamp",
	},
	"services": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"type":      "spec.type",
		"cluster":   "spec.clusterIP",
		"external":  "status.loadBalancer.ingress[0].ip",
		"ports":     "spec.ports",
		"age":       "metadata.creationTimestamp",
	},
	"nodes": {
		"name":     "metadata.name",
		"status":   "status.conditions[?(@.type=='Ready')].status",
		"roles":    "metadata.labels['node-role.kubernetes.io/*']",
		"age":      "metadata.creationTimestamp",
		"version":  "status.nodeInfo.kubeletVersion",
		"cpu":      "status.capacity.cpu",
		"memory":   "status.capacity.memory",
		"pods":     "status.capacity.pods",
	},
	"events": {
		"name":         "metadata.name",
		"namespace":    "metadata.namespace",
		"reason":       "reason",
		"message":      "message",
		"type":         "type",
		"object":       "involvedObject.name",
		"objectKind":   "involvedObject.kind",
		"firstTime":    "firstTimestamp",
		"lastTime":     "lastTimestamp",
		"count":        "count",
	},
	"configmaps": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"age":       "metadata.creationTimestamp",
		"keys":      "data",
	},
	"secrets": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"type":      "type",
		"age":       "metadata.creationTimestamp",
		"keys":      "data",
	},
	"namespaces": {
		"name":   "metadata.name",
		"status": "status.phase",
		"age":    "metadata.creationTimestamp",
		"labels": "metadata.labels",
	},
	"statefulsets": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"ready":     "status.readyReplicas",
		"replicas":  "status.replicas",
		"updated":   "status.updatedReplicas",
		"age":       "metadata.creationTimestamp",
	},
	"daemonsets": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"ready":     "status.numberReady",
		"desired":   "status.desiredNumberScheduled",
		"current":   "status.currentNumberScheduled",
		"available": "status.numberAvailable",
		"age":       "metadata.creationTimestamp",
	},
	"replicasets": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"ready":     "status.readyReplicas",
		"replicas":  "status.replicas",
		"available": "status.availableReplicas",
		"age":       "metadata.creationTimestamp",
	},
	"jobs": {
		"name":       "metadata.name",
		"namespace":  "metadata.namespace",
		"completions": "spec.completions",
		"succeeded":  "status.succeeded",
		"failed":     "status.failed",
		"active":     "status.active",
		"age":        "metadata.creationTimestamp",
	},
	"cronjobs": {
		"name":      "metadata.name",
		"namespace": "metadata.namespace",
		"schedule":  "spec.schedule",
		"suspend":   "spec.suspend",
		"active":    "status.active",
		"lastSchedule": "status.lastScheduleTime",
		"age":       "metadata.creationTimestamp",
	},
}