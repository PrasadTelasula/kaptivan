package topology

import (
	"context"
	"fmt"
	"time"

	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// JobService handles Job topology operations
type JobService struct {
	clusterManager *kubernetes.ClusterManager
}

// NewJobService creates a new JobService
func NewJobService(clusterManager *kubernetes.ClusterManager) *JobService {
	return &JobService{
		clusterManager: clusterManager,
	}
}

// GetJobTopology returns the complete topology for a Job
func (s *JobService) GetJobTopology(ctx context.Context, contextName, namespace, jobName string) (*JobTopology, error) {
	conn, err := s.clusterManager.GetConnection(contextName)
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster connection: %w", err)
	}

	// Get Job
	job, err := conn.ClientSet.BatchV1().Jobs(namespace).Get(ctx, jobName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	topology := &JobTopology{
		Namespace: namespace,
		Job:       convertJobToJobInfo(job),
	}

	// OPTIMIZATION: Fetch all pods in namespace once, then filter locally
	// This avoids multiple API calls and improves performance
	allPods, err := conn.ClientSet.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	// Filter pods owned by this Job
	var jobPods []corev1.Pod
	for _, pod := range allPods.Items {
		if owner := metav1.GetControllerOf(&pod); owner != nil && owner.Kind == "Job" && owner.UID == job.UID {
			jobPods = append(jobPods, pod)
		}
	}

	// Convert pods
	for _, pod := range jobPods {
		containers := make([]ContainerRef, 0, len(pod.Spec.Containers))
		
		// Create a map of container statuses for quick lookup
		statusMap := make(map[string]corev1.ContainerStatus)
		for _, status := range pod.Status.ContainerStatuses {
			statusMap[status.Name] = status
		}
		
		for _, container := range pod.Spec.Containers {
			containerRef := ContainerRef{
				Name:  container.Name,
				Image: container.Image,
			}
			
			// Get container status if available
			if status, exists := statusMap[container.Name]; exists {
				containerRef.Ready = status.Ready
				containerRef.RestartCount = status.RestartCount
				
				// Determine container state
				if status.State.Running != nil {
					containerRef.State = "Running"
					containerRef.StartTime = &status.State.Running.StartedAt.Time
				} else if status.State.Waiting != nil {
					containerRef.State = "Waiting"
					containerRef.Reason = status.State.Waiting.Reason
				} else if status.State.Terminated != nil {
					containerRef.State = "Terminated"
					containerRef.Reason = status.State.Terminated.Reason
				}
			}
			
			containers = append(containers, containerRef)
		}
		topology.Pods = append(topology.Pods, PodRef{
			Name:       pod.Name,
			Phase:      PodPhase(pod.Status.Phase),
			Containers: containers,
			NodeName:   pod.Spec.NodeName,
			HostIP:     pod.Status.HostIP,
		})
	}

	// Get Services (Jobs typically don't have services, but check anyway)
	services, err := conn.ClientSet.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	// Check if any services select pods with job labels
	for _, svc := range services.Items {
		if len(svc.Spec.Selector) > 0 && selectsJobPods(svc.Spec.Selector, job.Spec.Selector.MatchLabels) {
			topology.Services = append(topology.Services, ServiceRef{
				Name:     svc.Name,
				Type:     string(svc.Spec.Type),
				Selector: svc.Spec.Selector,
			})
			
			// Get endpoints for the service
			endpoints, err := conn.ClientSet.CoreV1().Endpoints(namespace).Get(ctx, svc.Name, metav1.GetOptions{})
			if err == nil {
				topology.Endpoints = append(topology.Endpoints, EndpointsRef{
					Name: endpoints.Name,
				})
			}
		}
	}

	// Get ConfigMaps and Secrets used by the pods
	configMaps := make(map[string]*corev1.ConfigMap)
	secrets := make(map[string]*corev1.Secret)

	for _, pod := range jobPods {
		// Check volumes
		for _, volume := range pod.Spec.Volumes {
			if volume.ConfigMap != nil {
				if _, exists := configMaps[volume.ConfigMap.Name]; !exists {
					cm, err := conn.ClientSet.CoreV1().ConfigMaps(namespace).Get(ctx, volume.ConfigMap.Name, metav1.GetOptions{})
					if err == nil {
						configMaps[volume.ConfigMap.Name] = cm
					}
				}
			}
			if volume.Secret != nil {
				if _, exists := secrets[volume.Secret.SecretName]; !exists {
					secret, err := conn.ClientSet.CoreV1().Secrets(namespace).Get(ctx, volume.Secret.SecretName, metav1.GetOptions{})
					if err == nil {
						secrets[volume.Secret.SecretName] = secret
					}
				}
			}
		}

		// Check env from
		for _, container := range pod.Spec.Containers {
			for _, envFrom := range container.EnvFrom {
				if envFrom.ConfigMapRef != nil {
					if _, exists := configMaps[envFrom.ConfigMapRef.Name]; !exists {
						cm, err := conn.ClientSet.CoreV1().ConfigMaps(namespace).Get(ctx, envFrom.ConfigMapRef.Name, metav1.GetOptions{})
						if err == nil {
							configMaps[envFrom.ConfigMapRef.Name] = cm
						}
					}
				}
				if envFrom.SecretRef != nil {
					if _, exists := secrets[envFrom.SecretRef.Name]; !exists {
						secret, err := conn.ClientSet.CoreV1().Secrets(namespace).Get(ctx, envFrom.SecretRef.Name, metav1.GetOptions{})
						if err == nil {
							secrets[envFrom.SecretRef.Name] = secret
						}
					}
				}
			}
		}
	}

	// Convert ConfigMaps with full metadata and mount information
	for _, cm := range configMaps {
		configMapRef := ConfigMapRef{
			Name:              cm.Name,
			Immutable:         cm.Immutable != nil && *cm.Immutable,
			Data:              make(map[string]string),
			CreationTimestamp: &cm.CreationTimestamp.Time,
		}
		
		// Add data keys (ConfigMap data is not sensitive)
		for key := range cm.Data {
			configMapRef.Data[key] = cm.Data[key]
		}
		for key := range cm.BinaryData {
			configMapRef.Data[key+" (binary)"] = "***" // Don't expose binary data
		}
		
		// Check if this configmap is mounted in the job's pods
		mountedAt := s.checkIfMountedInJob(cm.Name, "configmap", job, jobPods)
		if len(mountedAt) > 0 {
			configMapRef.MountedAt = mountedAt
		}
		
		topology.ConfigMaps = append(topology.ConfigMaps, configMapRef)
	}

	// Convert Secrets with full metadata and mount information
	for _, secret := range secrets {
		secretRef := SecretRef{
			Name:              secret.Name,
			Type:              string(secret.Type),
			Immutable:         secret.Immutable != nil && *secret.Immutable,
			Data:              make(map[string]string),
			CreationTimestamp: &secret.CreationTimestamp.Time,
		}
		
		// Add data keys but redact values
		for key := range secret.Data {
			secretRef.Data[key] = "***" // Redacted for security
		}
		for key := range secret.StringData {
			secretRef.Data[key] = "***" // Redacted for security
		}
		
		// Check if this secret is mounted in the job's pods
		mountedAt := s.checkIfMountedInJob(secret.Name, "secret", job, jobPods)
		if len(mountedAt) > 0 {
			secretRef.MountedAt = mountedAt
		}
		
		topology.Secrets = append(topology.Secrets, secretRef)
	}

	// Get ServiceAccount if specified
	if len(jobPods) > 0 && jobPods[0].Spec.ServiceAccountName != "" {
		sa, err := conn.ClientSet.CoreV1().ServiceAccounts(namespace).Get(ctx, jobPods[0].Spec.ServiceAccountName, metav1.GetOptions{})
		if err == nil {
			topology.ServiceAccount = &ServiceAccountRef{
				Name: sa.Name,
			}
		}
	}

	// Get RBAC resources if ServiceAccount exists
	if topology.ServiceAccount != nil {
		// Get RoleBindings
		roleBindings, err := conn.ClientSet.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, rb := range roleBindings.Items {
				if bindsToServiceAccount(&rb, topology.ServiceAccount.Name, namespace) {
					topology.RoleBindings = append(topology.RoleBindings, RoleBindingRef{
						Name:      rb.Name,
						Namespace: rb.Namespace,
						RoleRef: RoleRefInfo{
							Kind: rb.RoleRef.Kind,
							Name: rb.RoleRef.Name,
						},
					})
					
					// Get the Role if it's in the same namespace
					if rb.RoleRef.Kind == "Role" {
						role, err := conn.ClientSet.RbacV1().Roles(namespace).Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
						if err == nil {
							topology.Roles = append(topology.Roles, RoleRef{
								Name: role.Name,
							})
						}
					}
				}
			}
		}

		// Get ClusterRoleBindings
		clusterRoleBindings, err := conn.ClientSet.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, crb := range clusterRoleBindings.Items {
				if bindsToServiceAccountCluster(&crb, topology.ServiceAccount.Name, namespace) {
					topology.ClusterRoleBindings = append(topology.ClusterRoleBindings, RoleBindingRef{
						Name: crb.Name,
						RoleRef: RoleRefInfo{
							Kind: crb.RoleRef.Kind,
							Name: crb.RoleRef.Name,
						},
					})
					
					// Get the ClusterRole
					if crb.RoleRef.Kind == "ClusterRole" {
						clusterRole, err := conn.ClientSet.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
						if err == nil {
							topology.ClusterRoles = append(topology.ClusterRoles, RoleRef{
								Name: clusterRole.Name,
							})
						}
					}
				}
			}
		}
	}

	return topology, nil
}

// ListJobs returns a list of all Jobs in a namespace
func (s *JobService) ListJobs(ctx context.Context, contextName, namespace string) ([]JobSummary, error) {
	conn, err := s.clusterManager.GetConnection(contextName)
	if err != nil {
		return nil, fmt.Errorf("failed to get cluster connection: %w", err)
	}

	var listOptions metav1.ListOptions
	var jobList *batchv1.JobList

	if namespace != "" {
		// List jobs in specific namespace
		jobList, err = conn.ClientSet.BatchV1().Jobs(namespace).List(ctx, listOptions)
	} else {
		// List jobs in all namespaces
		jobList, err = conn.ClientSet.BatchV1().Jobs("").List(ctx, listOptions)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	summaries := make([]JobSummary, 0, len(jobList.Items))
	for _, job := range jobList.Items {
		summary := JobSummary{
			Name:           job.Name,
			Namespace:      job.Namespace,
			Completions:    job.Spec.Completions,
			Parallelism:    job.Spec.Parallelism,
			Active:         job.Status.Active,
			Succeeded:      job.Status.Succeeded,
			Failed:         job.Status.Failed,
			StartTime:      convertTime(job.Status.StartTime),
			CompletionTime: convertTime(job.Status.CompletionTime),
		}
		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// convertJobToJobInfo converts a Kubernetes Job to JobInfo
func convertJobToJobInfo(job *batchv1.Job) JobInfo {
	info := JobInfo{
		Name:              job.Name,
		Namespace:         job.Namespace,
		Labels:            job.Labels,
		Annotations:       job.Annotations,
		CreationTimestamp: &job.CreationTimestamp.Time,
		StartTime:         convertTime(job.Status.StartTime),
		CompletionTime:    convertTime(job.Status.CompletionTime),
		Completions:       job.Spec.Completions,
		Parallelism:       job.Spec.Parallelism,
		BackoffLimit:      job.Spec.BackoffLimit,
		Active:            job.Status.Active,
		Succeeded:         job.Status.Succeeded,
		Failed:            job.Status.Failed,
	}

	// Convert conditions
	for _, condition := range job.Status.Conditions {
		info.Conditions = append(info.Conditions, Condition{
			Type:    string(condition.Type),
			Status:  string(condition.Status),
			Reason:  condition.Reason,
			Message: condition.Message,
		})
	}

	// Determine status based on job state
	if job.Status.CompletionTime != nil && job.Status.Succeeded > 0 {
		info.Status = StatusHealthy
	} else if job.Status.Failed > 0 {
		info.Status = StatusError
	} else if job.Status.Active > 0 {
		info.Status = StatusWarning
	} else {
		info.Status = StatusUnknown
	}

	return info
}

// checkIfMountedInJob checks if a ConfigMap or Secret is mounted in Job pods
func (s *JobService) checkIfMountedInJob(name string, resourceType string, job *batchv1.Job, pods []corev1.Pod) []string {
	var mountedAt []string
	mountedMap := make(map[string]bool) // Track unique mount paths
	
	// First check the Job's pod template spec (the source of truth)
	if job != nil && job.Spec.Template.Spec.Volumes != nil {
		volumeNameMap := make(map[string]string) // Map volume name to volume definition info
		
		// Find volumes that use this secret/configmap in the template
		for _, volume := range job.Spec.Template.Spec.Volumes {
			if resourceType == "secret" && volume.Secret != nil && volume.Secret.SecretName == name {
				volumeNameMap[volume.Name] = fmt.Sprintf("volume:%s", volume.Name)
			}
			if resourceType == "configmap" && volume.ConfigMap != nil && volume.ConfigMap.Name == name {
				volumeNameMap[volume.Name] = fmt.Sprintf("volume:%s", volume.Name)
			}
		}
		
		// If volume is defined but not mounted anywhere, report it as defined
		hasVolumeMounts := false
		
		// Check where these volumes are mounted in the template's containers
		for _, container := range job.Spec.Template.Spec.Containers {
			for _, volumeMount := range container.VolumeMounts {
				if _, exists := volumeNameMap[volumeMount.Name]; exists {
					// Format: container-name:mount-path
					mountPath := fmt.Sprintf("%s:%s", container.Name, volumeMount.MountPath)
					if !mountedMap[mountPath] {
						mountedAt = append(mountedAt, mountPath)
						mountedMap[mountPath] = true
						hasVolumeMounts = true
					}
				}
			}
			
			// Check environment variables
			for _, env := range container.Env {
				if env.ValueFrom != nil {
					if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
						envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
					if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
						envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
				}
			}
			
			// Check envFrom
			for _, envFrom := range container.EnvFrom {
				if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
					envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
				if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
					envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
			}
		}
		
		// Also check init containers in the template
		for _, container := range job.Spec.Template.Spec.InitContainers {
			for _, volumeMount := range container.VolumeMounts {
				if _, exists := volumeNameMap[volumeMount.Name]; exists {
					mountPath := fmt.Sprintf("init-%s:%s", container.Name, volumeMount.MountPath)
					if !mountedMap[mountPath] {
						mountedAt = append(mountedAt, mountPath)
						mountedMap[mountPath] = true
						hasVolumeMounts = true
					}
				}
			}
			
			// Check env in init containers
			for _, env := range container.Env {
				if env.ValueFrom != nil {
					if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
						envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
					if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
						envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
				}
			}
			
			// Check envFrom in init containers
			for _, envFrom := range container.EnvFrom {
				if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
					envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
				if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
					envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
			}
		}
		
		// If volumes are defined but not mounted anywhere, report them as defined
		if !hasVolumeMounts && len(volumeNameMap) > 0 {
			for volumeName := range volumeNameMap {
				definedPath := fmt.Sprintf("defined-as-volume:%s", volumeName)
				if !mountedMap[definedPath] {
					mountedAt = append(mountedAt, definedPath)
					mountedMap[definedPath] = true
				}
			}
		}
	}
	
	// If we didn't find mounts in the template or want to verify with actual pods, check the pods too
	// This is a fallback in case the pods have different mounts than the template
	for _, pod := range pods {
		volumeNameMap := make(map[string]bool)
		
		// First, find volumes that use this secret/configmap
		for _, volume := range pod.Spec.Volumes {
			if resourceType == "secret" && volume.Secret != nil && volume.Secret.SecretName == name {
				volumeNameMap[volume.Name] = true
			}
			if resourceType == "configmap" && volume.ConfigMap != nil && volume.ConfigMap.Name == name {
				volumeNameMap[volume.Name] = true
			}
		}
		
		// Check where these volumes are mounted in containers
		for _, container := range pod.Spec.Containers {
			for _, volumeMount := range container.VolumeMounts {
				if volumeNameMap[volumeMount.Name] {
					// Format: container-name:mount-path
					mountPath := fmt.Sprintf("%s:%s", container.Name, volumeMount.MountPath)
					if !mountedMap[mountPath] {
						mountedAt = append(mountedAt, mountPath)
						mountedMap[mountPath] = true
					}
				}
			}
			
			// Also check environment variables
			for _, env := range container.Env {
				if env.ValueFrom != nil {
					if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
						// Format: container-name:env:ENV_NAME
						envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
					if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
						// Format: container-name:env:ENV_NAME
						envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
				}
			}
			
			// Check envFrom for entire ConfigMap/Secret as environment variables
			for _, envFrom := range container.EnvFrom {
				if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
					envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
				if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
					envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
			}
		}
		
		// Also check init containers
		for _, container := range pod.Spec.InitContainers {
			for _, volumeMount := range container.VolumeMounts {
				if volumeNameMap[volumeMount.Name] {
					// Format: container-name:mount-path (with init- prefix)
					mountPath := fmt.Sprintf("init-%s:%s", container.Name, volumeMount.MountPath)
					if !mountedMap[mountPath] {
						mountedAt = append(mountedAt, mountPath)
						mountedMap[mountPath] = true
					}
				}
			}
			
			// Check environment variables in init containers
			for _, env := range container.Env {
				if env.ValueFrom != nil {
					if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
						envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
					if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
						envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
						if !mountedMap[envPath] {
							mountedAt = append(mountedAt, envPath)
							mountedMap[envPath] = true
						}
					}
				}
			}
			
			// Check envFrom in init containers
			for _, envFrom := range container.EnvFrom {
				if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
					envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
				if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
					envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
					if !mountedMap[envPath] {
						mountedAt = append(mountedAt, envPath)
						mountedMap[envPath] = true
					}
				}
			}
		}
	}
	
	return mountedAt
}

// Helper function to check if service selector matches job pod labels
func selectsJobPods(serviceSelector, jobSelector map[string]string) bool {
	for key, value := range serviceSelector {
		if jobValue, exists := jobSelector[key]; exists && jobValue == value {
			return true
		}
	}
	return false
}

// Helper function to check if RoleBinding binds to a ServiceAccount
func bindsToServiceAccount(rb *rbacv1.RoleBinding, saName, namespace string) bool {
	for _, subject := range rb.Subjects {
		if subject.Kind == "ServiceAccount" && 
		   subject.Name == saName && 
		   (subject.Namespace == "" || subject.Namespace == namespace) {
			return true
		}
	}
	return false
}

// Helper function to check if ClusterRoleBinding binds to a ServiceAccount
func bindsToServiceAccountCluster(crb *rbacv1.ClusterRoleBinding, saName, namespace string) bool {
	for _, subject := range crb.Subjects {
		if subject.Kind == "ServiceAccount" && 
		   subject.Name == saName && 
		   subject.Namespace == namespace {
			return true
		}
	}
	return false
}
// Helper function to determine pod status
func determinePodStatus(pod *corev1.Pod) K8sStatus {
	if pod.Status.Phase == corev1.PodRunning {
		// Check if all containers are ready
		allReady := true
		for _, cs := range pod.Status.ContainerStatuses {
			if !cs.Ready {
				allReady = false
				break
			}
		}
		if allReady {
			return StatusHealthy
		}
		return StatusWarning
	} else if pod.Status.Phase == corev1.PodSucceeded {
		return StatusHealthy
	} else if pod.Status.Phase == corev1.PodFailed {
		return StatusError
	} else if pod.Status.Phase == corev1.PodPending {
		return StatusWarning
	}
	return StatusUnknown
}

// Helper function to convert k8s time to regular time
func convertTime(t *metav1.Time) *time.Time {
	if t == nil {
		return nil
	}
	return &t.Time
}
