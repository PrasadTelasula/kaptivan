package namespaces

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Comparator compares two namespace snapshots
type Comparator struct{}

// NewComparator creates a new namespace comparator
func NewComparator() *Comparator {
	return &Comparator{}
}

// Compare generates comparison rows between two snapshots
func (c *Comparator) Compare(snapshotA, snapshotB *NamespaceSnapshot) []CompareRow {
	var rows []CompareRow
	
	// Compare capacity metrics
	rows = append(rows, c.compareCapacity(snapshotA.Capacity, snapshotB.Capacity)...)
	
	// Compare stability metrics
	rows = append(rows, c.compareStability(snapshotA.Stability, snapshotB.Stability)...)
	
	// Compare exposure metrics
	rows = append(rows, c.compareExposure(snapshotA.Exposure, snapshotB.Exposure)...)
	
	// Compare quota metrics
	rows = append(rows, c.compareQuota(snapshotA.Quota, snapshotB.Quota)...)
	
	// Compare storage metrics
	rows = append(rows, c.compareStorage(snapshotA.Storage, snapshotB.Storage)...)
	
	// Compare RBAC metrics
	rows = append(rows, c.compareRBAC(snapshotA.RBAC, snapshotB.RBAC)...)
	
	return rows
}

func (c *Comparator) compareCapacity(a, b CapacityMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "Capacity",
			Metric:      "CPU Requested",
			ValueA:      a.CPU.Requested,
			ValueB:      b.CPU.Requested,
			Severity:    c.calculateResourceSeverity(a.CPU.Requested, b.CPU.Requested),
			Trend:       c.calculateTrend(a.CPU.Requested, b.CPU.Requested),
			Significant: c.isSignificantDifference(a.CPU.Requested, b.CPU.Requested, 0.2),
		},
		{
			Category:    "Capacity",
			Metric:      "CPU Limit",
			ValueA:      a.CPU.Limit,
			ValueB:      b.CPU.Limit,
			Severity:    c.calculateResourceSeverity(a.CPU.Limit, b.CPU.Limit),
			Trend:       c.calculateTrend(a.CPU.Limit, b.CPU.Limit),
			Significant: c.isSignificantDifference(a.CPU.Limit, b.CPU.Limit, 0.2),
		},
		{
			Category:    "Capacity",
			Metric:      "CPU Headroom",
			ValueA:      fmt.Sprintf("%.1f%%", a.CPU.Headroom),
			ValueB:      fmt.Sprintf("%.1f%%", b.CPU.Headroom),
			Severity:    c.calculateHeadroomSeverity(a.CPU.Headroom, b.CPU.Headroom),
			Trend:       c.calculateFloatTrend(a.CPU.Headroom, b.CPU.Headroom),
			Significant: math.Abs(a.CPU.Headroom-b.CPU.Headroom) > 20,
		},
		{
			Category:    "Capacity",
			Metric:      "Memory Requested",
			ValueA:      a.Memory.Requested,
			ValueB:      b.Memory.Requested,
			Severity:    c.calculateResourceSeverity(a.Memory.Requested, b.Memory.Requested),
			Trend:       c.calculateTrend(a.Memory.Requested, b.Memory.Requested),
			Significant: c.isSignificantDifference(a.Memory.Requested, b.Memory.Requested, 0.2),
		},
		{
			Category:    "Capacity",
			Metric:      "Memory Limit",
			ValueA:      a.Memory.Limit,
			ValueB:      b.Memory.Limit,
			Severity:    c.calculateResourceSeverity(a.Memory.Limit, b.Memory.Limit),
			Trend:       c.calculateTrend(a.Memory.Limit, b.Memory.Limit),
			Significant: c.isSignificantDifference(a.Memory.Limit, b.Memory.Limit, 0.2),
		},
		{
			Category:    "Capacity",
			Metric:      "Memory Headroom",
			ValueA:      fmt.Sprintf("%.1f%%", a.Memory.Headroom),
			ValueB:      fmt.Sprintf("%.1f%%", b.Memory.Headroom),
			Severity:    c.calculateHeadroomSeverity(a.Memory.Headroom, b.Memory.Headroom),
			Trend:       c.calculateFloatTrend(a.Memory.Headroom, b.Memory.Headroom),
			Significant: math.Abs(a.Memory.Headroom-b.Memory.Headroom) > 20,
		},
	}
	
	return rows
}

func (c *Comparator) compareStability(a, b StabilityMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "Stability",
			Metric:      "Crash Loops (24h)",
			ValueA:      a.CrashLoops24h,
			ValueB:      b.CrashLoops24h,
			Severity:    c.calculateStabilitySeverity(a.CrashLoops24h, b.CrashLoops24h),
			Trend:       c.calculateIntTrend(a.CrashLoops24h, b.CrashLoops24h),
			Significant: a.CrashLoops24h != b.CrashLoops24h,
		},
		{
			Category:    "Stability",
			Metric:      "Restarts (24h)",
			ValueA:      a.Restarts24h,
			ValueB:      b.Restarts24h,
			Severity:    c.calculateStabilitySeverity(a.Restarts24h, b.Restarts24h),
			Trend:       c.calculateIntTrend(a.Restarts24h, b.Restarts24h),
			Significant: math.Abs(float64(a.Restarts24h-b.Restarts24h)) > 5,
		},
		{
			Category:    "Stability",
			Metric:      "Pending Pods (>5m)",
			ValueA:      a.PendingOver5m,
			ValueB:      b.PendingOver5m,
			Severity:    c.calculatePendingSeverity(a.PendingOver5m, b.PendingOver5m),
			Trend:       c.calculateIntTrend(a.PendingOver5m, b.PendingOver5m),
			Significant: a.PendingOver5m != b.PendingOver5m,
		},
	}
	
	return rows
}

func (c *Comparator) compareExposure(a, b ExposureMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "Exposure",
			Metric:      "Services",
			ValueA:      a.Services,
			ValueB:      b.Services,
			Severity:    "normal",
			Trend:       c.calculateIntTrend(a.Services, b.Services),
			Significant: math.Abs(float64(a.Services-b.Services)) > 3,
		},
		{
			Category:    "Exposure",
			Metric:      "Ingress Hosts",
			ValueA:      len(a.IngressHosts),
			ValueB:      len(b.IngressHosts),
			Severity:    c.calculateExposureSeverity(len(a.IngressHosts), len(b.IngressHosts)),
			Trend:       c.calculateIntTrend(len(a.IngressHosts), len(b.IngressHosts)),
			Significant: len(a.IngressHosts) != len(b.IngressHosts),
		},
		{
			Category:    "Exposure",
			Metric:      "Network Policy",
			ValueA:      c.boolToString(a.HasNetworkPolicy),
			ValueB:      c.boolToString(b.HasNetworkPolicy),
			Severity:    c.calculateNetPolSeverity(a.HasNetworkPolicy, b.HasNetworkPolicy),
			Trend:       "equal",
			Significant: a.HasNetworkPolicy != b.HasNetworkPolicy,
		},
	}
	
	return rows
}

func (c *Comparator) compareQuota(a, b QuotaMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "Quota",
			Metric:      "Resource Quota",
			ValueA:      c.boolToString(a.HasResourceQuota),
			ValueB:      c.boolToString(b.HasResourceQuota),
			Severity:    c.calculateQuotaSeverity(a.HasResourceQuota, b.HasResourceQuota),
			Trend:       "equal",
			Significant: a.HasResourceQuota != b.HasResourceQuota,
		},
		{
			Category:    "Quota",
			Metric:      "Limit Range",
			ValueA:      c.boolToString(a.HasLimitRange),
			ValueB:      c.boolToString(b.HasLimitRange),
			Severity:    c.calculateQuotaSeverity(a.HasLimitRange, b.HasLimitRange),
			Trend:       "equal",
			Significant: a.HasLimitRange != b.HasLimitRange,
		},
	}
	
	// Add top usage comparisons if both have quotas
	if a.HasResourceQuota && b.HasResourceQuota {
		if cpuA, okA := a.TopUsage["cpu"]; okA {
			if cpuB, okB := b.TopUsage["cpu"]; okB {
				rows = append(rows, CompareRow{
					Category:    "Quota",
					Metric:      "CPU Usage",
					ValueA:      cpuA,
					ValueB:      cpuB,
					Severity:    c.calculateUsageSeverity(cpuA, cpuB),
					Trend:       c.calculateTrend(cpuA, cpuB),
					Significant: c.isSignificantUsageDiff(cpuA, cpuB),
				})
			}
		}
		
		if memA, okA := a.TopUsage["memory"]; okA {
			if memB, okB := b.TopUsage["memory"]; okB {
				rows = append(rows, CompareRow{
					Category:    "Quota",
					Metric:      "Memory Usage",
					ValueA:      memA,
					ValueB:      memB,
					Severity:    c.calculateUsageSeverity(memA, memB),
					Trend:       c.calculateTrend(memA, memB),
					Significant: c.isSignificantUsageDiff(memA, memB),
				})
			}
		}
	}
	
	return rows
}

func (c *Comparator) compareStorage(a, b StorageMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "Storage",
			Metric:      "PVC Count",
			ValueA:      a.PVCCount,
			ValueB:      b.PVCCount,
			Severity:    "normal",
			Trend:       c.calculateIntTrend(a.PVCCount, b.PVCCount),
			Significant: math.Abs(float64(a.PVCCount-b.PVCCount)) > 5,
		},
		{
			Category:    "Storage",
			Metric:      "Requested Storage (Gi)",
			ValueA:      a.RequestedGi,
			ValueB:      b.RequestedGi,
			Severity:    c.calculateStorageSeverity(a.RequestedGi, b.RequestedGi),
			Trend:       c.calculateIntTrend(a.RequestedGi, b.RequestedGi),
			Significant: math.Abs(float64(a.RequestedGi-b.RequestedGi)) > 10,
		},
		{
			Category:    "Storage",
			Metric:      "Unbound PVCs",
			ValueA:      a.UnboundPVCs,
			ValueB:      b.UnboundPVCs,
			Severity:    c.calculateUnboundSeverity(a.UnboundPVCs, b.UnboundPVCs),
			Trend:       c.calculateIntTrend(a.UnboundPVCs, b.UnboundPVCs),
			Significant: a.UnboundPVCs != b.UnboundPVCs,
		},
	}
	
	return rows
}

func (c *Comparator) compareRBAC(a, b RBACMetrics) []CompareRow {
	rows := []CompareRow{
		{
			Category:    "RBAC",
			Metric:      "Admin Bindings",
			ValueA:      a.AdminBindings,
			ValueB:      b.AdminBindings,
			Severity:    c.calculateRBACSeverity(a.AdminBindings, b.AdminBindings),
			Trend:       c.calculateIntTrend(a.AdminBindings, b.AdminBindings),
			Significant: a.AdminBindings != b.AdminBindings,
		},
		{
			Category:    "RBAC",
			Metric:      "Wildcard Rules",
			ValueA:      a.WildcardRules,
			ValueB:      b.WildcardRules,
			Severity:    c.calculateWildcardSeverity(a.WildcardRules, b.WildcardRules),
			Trend:       c.calculateIntTrend(a.WildcardRules, b.WildcardRules),
			Significant: a.WildcardRules != b.WildcardRules,
		},
	}
	
	return rows
}

// Helper functions for severity calculations
func (c *Comparator) calculateResourceSeverity(a, b string) string {
	// Parse resource values and compare
	// Simplified for now
	if a == b {
		return "normal"
	}
	return "warning"
}

func (c *Comparator) calculateHeadroomSeverity(a, b float64) string {
	if a < 20 || b < 20 {
		return "critical"
	}
	if a < 40 || b < 40 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateStabilitySeverity(a, b int) string {
	if a > 5 || b > 5 {
		return "critical"
	}
	if a > 0 || b > 0 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculatePendingSeverity(a, b int) string {
	if a > 0 || b > 0 {
		return "critical"
	}
	return "normal"
}

func (c *Comparator) calculateExposureSeverity(a, b int) string {
	if a > 10 || b > 10 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateNetPolSeverity(a, b bool) string {
	if !a || !b {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateQuotaSeverity(a, b bool) string {
	if !a || !b {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateUsageSeverity(a, b string) string {
	// Parse percentage values
	aVal := c.parsePercentage(a)
	bVal := c.parsePercentage(b)
	
	if aVal > 90 || bVal > 90 {
		return "critical"
	}
	if aVal > 70 || bVal > 70 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateStorageSeverity(a, b int) string {
	if a > 100 || b > 100 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateUnboundSeverity(a, b int) string {
	if a > 0 || b > 0 {
		return "critical"
	}
	return "normal"
}

func (c *Comparator) calculateRBACSeverity(a, b int) string {
	if a > 5 || b > 5 {
		return "warning"
	}
	return "normal"
}

func (c *Comparator) calculateWildcardSeverity(a, b int) string {
	if a > 0 || b > 0 {
		return "critical"
	}
	return "normal"
}

// Helper functions for trend calculations
func (c *Comparator) calculateTrend(a, b string) string {
	// Simplified comparison
	if a == b {
		return "equal"
	}
	// Would need to parse values properly
	return "up"
}

func (c *Comparator) calculateIntTrend(a, b int) string {
	if a == b {
		return "equal"
	}
	if a < b {
		return "up"
	}
	return "down"
}

func (c *Comparator) calculateFloatTrend(a, b float64) string {
	if math.Abs(a-b) < 0.01 {
		return "equal"
	}
	if a < b {
		return "up"
	}
	return "down"
}

// Helper functions
func (c *Comparator) boolToString(b bool) string {
	if b {
		return "Yes"
	}
	return "No"
}

func (c *Comparator) isSignificantDifference(a, b string, threshold float64) bool {
	// Would need to parse resource values properly
	return a != b
}

func (c *Comparator) isSignificantUsageDiff(a, b string) bool {
	aVal := c.parsePercentage(a)
	bVal := c.parsePercentage(b)
	return math.Abs(aVal-bVal) > 20
}

func (c *Comparator) parsePercentage(s string) float64 {
	// Remove % and parse
	s = strings.TrimSuffix(s, "%")
	val, _ := strconv.ParseFloat(s, 64)
	return val
}