package namespaces

import (
	"context"
	"fmt"
	"strings"
	"time"
	
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Collector collects namespace metrics from Kubernetes
type Collector struct {
	clientset kubernetes.Interface
}

// NewCollector creates a new namespace metrics collector
func NewCollector(clientset kubernetes.Interface) *Collector {
	return &Collector{
		clientset: clientset,
	}
}

// CollectNamespaceSnapshot collects all metrics for a namespace
func (c *Collector) CollectNamespaceSnapshot(ctx context.Context, cluster, namespace string) (*NamespaceSnapshot, error) {
	snapshot := &NamespaceSnapshot{
		Namespace: namespace,
		Cluster:   cluster,
		Timestamp: time.Now(),
	}
	
	// Collect all metrics in parallel
	errChan := make(chan error, 6)
	
	// Collect capacity metrics
	go func() {
		capacity, err := c.collectCapacityMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("capacity metrics: %w", err)
			return
		}
		snapshot.Capacity = capacity
		errChan <- nil
	}()
	
	// Collect stability metrics
	go func() {
		stability, err := c.collectStabilityMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("stability metrics: %w", err)
			return
		}
		snapshot.Stability = stability
		errChan <- nil
	}()
	
	// Collect exposure metrics
	go func() {
		exposure, err := c.collectExposureMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("exposure metrics: %w", err)
			return
		}
		snapshot.Exposure = exposure
		errChan <- nil
	}()
	
	// Collect quota metrics
	go func() {
		quota, err := c.collectQuotaMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("quota metrics: %w", err)
			return
		}
		snapshot.Quota = quota
		errChan <- nil
	}()
	
	// Collect storage metrics
	go func() {
		storage, err := c.collectStorageMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("storage metrics: %w", err)
			return
		}
		snapshot.Storage = storage
		errChan <- nil
	}()
	
	// Collect RBAC metrics
	go func() {
		rbac, err := c.collectRBACMetrics(ctx, namespace)
		if err != nil {
			errChan <- fmt.Errorf("rbac metrics: %w", err)
			return
		}
		snapshot.RBAC = rbac
		errChan <- nil
	}()
	
	// Wait for all collectors and check for errors
	var errors []string
	for i := 0; i < 6; i++ {
		if err := <-errChan; err != nil {
			errors = append(errors, err.Error())
		}
	}
	
	if len(errors) > 0 {
		return snapshot, fmt.Errorf("partial collection errors: %s", strings.Join(errors, "; "))
	}
	
	return snapshot, nil
}

func (c *Collector) collectCapacityMetrics(ctx context.Context, namespace string) (CapacityMetrics, error) {
	metrics := CapacityMetrics{}
	
	// Get pods to calculate resource usage
	pods, err := c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	var cpuRequested, cpuLimit, memoryRequested, memoryLimit resource.Quantity
	
	for _, pod := range pods.Items {
		for _, container := range pod.Spec.Containers {
			if req := container.Resources.Requests; req != nil {
				if cpu, ok := req[corev1.ResourceCPU]; ok {
					cpuRequested.Add(cpu)
				}
				if mem, ok := req[corev1.ResourceMemory]; ok {
					memoryRequested.Add(mem)
				}
			}
			
			if lim := container.Resources.Limits; lim != nil {
				if cpu, ok := lim[corev1.ResourceCPU]; ok {
					cpuLimit.Add(cpu)
				}
				if mem, ok := lim[corev1.ResourceMemory]; ok {
					memoryLimit.Add(mem)
				}
			}
		}
	}
	
	// Get resource quotas to determine available resources
	quotas, err := c.clientset.CoreV1().ResourceQuotas(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	var cpuAvailable, memoryAvailable resource.Quantity
	if len(quotas.Items) > 0 {
		quota := quotas.Items[0] // Use first quota if multiple exist
		if hard := quota.Status.Hard; hard != nil {
			if cpu, ok := hard[corev1.ResourceLimitsCPU]; ok {
				cpuAvailable = cpu
			}
			if mem, ok := hard[corev1.ResourceLimitsMemory]; ok {
				memoryAvailable = mem
			}
		}
	}
	
	// Calculate headroom
	cpuHeadroom := 0.0
	if !cpuAvailable.IsZero() && !cpuRequested.IsZero() {
		cpuHeadroom = float64(cpuAvailable.MilliValue()-cpuRequested.MilliValue()) / float64(cpuAvailable.MilliValue()) * 100
	}
	
	memHeadroom := 0.0
	if !memoryAvailable.IsZero() && !memoryRequested.IsZero() {
		memHeadroom = float64(memoryAvailable.Value()-memoryRequested.Value()) / float64(memoryAvailable.Value()) * 100
	}
	
	metrics.CPU = ResourceMetric{
		Requested: cpuRequested.String(),
		Limit:     cpuLimit.String(),
		Available: cpuAvailable.String(),
		Headroom:  cpuHeadroom,
	}
	
	metrics.Memory = ResourceMetric{
		Requested: memoryRequested.String(),
		Limit:     memoryLimit.String(),
		Available: memoryAvailable.String(),
		Headroom:  memHeadroom,
	}
	
	return metrics, nil
}

func (c *Collector) collectStabilityMetrics(ctx context.Context, namespace string) (StabilityMetrics, error) {
	metrics := StabilityMetrics{}
	
	// Get pods
	pods, err := c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	// Get events for crash loop detection
	events, err := c.clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	now := time.Now()
	last24h := now.Add(-24 * time.Hour)
	
	// Count crash loops and restarts
	crashLoopEvents := make(map[string]bool)
	for _, event := range events.Items {
		if event.LastTimestamp.After(last24h) {
			if strings.Contains(event.Reason, "BackOff") || strings.Contains(event.Message, "crash") {
				crashLoopEvents[event.InvolvedObject.Name] = true
			}
		}
	}
	metrics.CrashLoops24h = len(crashLoopEvents)
	
	// Count restarts and pending pods
	for _, pod := range pods.Items {
		// Count restarts in last 24h
		for _, containerStatus := range pod.Status.ContainerStatuses {
			metrics.Restarts24h += int(containerStatus.RestartCount)
		}
		
		// Check for pending pods over 5 minutes
		if pod.Status.Phase == corev1.PodPending {
			if pod.CreationTimestamp.Add(5 * time.Minute).Before(now) {
				metrics.PendingOver5m++
			}
		}
	}
	
	return metrics, nil
}

func (c *Collector) collectExposureMetrics(ctx context.Context, namespace string) (ExposureMetrics, error) {
	metrics := ExposureMetrics{}
	
	// Count services
	services, err := c.clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	metrics.Services = len(services.Items)
	
	// Get ingress hosts
	ingresses, err := c.clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	hostMap := make(map[string]bool)
	for _, ingress := range ingresses.Items {
		for _, rule := range ingress.Spec.Rules {
			if rule.Host != "" {
				hostMap[rule.Host] = true
			}
		}
	}
	
	for host := range hostMap {
		metrics.IngressHosts = append(metrics.IngressHosts, host)
	}
	
	// Check for network policies
	netPolicies, err := c.clientset.NetworkingV1().NetworkPolicies(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	metrics.HasNetworkPolicy = len(netPolicies.Items) > 0
	
	return metrics, nil
}

func (c *Collector) collectQuotaMetrics(ctx context.Context, namespace string) (QuotaMetrics, error) {
	metrics := QuotaMetrics{
		TopUsage: make(map[string]string),
	}
	
	// Check for resource quotas
	quotas, err := c.clientset.CoreV1().ResourceQuotas(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	metrics.HasResourceQuota = len(quotas.Items) > 0
	
	// Get top usage from quotas
	if len(quotas.Items) > 0 {
		quota := quotas.Items[0]
		
		// Calculate usage percentages for key resources
		if hard := quota.Status.Hard; hard != nil {
			if used := quota.Status.Used; used != nil {
				// CPU usage
				if hardCPU, ok := hard[corev1.ResourceLimitsCPU]; ok {
					if usedCPU, ok := used[corev1.ResourceLimitsCPU]; ok {
						percentage := float64(usedCPU.MilliValue()) / float64(hardCPU.MilliValue()) * 100
						metrics.TopUsage["cpu"] = fmt.Sprintf("%.1f%%", percentage)
					}
				}
				
				// Memory usage
				if hardMem, ok := hard[corev1.ResourceLimitsMemory]; ok {
					if usedMem, ok := used[corev1.ResourceLimitsMemory]; ok {
						percentage := float64(usedMem.Value()) / float64(hardMem.Value()) * 100
						metrics.TopUsage["memory"] = fmt.Sprintf("%.1f%%", percentage)
					}
				}
				
				// Pod count
				if hardPods, ok := hard[corev1.ResourcePods]; ok {
					if usedPods, ok := used[corev1.ResourcePods]; ok {
						percentage := float64(usedPods.Value()) / float64(hardPods.Value()) * 100
						metrics.TopUsage["pods"] = fmt.Sprintf("%.1f%%", percentage)
					}
				}
			}
		}
	}
	
	// Check for limit ranges
	limitRanges, err := c.clientset.CoreV1().LimitRanges(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	metrics.HasLimitRange = len(limitRanges.Items) > 0
	
	return metrics, nil
}

func (c *Collector) collectStorageMetrics(ctx context.Context, namespace string) (StorageMetrics, error) {
	metrics := StorageMetrics{}
	
	// Get PVCs
	pvcs, err := c.clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	metrics.PVCCount = len(pvcs.Items)
	
	var totalRequestedGi int64
	for _, pvc := range pvcs.Items {
		// Calculate requested storage
		if req := pvc.Spec.Resources.Requests; req != nil {
			if storage, ok := req[corev1.ResourceStorage]; ok {
				// Convert to Gi
				totalRequestedGi += storage.Value() / (1024 * 1024 * 1024)
			}
		}
		
		// Check for unbound PVCs
		if pvc.Status.Phase != corev1.ClaimBound {
			metrics.UnboundPVCs++
		}
	}
	
	metrics.RequestedGi = int(totalRequestedGi)
	
	// Check for orphaned PVCs (simplified check - PVCs without pods using them)
	// This would require checking all pods' volumes, simplified for now
	
	return metrics, nil
}

func (c *Collector) collectRBACMetrics(ctx context.Context, namespace string) (RBACMetrics, error) {
	metrics := RBACMetrics{}
	
	// Get role bindings
	roleBindings, err := c.clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	// Count admin bindings
	for _, rb := range roleBindings.Items {
		if strings.Contains(rb.RoleRef.Name, "admin") || strings.Contains(rb.RoleRef.Name, "edit") {
			metrics.AdminBindings++
		}
	}
	
	// Get roles to check for wildcard rules
	roles, err := c.clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics, err
	}
	
	for _, role := range roles.Items {
		for _, rule := range role.Rules {
			// Check for wildcard verbs or resources
			for _, verb := range rule.Verbs {
				if verb == "*" {
					metrics.WildcardRules++
					break
				}
			}
			for _, resource := range rule.Resources {
				if resource == "*" {
					metrics.WildcardRules++
					break
				}
			}
		}
	}
	
	return metrics, nil
}