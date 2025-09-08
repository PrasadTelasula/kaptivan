package namespaces

import (
	"time"
)

// NamespaceSnapshot represents a complete snapshot of namespace resources and metrics
type NamespaceSnapshot struct {
	Namespace string    `json:"namespace"`
	Cluster   string    `json:"cluster"`
	Timestamp time.Time `json:"timestamp"`
	
	// Resource capacity metrics
	Capacity CapacityMetrics `json:"capacity"`
	
	// Stability metrics
	Stability StabilityMetrics `json:"stability"`
	
	// Exposure metrics
	Exposure ExposureMetrics `json:"exposure"`
	
	// Quota metrics
	Quota QuotaMetrics `json:"quota"`
	
	// Storage metrics
	Storage StorageMetrics `json:"storage"`
	
	// RBAC metrics
	RBAC RBACMetrics `json:"rbac"`
}

// CapacityMetrics represents resource capacity and usage
type CapacityMetrics struct {
	CPU    ResourceMetric `json:"cpu"`
	Memory ResourceMetric `json:"memory"`
}

// ResourceMetric represents a single resource metric
type ResourceMetric struct {
	Requested string  `json:"requested"`
	Limit     string  `json:"limit"`
	Available string  `json:"available"`
	Headroom  float64 `json:"headroom"`
}

// StabilityMetrics represents pod stability metrics
type StabilityMetrics struct {
	CrashLoops24h int `json:"crashLoops24h"`
	Restarts24h   int `json:"restarts24h"`
	PendingOver5m int `json:"pendingOver5m"`
}

// ExposureMetrics represents network exposure metrics
type ExposureMetrics struct {
	Services         int      `json:"services"`
	IngressHosts     []string `json:"ingressHosts"`
	HasNetworkPolicy bool     `json:"hasNetworkPolicy"`
}

// QuotaMetrics represents resource quota metrics
type QuotaMetrics struct {
	HasResourceQuota bool              `json:"hasResourceQuota"`
	TopUsage         map[string]string `json:"topUsage"`
	HasLimitRange    bool              `json:"hasLimitRange"`
}

// StorageMetrics represents storage usage metrics
type StorageMetrics struct {
	PVCCount     int `json:"pvcCount"`
	RequestedGi  int `json:"requestedGi"`
	UnboundPVCs  int `json:"unboundPVCs"`
	OrphanedPVCs int `json:"orphanedPVCs"`
}

// RBACMetrics represents RBAC configuration metrics
type RBACMetrics struct {
	AdminBindings  int `json:"adminBindings"`
	WildcardRules  int `json:"wildcardRules"`
}

// ComparisonRequest represents a request to compare two namespaces
type ComparisonRequest struct {
	ClusterA   string `json:"clusterA" binding:"required"`
	NamespaceA string `json:"namespaceA" binding:"required"`
	ClusterB   string `json:"clusterB" binding:"required"`
	NamespaceB string `json:"namespaceB" binding:"required"`
}

// ComparisonResponse represents the comparison result
type ComparisonResponse struct {
	SnapshotA *NamespaceSnapshot `json:"snapshotA"`
	SnapshotB *NamespaceSnapshot `json:"snapshotB"`
	Rows      []CompareRow       `json:"rows"`
}

// CompareRow represents a single row in the comparison table
type CompareRow struct {
	Category    string      `json:"category"`
	Metric      string      `json:"metric"`
	ValueA      interface{} `json:"valueA"`
	ValueB      interface{} `json:"valueB"`
	Severity    string      `json:"severity"`
	Trend       string      `json:"trend"`
	Significant bool        `json:"significant"`
}