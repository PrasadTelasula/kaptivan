package manifests

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8sclient "k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets up the manifest handlers with the cluster manager
func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

// formatAge returns a human-readable age string
func formatAge(creationTimestamp string) string {
	if creationTimestamp == "" {
		return ""
	}

	created, err := time.Parse(time.RFC3339, creationTimestamp)
	if err != nil {
		return ""
	}

	now := time.Now()
	duration := now.Sub(created)

	if duration < time.Minute {
		return "< 1m"
	} else if duration < time.Hour {
		return fmt.Sprintf("%.0fm", duration.Minutes())
	} else if duration < 24*time.Hour {
		return fmt.Sprintf("%.0fh", duration.Hours())
	} else {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
}

// enhanceReplicaSetItem adds ReplicaSet-specific information to a ResourceItem
func enhanceReplicaSetItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ReplicaSet details
	rs, err := clientset.AppsV1().ReplicaSets(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set replica counts
	desiredReplicas := int32(0)
	if rs.Spec.Replicas != nil {
		desiredReplicas = *rs.Spec.Replicas
	}
	item.DesiredReplicas = &desiredReplicas
	item.ReadyReplicas = &rs.Status.ReadyReplicas

	// Determine if this is the current ReplicaSet (has desired replicas > 0)
	isCurrent := desiredReplicas > 0
	item.IsCurrent = &isCurrent

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	// Get owner reference (Deployment)
	if len(rs.OwnerReferences) > 0 {
		owner := rs.OwnerReferences[0]
		item.OwnerReference = &OwnerReference{
			Kind:       owner.Kind,
			Name:       owner.Name,
			APIVersion: owner.APIVersion,
		}
	}

	return nil
}

// enhanceDeploymentItem adds Deployment-specific information to a ResourceItem
func enhanceDeploymentItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Deployment details
	deployment, err := clientset.AppsV1().Deployments(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set replica counts
	desiredReplicas := int32(0)
	if deployment.Spec.Replicas != nil {
		desiredReplicas = *deployment.Spec.Replicas
	}
	item.DesiredReplicas = &desiredReplicas
	item.ReadyReplicas = &deployment.Status.ReadyReplicas
	item.AvailableReplicas = &deployment.Status.AvailableReplicas
	item.UpdatedReplicas = &deployment.Status.UpdatedReplicas
	item.UnavailableReplicas = &deployment.Status.UnavailableReplicas

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhancePodItem adds Pod-specific information to a ResourceItem
func enhancePodItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Pod details
	pod, err := clientset.CoreV1().Pods(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set pod status
	item.PodStatus = string(pod.Status.Phase)

	// Count ready containers
	readyContainers := int32(0)
	totalContainers := int32(len(pod.Spec.Containers))

	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.Ready {
			readyContainers++
		}
	}

	item.ContainerReady = &readyContainers
	item.ContainerTotal = &totalContainers

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceDaemonSetItem adds DaemonSet-specific information to a ResourceItem
func enhanceDaemonSetItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the DaemonSet details
	daemonSet, err := clientset.AppsV1().DaemonSets(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set DaemonSet replica counts
	item.DaemonSetDesiredReplicas = &daemonSet.Status.DesiredNumberScheduled
	item.DaemonSetReadyReplicas = &daemonSet.Status.NumberReady
	item.DaemonSetAvailableReplicas = &daemonSet.Status.NumberAvailable
	item.DaemonSetUpdatedReplicas = &daemonSet.Status.UpdatedNumberScheduled
	item.DaemonSetUnavailableReplicas = &daemonSet.Status.NumberUnavailable

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceStatefulSetItem adds StatefulSet-specific information to a ResourceItem
func enhanceStatefulSetItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the StatefulSet details
	statefulSet, err := clientset.AppsV1().StatefulSets(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set StatefulSet replica counts
	item.StatefulSetDesiredReplicas = statefulSet.Spec.Replicas
	item.StatefulSetReadyReplicas = &statefulSet.Status.ReadyReplicas
	item.StatefulSetAvailableReplicas = &statefulSet.Status.AvailableReplicas
	item.StatefulSetUpdatedReplicas = &statefulSet.Status.UpdatedReplicas
	// Note: StatefulSet doesn't have UnavailableReplicas field
	unavailableReplicas := *statefulSet.Spec.Replicas - statefulSet.Status.ReadyReplicas
	item.StatefulSetUnavailableReplicas = &unavailableReplicas

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceJobItem adds Job-specific information to a ResourceItem
func enhanceJobItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Job details
	job, err := clientset.BatchV1().Jobs(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Determine job status
	var jobStatus string
	if job.Status.Succeeded > 0 {
		jobStatus = "Complete"
	} else if job.Status.Failed > 0 {
		jobStatus = "Failed"
	} else if job.Status.Active > 0 {
		jobStatus = "Running"
	} else {
		jobStatus = "Pending"
	}

	item.JobStatus = jobStatus
	item.JobSucceededCount = &job.Status.Succeeded
	item.JobFailedCount = &job.Status.Failed

	// Set times
	if job.Status.CompletionTime != nil {
		item.JobCompletionTime = job.Status.CompletionTime.Format(time.RFC3339)
	}
	if job.Status.StartTime != nil {
		item.JobStartTime = job.Status.StartTime.Format(time.RFC3339)
	}

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceCronJobItem adds CronJob-specific information to a ResourceItem
func enhanceCronJobItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the CronJob details
	cronJob, err := clientset.BatchV1().CronJobs(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set schedule times
	if cronJob.Status.LastScheduleTime != nil {
		item.CronJobLastScheduleTime = cronJob.Status.LastScheduleTime.Format(time.RFC3339)
	}
	// Note: NextScheduleTime is not available in the status, it's calculated
	if cronJob.Status.LastSuccessfulTime != nil {
		item.CronJobLastSuccessfulTime = cronJob.Status.LastSuccessfulTime.Format(time.RFC3339)
	}

	// Set active jobs count (convert slice length to int32)
	activeJobsCount := int32(len(cronJob.Status.Active))
	item.CronJobActiveJobs = &activeJobsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceServiceItem adds Service-specific information to a ResourceItem
func enhanceServiceItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Service details
	service, err := clientset.CoreV1().Services(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set service information
	item.ServiceType = string(service.Spec.Type)
	item.ServiceClusterIP = service.Spec.ClusterIP

	// Get external IP
	if len(service.Status.LoadBalancer.Ingress) > 0 {
		item.ServiceExternalIP = service.Status.LoadBalancer.Ingress[0].IP
	}

	// Count ports
	portsCount := int32(len(service.Spec.Ports))
	item.ServicePorts = &portsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceConfigMapItem adds ConfigMap-specific information to a ResourceItem
func enhanceConfigMapItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ConfigMap details
	configMap, err := clientset.CoreV1().ConfigMaps(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count data keys
	dataCount := int32(len(configMap.Data))
	item.ConfigMapDataCount = &dataCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceSecretItem adds Secret-specific information to a ResourceItem
func enhanceSecretItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Secret details
	secret, err := clientset.CoreV1().Secrets(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set secret information
	item.SecretType = string(secret.Type)

	// Count data keys
	dataCount := int32(len(secret.Data))
	item.SecretDataCount = &dataCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhancePVItem adds PersistentVolume-specific information to a ResourceItem
func enhancePVItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the PersistentVolume details
	pv, err := clientset.CoreV1().PersistentVolumes().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set PV information
	item.PVStatus = string(pv.Status.Phase)
	item.PVCapacity = pv.Spec.Capacity.Storage().String()

	// Format access modes
	var accessModes []string
	for _, mode := range pv.Spec.AccessModes {
		accessModes = append(accessModes, string(mode))
	}
	item.PVAccessModes = strings.Join(accessModes, ",")

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhancePVCItem adds PersistentVolumeClaim-specific information to a ResourceItem
func enhancePVCItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the PersistentVolumeClaim details
	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set PVC information
	item.PVCStatus = string(pvc.Status.Phase)

	// Get capacity
	if pvc.Status.Capacity != nil {
		if storage, exists := pvc.Status.Capacity["storage"]; exists {
			item.PVCCapacity = storage.String()
		}
	}

	// Format access modes
	var accessModes []string
	for _, mode := range pvc.Spec.AccessModes {
		accessModes = append(accessModes, string(mode))
	}
	item.PVCAccessModes = strings.Join(accessModes, ",")

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceIngressItem adds Ingress-specific information to a ResourceItem
func enhanceIngressItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Ingress details
	ingress, err := clientset.NetworkingV1().Ingresses(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set ingress information
	item.IngressStatus = "Valid" // Assume valid if we can get it
	if len(ingress.Status.LoadBalancer.Ingress) == 0 {
		item.IngressStatus = "Pending"
	}

	// Count rules
	rulesCount := int32(len(ingress.Spec.Rules))
	item.IngressRulesCount = &rulesCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceNamespaceItem adds Namespace-specific information to a ResourceItem
func enhanceNamespaceItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Namespace details
	ns, err := clientset.CoreV1().Namespaces().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set namespace information
	item.NamespaceStatus = string(ns.Status.Phase)

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceServiceAccountItem adds ServiceAccount-specific information to a ResourceItem
func enhanceServiceAccountItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ServiceAccount details
	sa, err := clientset.CoreV1().ServiceAccounts(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count secrets
	secretsCount := int32(len(sa.Secrets))
	item.ServiceAccountSecretsCount = &secretsCount

	// Count image pull secrets
	imagePullSecretsCount := int32(len(sa.ImagePullSecrets))
	item.ServiceAccountImagePullSecretsCount = &imagePullSecretsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceRoleItem adds Role-specific information to a ResourceItem
func enhanceRoleItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Role details
	role, err := clientset.RbacV1().Roles(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count rules
	rulesCount := int32(len(role.Rules))
	item.RoleRulesCount = &rulesCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceRoleBindingItem adds RoleBinding-specific information to a ResourceItem
func enhanceRoleBindingItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the RoleBinding details
	rb, err := clientset.RbacV1().RoleBindings(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count subjects
	subjectsCount := int32(len(rb.Subjects))
	item.RoleBindingSubjectsCount = &subjectsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceClusterRoleItem adds ClusterRole-specific information to a ResourceItem
func enhanceClusterRoleItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ClusterRole details
	cr, err := clientset.RbacV1().ClusterRoles().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count rules
	rulesCount := int32(len(cr.Rules))
	item.ClusterRoleRulesCount = &rulesCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceClusterRoleBindingItem adds ClusterRoleBinding-specific information to a ResourceItem
func enhanceClusterRoleBindingItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ClusterRoleBinding details
	crb, err := clientset.RbacV1().ClusterRoleBindings().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count subjects
	subjectsCount := int32(len(crb.Subjects))
	item.ClusterRoleBindingSubjectsCount = &subjectsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceNetworkPolicyItem adds NetworkPolicy-specific information to a ResourceItem
func enhanceNetworkPolicyItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the NetworkPolicy details
	np, err := clientset.NetworkingV1().NetworkPolicies(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Count rules (ingress + egress)
	rulesCount := int32(len(np.Spec.Ingress) + len(np.Spec.Egress))
	item.NetworkPolicyRulesCount = &rulesCount

	// Count pod selectors (simplified - just count the main pod selector)
	podSelectorCount := int32(1) // NetworkPolicy has one main pod selector
	item.NetworkPolicyPodSelectorCount = &podSelectorCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceStorageClassItem adds StorageClass-specific information to a ResourceItem
func enhanceStorageClassItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the StorageClass details
	sc, err := clientset.StorageV1().StorageClasses().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set storage class information
	item.StorageClassProvisioner = sc.Provisioner
	item.StorageClassReclaimPolicy = string(*sc.ReclaimPolicy)
	item.StorageClassVolumeBindingMode = string(*sc.VolumeBindingMode)

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceEventItem adds Event-specific information to a ResourceItem
func enhanceEventItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the Event details
	event, err := clientset.CoreV1().Events(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set event information
	item.EventReason = event.Reason
	item.EventType = event.Type
	item.EventCount = &event.Count

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceCRDItem adds CustomResourceDefinition-specific information to a ResourceItem
func enhanceCRDItem(item *ResourceItem, clientset k8sclient.Interface, namespace string, contextStr string) error {
	// For now, just set basic information since we don't have dynamic client access
	// This could be enhanced later with proper dynamic client support

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// getNodePodCounts fetches all pods and returns a mapping of node name to pod count
func getNodePodCounts(clientset k8sclient.Interface) (map[string]int32, error) {
	pods, err := clientset.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodePodCounts := make(map[string]int32)
	for _, pod := range pods.Items {
		if pod.Spec.NodeName != "" {
			nodePodCounts[pod.Spec.NodeName]++
		}
	}

	return nodePodCounts, nil
}

// enhanceNodeItem adds Node-specific information to a ResourceItem
func enhanceNodeItem(item *ResourceItem, clientset k8sclient.Interface, namespace string, nodePodCounts map[string]int32) error {
	// Get the Node details
	node, err := clientset.CoreV1().Nodes().Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set node status
	for _, condition := range node.Status.Conditions {
		if condition.Type == "Ready" {
			if condition.Status == "True" {
				item.NodeStatus = "Ready"
			} else {
				item.NodeStatus = "NotReady"
			}
			break
		}
	}

	// Set node role
	if node.Labels["node-role.kubernetes.io/master"] == "" && node.Labels["node-role.kubernetes.io/control-plane"] == "" {
		item.NodeRole = "worker"
	} else {
		item.NodeRole = "master"
	}

	// Set kubernetes version
	item.NodeKubernetesVersion = node.Status.NodeInfo.KubeletVersion

	// Set OS information
	item.NodeOS = node.Status.NodeInfo.OperatingSystem + "/" + node.Status.NodeInfo.Architecture

	// Set capacity summary
	cpu := node.Status.Capacity["cpu"]
	memory := node.Status.Capacity["memory"]
	item.NodeCapacity = fmt.Sprintf("CPU: %s, Memory: %s", cpu.String(), memory.String())

	// Set pod count from pre-computed mapping
	if podCount, exists := nodePodCounts[item.Name]; exists {
		item.NodePodCount = &podCount
	}

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceResourceQuotaItem adds ResourceQuota-specific information to a ResourceItem
func enhanceResourceQuotaItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the ResourceQuota details
	rq, err := clientset.CoreV1().ResourceQuotas(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set quota status
	item.ResourceQuotaStatus = "Active" // ResourceQuotas are typically always active

	// Create used resources summary
	var usedResources []string
	for resource, quantity := range rq.Status.Used {
		usedResources = append(usedResources, fmt.Sprintf("%s: %s", resource, quantity.String()))
	}
	item.ResourceQuotaUsed = strings.Join(usedResources, ", ")

	// Create hard limits summary
	var hardResources []string
	for resource, quantity := range rq.Spec.Hard {
		hardResources = append(hardResources, fmt.Sprintf("%s: %s", resource, quantity.String()))
	}
	item.ResourceQuotaHard = strings.Join(hardResources, ", ")

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// enhanceLimitRangeItem adds LimitRange-specific information to a ResourceItem
func enhanceLimitRangeItem(item *ResourceItem, clientset k8sclient.Interface, namespace string) error {
	// Get the LimitRange details
	lr, err := clientset.CoreV1().LimitRanges(namespace).Get(context.TODO(), item.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// Set limit range status
	item.LimitRangeStatus = "Active" // LimitRanges are typically always active

	// Count limits defined
	limitsCount := int32(len(lr.Spec.Limits))
	item.LimitRangeLimitsCount = &limitsCount

	// Set age
	item.Age = formatAge(item.CreationTimestamp)

	return nil
}

// ResourceListRequest represents a request to list resources
type ResourceListRequest struct {
	Context    string `json:"context" binding:"required"`
	Namespace  string `json:"namespace"`
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Group      string `json:"group"`
	Version    string `json:"version"`
	Resource   string `json:"resource"`
	Enhance    bool   `json:"enhance"` // Control whether to apply enhancements (default: false for performance)
}

// ResourceItem represents a basic resource item
type ResourceItem struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace,omitempty"`
	Kind              string            `json:"kind"`
	APIVersion        string            `json:"apiVersion"`
	UID               string            `json:"uid"`
	CreationTimestamp string            `json:"creationTimestamp"`
	Labels            map[string]string `json:"labels,omitempty"`
	// ReplicaSet specific fields
	IsCurrent       *bool           `json:"isCurrent,omitempty"`       // true for current ReplicaSet, false for old
	DesiredReplicas *int32          `json:"desiredReplicas,omitempty"` // desired replica count
	ReadyReplicas   *int32          `json:"readyReplicas,omitempty"`   // ready replica count
	Age             string          `json:"age,omitempty"`             // human-readable age
	OwnerReference  *OwnerReference `json:"ownerReference,omitempty"`  // owner deployment info

	// Deployment specific fields
	AvailableReplicas   *int32 `json:"availableReplicas,omitempty"`   // available replica count
	UpdatedReplicas     *int32 `json:"updatedReplicas,omitempty"`     // updated replica count
	UnavailableReplicas *int32 `json:"unavailableReplicas,omitempty"` // unavailable replica count

	// Pod specific fields
	PodStatus      string `json:"podStatus,omitempty"`      // pod phase (Running, Pending, Failed, etc.)
	ContainerReady *int32 `json:"containerReady,omitempty"` // number of ready containers
	ContainerTotal *int32 `json:"containerTotal,omitempty"` // total number of containers

	// DaemonSet specific fields
	DaemonSetDesiredReplicas     *int32 `json:"daemonSetDesiredReplicas,omitempty"`     // desired replicas
	DaemonSetReadyReplicas       *int32 `json:"daemonSetReadyReplicas,omitempty"`       // ready replicas
	DaemonSetAvailableReplicas   *int32 `json:"daemonSetAvailableReplicas,omitempty"`   // available replicas
	DaemonSetUpdatedReplicas     *int32 `json:"daemonSetUpdatedReplicas,omitempty"`     // updated replicas
	DaemonSetUnavailableReplicas *int32 `json:"daemonSetUnavailableReplicas,omitempty"` // unavailable replicas

	// StatefulSet specific fields
	StatefulSetDesiredReplicas     *int32 `json:"statefulSetDesiredReplicas,omitempty"`     // desired replicas
	StatefulSetReadyReplicas       *int32 `json:"statefulSetReadyReplicas,omitempty"`       // ready replicas
	StatefulSetAvailableReplicas   *int32 `json:"statefulSetAvailableReplicas,omitempty"`   // available replicas
	StatefulSetUpdatedReplicas     *int32 `json:"statefulSetUpdatedReplicas,omitempty"`     // updated replicas
	StatefulSetUnavailableReplicas *int32 `json:"statefulSetUnavailableReplicas,omitempty"` // unavailable replicas

	// Job specific fields
	JobStatus         string `json:"jobStatus,omitempty"`         // job status (Complete, Failed, Running, etc.)
	JobCompletionTime string `json:"jobCompletionTime,omitempty"` // when job completed
	JobStartTime      string `json:"jobStartTime,omitempty"`      // when job started
	JobSucceededCount *int32 `json:"jobSucceededCount,omitempty"` // number of successful completions
	JobFailedCount    *int32 `json:"jobFailedCount,omitempty"`    // number of failed completions

	// CronJob specific fields
	CronJobLastScheduleTime   string `json:"cronJobLastScheduleTime,omitempty"`   // last time it was scheduled
	CronJobNextScheduleTime   string `json:"cronJobNextScheduleTime,omitempty"`   // next scheduled time
	CronJobActiveJobs         *int32 `json:"cronJobActiveJobs,omitempty"`         // number of active jobs
	CronJobLastSuccessfulTime string `json:"cronJobLastSuccessfulTime,omitempty"` // last successful run

	// Service specific fields
	ServiceType       string `json:"serviceType,omitempty"`       // service type (ClusterIP, NodePort, LoadBalancer, ExternalName)
	ServiceClusterIP  string `json:"serviceClusterIP,omitempty"`  // cluster IP
	ServiceExternalIP string `json:"serviceExternalIP,omitempty"` // external IP
	ServicePorts      *int32 `json:"servicePorts,omitempty"`      // number of ports

	// ConfigMap specific fields
	ConfigMapDataCount *int32 `json:"configMapDataCount,omitempty"` // number of data keys

	// Secret specific fields
	SecretType      string `json:"secretType,omitempty"`      // secret type (Opaque, kubernetes.io/tls, etc.)
	SecretDataCount *int32 `json:"secretDataCount,omitempty"` // number of data keys

	// PersistentVolume specific fields
	PVStatus      string `json:"pvStatus,omitempty"`      // PV status (Available, Bound, Released, Failed)
	PVCapacity    string `json:"pvCapacity,omitempty"`    // PV capacity
	PVAccessModes string `json:"pvAccessModes,omitempty"` // PV access modes

	// PersistentVolumeClaim specific fields
	PVCStatus      string `json:"pvcStatus,omitempty"`      // PVC status (Pending, Bound, Lost)
	PVCCapacity    string `json:"pvcCapacity,omitempty"`    // PVC capacity
	PVCAccessModes string `json:"pvcAccessModes,omitempty"` // PVC access modes

	// Ingress specific fields
	IngressStatus     string `json:"ingressStatus,omitempty"`     // ingress status (valid/invalid)
	IngressRulesCount *int32 `json:"ingressRulesCount,omitempty"` // number of rules

	// Namespace specific fields
	NamespaceStatus string `json:"namespaceStatus,omitempty"` // namespace status (Active/Terminating)

	// ServiceAccount specific fields
	ServiceAccountSecretsCount          *int32 `json:"serviceAccountSecretsCount,omitempty"`          // number of secrets
	ServiceAccountImagePullSecretsCount *int32 `json:"serviceAccountImagePullSecretsCount,omitempty"` // number of image pull secrets

	// Role specific fields
	RoleRulesCount *int32 `json:"roleRulesCount,omitempty"` // number of rules

	// RoleBinding specific fields
	RoleBindingSubjectsCount *int32 `json:"roleBindingSubjectsCount,omitempty"` // number of subjects

	// ClusterRole specific fields
	ClusterRoleRulesCount *int32 `json:"clusterRoleRulesCount,omitempty"` // number of rules

	// ClusterRoleBinding specific fields
	ClusterRoleBindingSubjectsCount *int32 `json:"clusterRoleBindingSubjectsCount,omitempty"` // number of subjects

	// NetworkPolicy specific fields
	NetworkPolicyRulesCount       *int32 `json:"networkPolicyRulesCount,omitempty"`       // number of ingress/egress rules
	NetworkPolicyPodSelectorCount *int32 `json:"networkPolicyPodSelectorCount,omitempty"` // number of pod selectors

	// StorageClass specific fields
	StorageClassProvisioner       string `json:"storageClassProvisioner,omitempty"`       // provisioner name
	StorageClassReclaimPolicy     string `json:"storageClassReclaimPolicy,omitempty"`     // reclaim policy
	StorageClassVolumeBindingMode string `json:"storageClassVolumeBindingMode,omitempty"` // volume binding mode

	// Event specific fields
	EventReason string `json:"eventReason,omitempty"` // event reason
	EventType   string `json:"eventType,omitempty"`   // event type (Normal, Warning)
	EventCount  *int32 `json:"eventCount,omitempty"`  // number of occurrences

	// CustomResourceDefinition specific fields
	CRDVersionCount *int32 `json:"crdVersionCount,omitempty"` // number of versions
	CRDScope        string `json:"crdScope,omitempty"`        // scope (Namespaced/Cluster)

	// Node specific fields
	NodeStatus            string `json:"nodeStatus,omitempty"`            // node status (Ready, NotReady)
	NodeRole              string `json:"nodeRole,omitempty"`              // node role (master, worker)
	NodeKubernetesVersion string `json:"nodeKubernetesVersion,omitempty"` // kubernetes version
	NodeOS                string `json:"nodeOS,omitempty"`                // operating system
	NodeCapacity          string `json:"nodeCapacity,omitempty"`          // resource capacity summary
	NodePodCount          *int32 `json:"nodePodCount,omitempty"`          // number of pods running on this node

	// ResourceQuota specific fields
	ResourceQuotaStatus string `json:"resourceQuotaStatus,omitempty"` // quota status (Active, etc.)
	ResourceQuotaUsed   string `json:"resourceQuotaUsed,omitempty"`   // used resources summary
	ResourceQuotaHard   string `json:"resourceQuotaHard,omitempty"`   // hard limits summary

	// LimitRange specific fields
	LimitRangeStatus      string `json:"limitRangeStatus,omitempty"`      // limit range status
	LimitRangeLimitsCount *int32 `json:"limitRangeLimitsCount,omitempty"` // number of limits defined
}

// OwnerReference represents the owner of a resource
type OwnerReference struct {
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	APIVersion string `json:"apiVersion"`
}

// APIResource represents a discovered API resource
type APIResource struct {
	Name       string   `json:"name"`
	Namespaced bool     `json:"namespaced"`
	Kind       string   `json:"kind"`
	Group      string   `json:"group"`
	Version    string   `json:"version"`
	APIVersion string   `json:"apiVersion"`
	Verbs      []string `json:"verbs"`
}

// ListAPIResources discovers and lists all available API resources in the cluster
func ListAPIResources(c *gin.Context) {
	contextName := c.Query("context")
	if contextName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := clusterManager.GetConnection(contextName)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Get all API resources using discovery
	discoveryClient := conn.ClientSet.Discovery()

	// Get all API resource lists
	apiResourceLists, err := discoveryClient.ServerPreferredResources()
	if err != nil {
		// Even with errors, we might have partial results
		if apiResourceLists == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to discover resources: %v", err)})
			return
		}
	}

	var resources []APIResource
	for _, apiResourceList := range apiResourceLists {
		// Parse the group/version from the GroupVersion field
		gv, err := schema.ParseGroupVersion(apiResourceList.GroupVersion)
		if err != nil {
			continue
		}

		for _, apiResource := range apiResourceList.APIResources {
			// Skip sub-resources (like pods/log, pods/exec)
			if strings.Contains(apiResource.Name, "/") {
				continue
			}

			resources = append(resources, APIResource{
				Name:       apiResource.Name,
				Namespaced: apiResource.Namespaced,
				Kind:       apiResource.Kind,
				Group:      gv.Group,
				Version:    gv.Version,
				APIVersion: apiResourceList.GroupVersion,
				Verbs:      apiResource.Verbs,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": resources,
		"total":     len(resources),
	})
}

// ListResources lists resources of any type dynamically
func ListResources(c *gin.Context) {
	var req ResourceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conn, err := clusterManager.GetConnection(req.Context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	// Create dynamic client
	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	// Build the GroupVersionResource
	var gvr schema.GroupVersionResource

	// If specific group/version/resource provided, use them
	if req.Group != "" && req.Version != "" && req.Resource != "" {
		gvr = schema.GroupVersionResource{
			Group:    req.Group,
			Version:  req.Version,
			Resource: req.Resource,
		}
	} else {
		// Try to discover the resource from Kind and APIVersion
		gvr, err = findResourceByKind(conn, req.Kind, req.APIVersion)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to find resource: %v", err)})
			return
		}
	}

	// Determine if the resource is namespaced
	isNamespaced, err := isResourceNamespaced(conn, gvr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to determine if resource is namespaced: %v", err)})
		return
	}

	// List resources
	var list *unstructured.UnstructuredList
	ctx := context.TODO()

	if isNamespaced {
		namespace := req.Namespace
		if namespace == "" || namespace == "all" {
			namespace = metav1.NamespaceAll
		}
		list, err = dynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	} else {
		list, err = dynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to list resources: %v", err)})
		return
	}

	// Cache clientset for performance optimization
	var clientset k8sclient.Interface
	var nodePodCounts map[string]int32
	if req.Enhance {
		var err error
		clientset, err = clusterManager.GetClientset(req.Context)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get clientset: %v", err)})
			return
		}

		// Pre-fetch node pod counts for performance optimization
		if req.Kind == "Node" {
			nodePodCounts, _ = getNodePodCounts(clientset)
		}
	}

	// Convert to ResourceItems
	var items []ResourceItem
	for _, item := range list.Items {
		metadata := item.Object["metadata"].(map[string]interface{})

		resourceItem := ResourceItem{
			Name:       metadata["name"].(string),
			Kind:       item.GetKind(),
			APIVersion: item.GetAPIVersion(),
		}

		if uid, ok := metadata["uid"].(string); ok {
			resourceItem.UID = uid
		}

		if namespace, ok := metadata["namespace"].(string); ok {
			resourceItem.Namespace = namespace
		}

		if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
			resourceItem.CreationTimestamp = creationTimestamp
		}

		if labels, ok := metadata["labels"].(map[string]interface{}); ok {
			resourceItem.Labels = make(map[string]string)
			for k, v := range labels {
				if str, ok := v.(string); ok {
					resourceItem.Labels[k] = str
				}
			}
		}

		// Enhance ReplicaSet items with additional information
		if req.Enhance && item.GetKind() == "ReplicaSet" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceReplicaSetItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Deployment items with additional information
		if req.Enhance && item.GetKind() == "Deployment" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceDeploymentItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Pod items with additional information
		if req.Enhance && item.GetKind() == "Pod" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhancePodItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance DaemonSet items with additional information
		if req.Enhance && item.GetKind() == "DaemonSet" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceDaemonSetItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance StatefulSet items with additional information
		if req.Enhance && item.GetKind() == "StatefulSet" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceStatefulSetItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Job items with additional information
		if req.Enhance && item.GetKind() == "Job" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceJobItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance CronJob items with additional information
		if req.Enhance && item.GetKind() == "CronJob" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceCronJobItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Service items with additional information
		if req.Enhance && item.GetKind() == "Service" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceServiceItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance ConfigMap items with additional information
		if req.Enhance && item.GetKind() == "ConfigMap" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceConfigMapItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Secret items with additional information
		if req.Enhance && item.GetKind() == "Secret" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceSecretItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance PersistentVolume items with additional information
		if req.Enhance && item.GetKind() == "PersistentVolume" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhancePVItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance PersistentVolumeClaim items with additional information
		if req.Enhance && item.GetKind() == "PersistentVolumeClaim" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhancePVCItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Ingress items with additional information
		if req.Enhance && item.GetKind() == "Ingress" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceIngressItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Namespace items with additional information
		if req.Enhance && item.GetKind() == "Namespace" {
			// Namespaces are cluster-scoped, so no namespace needed
			enhanceNamespaceItem(&resourceItem, clientset, "")
		}

		// Enhance ServiceAccount items with additional information
		if req.Enhance && item.GetKind() == "ServiceAccount" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceServiceAccountItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Role items with additional information
		if req.Enhance && item.GetKind() == "Role" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceRoleItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance RoleBinding items with additional information
		if req.Enhance && item.GetKind() == "RoleBinding" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceRoleBindingItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance ClusterRole items with additional information
		if req.Enhance && item.GetKind() == "ClusterRole" {
			// ClusterRoles are cluster-scoped, so no namespace needed
			enhanceClusterRoleItem(&resourceItem, clientset, "")
		}

		// Enhance ClusterRoleBinding items with additional information
		if req.Enhance && item.GetKind() == "ClusterRoleBinding" {
			// ClusterRoleBindings are cluster-scoped, so no namespace needed
			enhanceClusterRoleBindingItem(&resourceItem, clientset, "")
		}

		// Enhance NetworkPolicy items with additional information
		if req.Enhance && item.GetKind() == "NetworkPolicy" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceNetworkPolicyItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance StorageClass items with additional information
		if req.Enhance && item.GetKind() == "StorageClass" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceStorageClassItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance Event items with additional information
		if req.Enhance && item.GetKind() == "Event" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceEventItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance CustomResourceDefinition items with additional information
		if req.Enhance && item.GetKind() == "CustomResourceDefinition" {
			// CRDs are cluster-scoped, so no namespace needed
			enhanceCRDItem(&resourceItem, clientset, "", req.Context)
		}

		// Enhance Node items with additional information
		if req.Enhance && item.GetKind() == "Node" {
			// Nodes are cluster-scoped, so no namespace needed
			enhanceNodeItem(&resourceItem, clientset, "", nodePodCounts)
		}

		// Enhance ResourceQuota items with additional information
		if req.Enhance && item.GetKind() == "ResourceQuota" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceResourceQuotaItem(&resourceItem, clientset, namespace)
			}
		}

		// Enhance LimitRange items with additional information
		if req.Enhance && item.GetKind() == "LimitRange" {
			namespace := req.Namespace
			if namespace == "" || namespace == "all" {
				namespace = resourceItem.Namespace
			}
			if namespace != "" {
				enhanceLimitRangeItem(&resourceItem, clientset, namespace)
			}
		}

		items = append(items, resourceItem)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": len(items),
	})
}

// GetManifest returns the YAML manifest for any resource type
func GetManifest(c *gin.Context) {
	clusterContext := c.Query("context")
	name := c.Query("name")

	// Accept resource info either from path params or query params
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")

	// Alternative: accept kind and apiVersion to discover the resource
	kind := c.Query("kind")
	apiVersion := c.Query("apiVersion")

	if clusterContext == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and name are required"})
		return
	}

	if (group == "" || version == "" || resource == "") && (kind == "" || apiVersion == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "either (group, version, resource) or (kind, apiVersion) are required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		errMsg := "cluster not connected"
		if err != nil {
			errMsg = fmt.Sprintf("cluster not connected: %v", err)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "context": clusterContext})
		return
	}

	// Create dynamic client
	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	// Build the GroupVersionResource
	var gvr schema.GroupVersionResource

	if group != "" && version != "" && resource != "" {
		gvr = schema.GroupVersionResource{
			Group:    group,
			Version:  version,
			Resource: resource,
		}
	} else {
		// Try to discover the resource from Kind and APIVersion
		gvr, err = findResourceByKind(conn, kind, apiVersion)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to find resource: %v", err)})
			return
		}
	}

	// Determine if the resource is namespaced
	isNamespaced, err := isResourceNamespaced(conn, gvr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to determine if resource is namespaced: %v", err)})
		return
	}

	// Get the resource
	var obj *unstructured.Unstructured
	ctx := context.TODO()

	if isNamespaced {
		if namespace == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required for namespaced resources"})
			return
		}
		obj, err = dynamicClient.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		obj, err = dynamicClient.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get resource: %v", err)})
		return
	}

	// Clean the manifest
	cleanManifest(obj)

	// Convert to YAML
	yamlData, err := yaml.Marshal(obj.Object)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to convert to YAML: %v", err)})
		return
	}

	c.String(http.StatusOK, string(yamlData))
}

// findResourceByKind discovers the GVR for a given Kind and APIVersion
func findResourceByKind(conn *kubernetes.ClusterConnection, kind string, apiVersion string) (schema.GroupVersionResource, error) {
	// Parse the apiVersion
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		// Handle core/v1 or just v1
		if apiVersion == "v1" || apiVersion == "core/v1" {
			gv = schema.GroupVersion{Group: "", Version: "v1"}
		} else {
			return schema.GroupVersionResource{}, fmt.Errorf("invalid apiVersion: %s", apiVersion)
		}
	}

	// Get the discovery client
	discoveryClient := conn.ClientSet.Discovery()

	// Get the API resource list for this group/version
	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(gv.String())
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("failed to discover resources for %s: %v", gv.String(), err)
	}

	// Find the resource with matching Kind
	for _, apiResource := range resourceList.APIResources {
		if apiResource.Kind == kind {
			return schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: apiResource.Name,
			}, nil
		}
	}

	return schema.GroupVersionResource{}, fmt.Errorf("resource with kind %s not found in %s", kind, apiVersion)
}

// isResourceNamespaced checks if a resource is namespaced
func isResourceNamespaced(conn *kubernetes.ClusterConnection, gvr schema.GroupVersionResource) (bool, error) {
	discoveryClient := conn.ClientSet.Discovery()

	// Get the API resource list for this group/version
	gvString := gvr.GroupVersion().String()
	if gvr.Group == "" {
		gvString = gvr.Version
	}

	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(gvString)
	if err != nil {
		return false, err
	}

	// Find the resource and check if it's namespaced
	for _, apiResource := range resourceList.APIResources {
		if apiResource.Name == gvr.Resource {
			return apiResource.Namespaced, nil
		}
	}

	return false, fmt.Errorf("resource %s not found", gvr.Resource)
}

// GetRelatedResources returns resources related to a given resource (owners and children)
func GetRelatedResources(c *gin.Context) {
	clusterContext := c.Query("context")
	name := c.Query("name")
	namespace := c.Query("namespace")
	kind := c.Query("kind")
	// apiVersion is provided but not currently used as we handle known resource types
	// It could be used in the future for more dynamic resource discovery
	_ = c.Query("apiVersion")

	if clusterContext == "" || name == "" || kind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, name, and kind are required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		errMsg := "cluster not connected"
		if err != nil {
			errMsg = fmt.Sprintf("cluster not connected: %v", err)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "context": clusterContext})
		return
	}

	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	type RelatedResource struct {
		Name         string `json:"name"`
		Namespace    string `json:"namespace,omitempty"`
		Kind         string `json:"kind"`
		APIVersion   string `json:"apiVersion"`
		Relationship string `json:"relationship"` // "owner" or "child"
	}

	var relatedResources []RelatedResource
	ctx := context.TODO()

	// Handle different resource relationships
	switch strings.ToLower(kind) {
	case "deployment":
		// Get ReplicaSets owned by this Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}

		rsList, err := dynamicClient.Resource(rsGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, rs := range rsList.Items {
				// Check if this ReplicaSet is owned by our Deployment
				ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "Deployment" && owner["name"] == name {
								rsName, _, _ := unstructured.NestedString(rs.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         rsName,
									Namespace:    namespace,
									Kind:         "ReplicaSet",
									APIVersion:   "apps/v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "replicaset":
		// Get owner Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}

		rs, err := dynamicClient.Resource(rsGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						if owner["kind"] == "Deployment" {
							ownerName, _ := owner["name"].(string)
							relatedResources = append(relatedResources, RelatedResource{
								Name:         ownerName,
								Namespace:    namespace,
								Kind:         "Deployment",
								APIVersion:   "apps/v1",
								Relationship: "owner",
							})
						}
					}
				}
			}
		}

		// Get Pods owned by this ReplicaSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "ReplicaSet" && owner["name"] == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         podName,
									Namespace:    namespace,
									Kind:         "Pod",
									APIVersion:   "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "pod":
		// Get owner (could be ReplicaSet, DaemonSet, StatefulSet, Job, etc.)
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		pod, err := dynamicClient.Resource(podGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						ownerKind, _ := owner["kind"].(string)
						ownerName, _ := owner["name"].(string)
						ownerAPIVersion, _ := owner["apiVersion"].(string)

						if ownerAPIVersion == "" {
							// Default API versions for common owners
							switch ownerKind {
							case "ReplicaSet", "DaemonSet", "StatefulSet", "Deployment":
								ownerAPIVersion = "apps/v1"
							case "Job":
								ownerAPIVersion = "batch/v1"
							case "CronJob":
								ownerAPIVersion = "batch/v1"
							}
						}

						relatedResources = append(relatedResources, RelatedResource{
							Name:         ownerName,
							Namespace:    namespace,
							Kind:         ownerKind,
							APIVersion:   ownerAPIVersion,
							Relationship: "owner",
						})
					}
				}
			}
		}

	case "statefulset", "daemonset":
		// Get Pods owned by this StatefulSet/DaemonSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							ownerKind, _ := owner["kind"].(string)
							ownerName, _ := owner["name"].(string)
							if strings.EqualFold(ownerKind, kind) && ownerName == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         podName,
									Namespace:    namespace,
									Kind:         "Pod",
									APIVersion:   "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "service":
		// Get Pods selected by this Service
		svcGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "services",
		}

		svc, err := dynamicClient.Resource(svcGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			selector, found, _ := unstructured.NestedStringMap(svc.Object, "spec", "selector")
			if found && len(selector) > 0 {
				// Build label selector
				var labelSelectors []string
				for k, v := range selector {
					labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", k, v))
				}
				labelSelector := strings.Join(labelSelectors, ",")

				// Get pods matching the selector
				podGVR := schema.GroupVersionResource{
					Group:    "",
					Version:  "v1",
					Resource: "pods",
				}

				podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, pod := range podList.Items {
						podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
						relatedResources = append(relatedResources, RelatedResource{
							Name:         podName,
							Namespace:    namespace,
							Kind:         "Pod",
							APIVersion:   "v1",
							Relationship: "child",
						})
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": relatedResources,
	})
}

// GetRelatedResourcesWithPath handles path-based related resources endpoint
func GetRelatedResourcesWithPath(c *gin.Context) {
	// Extract from path parameters
	clusterContext := c.Param("context")
	name := c.Param("name")

	// Extract from query parameters
	namespace := c.Query("namespace")
	kind := c.Query("kind")
	// apiVersion is provided but not currently used as we handle known resource types
	// It could be used in the future for more dynamic resource discovery
	_ = c.Query("apiVersion")

	if clusterContext == "" || name == "" || kind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, name, and kind are required"})
		return
	}

	conn, err := clusterManager.GetConnection(clusterContext)
	if err != nil || conn == nil {
		errMsg := "cluster not connected"
		if err != nil {
			errMsg = fmt.Sprintf("cluster not connected: %v", err)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "context": clusterContext})
		return
	}

	dynamicClient := dynamic.NewForConfigOrDie(conn.Config)

	type RelatedResource struct {
		Name         string `json:"name"`
		Namespace    string `json:"namespace,omitempty"`
		Kind         string `json:"kind"`
		APIVersion   string `json:"apiVersion"`
		Relationship string `json:"relationship"` // "owner" or "child"
	}

	var relatedResources []RelatedResource
	ctx := context.TODO()

	// Handle different resource relationships
	switch strings.ToLower(kind) {
	case "deployment":
		// Get ReplicaSets owned by this Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}

		rsList, err := dynamicClient.Resource(rsGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, rs := range rsList.Items {
				// Check if this ReplicaSet is owned by our Deployment
				ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "Deployment" && owner["name"] == name {
								rsName, _, _ := unstructured.NestedString(rs.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         rsName,
									Namespace:    namespace,
									Kind:         "ReplicaSet",
									APIVersion:   "apps/v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "replicaset":
		// Get owner Deployment
		rsGVR := schema.GroupVersionResource{
			Group:    "apps",
			Version:  "v1",
			Resource: "replicasets",
		}

		rs, err := dynamicClient.Resource(rsGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(rs.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						if owner["kind"] == "Deployment" {
							ownerName, _ := owner["name"].(string)
							relatedResources = append(relatedResources, RelatedResource{
								Name:         ownerName,
								Namespace:    namespace,
								Kind:         "Deployment",
								APIVersion:   "apps/v1",
								Relationship: "owner",
							})
						}
					}
				}
			}
		}

		// Get Pods owned by this ReplicaSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							if owner["kind"] == "ReplicaSet" && owner["name"] == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         podName,
									Namespace:    namespace,
									Kind:         "Pod",
									APIVersion:   "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "pod":
		// Get owner (could be ReplicaSet, DaemonSet, StatefulSet, Job, etc.)
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		pod, err := dynamicClient.Resource(podGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
			if found {
				for _, ownerRef := range ownerRefs {
					if owner, ok := ownerRef.(map[string]interface{}); ok {
						ownerKind, _ := owner["kind"].(string)
						ownerName, _ := owner["name"].(string)
						ownerAPIVersion, _ := owner["apiVersion"].(string)

						if ownerAPIVersion == "" {
							// Default API versions for common owners
							switch ownerKind {
							case "ReplicaSet", "DaemonSet", "StatefulSet", "Deployment":
								ownerAPIVersion = "apps/v1"
							case "Job":
								ownerAPIVersion = "batch/v1"
							case "CronJob":
								ownerAPIVersion = "batch/v1"
							}
						}

						relatedResources = append(relatedResources, RelatedResource{
							Name:         ownerName,
							Namespace:    namespace,
							Kind:         ownerKind,
							APIVersion:   ownerAPIVersion,
							Relationship: "owner",
						})
					}
				}
			}
		}

	case "statefulset", "daemonset":
		// Get Pods owned by this StatefulSet/DaemonSet
		podGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "pods",
		}

		podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range podList.Items {
				ownerRefs, found, _ := unstructured.NestedSlice(pod.Object, "metadata", "ownerReferences")
				if found {
					for _, ownerRef := range ownerRefs {
						if owner, ok := ownerRef.(map[string]interface{}); ok {
							ownerKind, _ := owner["kind"].(string)
							ownerName, _ := owner["name"].(string)
							if strings.EqualFold(ownerKind, kind) && ownerName == name {
								podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
								relatedResources = append(relatedResources, RelatedResource{
									Name:         podName,
									Namespace:    namespace,
									Kind:         "Pod",
									APIVersion:   "v1",
									Relationship: "child",
								})
							}
						}
					}
				}
			}
		}

	case "service":
		// Get Pods selected by this Service
		svcGVR := schema.GroupVersionResource{
			Group:    "",
			Version:  "v1",
			Resource: "services",
		}

		svc, err := dynamicClient.Resource(svcGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			selector, found, _ := unstructured.NestedStringMap(svc.Object, "spec", "selector")
			if found && len(selector) > 0 {
				// Build label selector
				var labelSelectors []string
				for k, v := range selector {
					labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", k, v))
				}
				labelSelector := strings.Join(labelSelectors, ",")

				// Get pods matching the selector
				podGVR := schema.GroupVersionResource{
					Group:    "",
					Version:  "v1",
					Resource: "pods",
				}

				podList, err := dynamicClient.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{
					LabelSelector: labelSelector,
				})
				if err == nil {
					for _, pod := range podList.Items {
						podName, _, _ := unstructured.NestedString(pod.Object, "metadata", "name")
						relatedResources = append(relatedResources, RelatedResource{
							Name:         podName,
							Namespace:    namespace,
							Kind:         "Pod",
							APIVersion:   "v1",
							Relationship: "child",
						})
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"resources": relatedResources,
	})
}

// cleanManifest removes unnecessary fields from the manifest
func cleanManifest(obj *unstructured.Unstructured) {
	// Remove managed fields
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")
	unstructured.RemoveNestedField(obj.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(obj.Object, "metadata", "selfLink")
	unstructured.RemoveNestedField(obj.Object, "metadata", "uid")
	unstructured.RemoveNestedField(obj.Object, "metadata", "generation")

	// Remove empty status if it exists
	if status, found, _ := unstructured.NestedMap(obj.Object, "status"); found {
		if len(status) == 0 {
			unstructured.RemoveNestedField(obj.Object, "status")
		}
	}

	// Remove empty finalizers
	if finalizers, found, _ := unstructured.NestedSlice(obj.Object, "metadata", "finalizers"); found {
		if len(finalizers) == 0 {
			unstructured.RemoveNestedField(obj.Object, "metadata", "finalizers")
		}
	}

	// Remove empty ownerReferences
	if ownerRefs, found, _ := unstructured.NestedSlice(obj.Object, "metadata", "ownerReferences"); found {
		if len(ownerRefs) == 0 {
			unstructured.RemoveNestedField(obj.Object, "metadata", "ownerReferences")
		}
	}
}
