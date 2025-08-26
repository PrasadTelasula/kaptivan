package topology

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/robfig/cron/v3"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// CronJobService handles CronJob topology operations
type CronJobService struct {
	clientset *kubernetes.Clientset
	service   *Service
}

// NewCronJobService creates a new CronJobService
func NewCronJobService(clientset *kubernetes.Clientset) *CronJobService {
	return &CronJobService{
		clientset: clientset,
		service:   &Service{clientset: clientset},
	}
}

// calculateNextScheduleTime calculates the next run time based on cron schedule
func calculateNextScheduleTime(schedule string, lastScheduleTime *time.Time) (*time.Time, error) {
	// Parse the cron schedule
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	cronSchedule, err := parser.Parse(schedule)
	if err != nil {
		return nil, fmt.Errorf("failed to parse cron schedule: %w", err)
	}
	
	// Always calculate next run time from now to avoid showing past times
	baseTime := time.Now()
	
	nextTime := cronSchedule.Next(baseTime)
	if nextTime.IsZero() {
		return nil, nil
	}
	
	return &nextTime, nil
}

// GetCronJobTopology retrieves the complete topology for a CronJob
func (s *CronJobService) GetCronJobTopology(ctx context.Context, namespace, name string) (*CronJobTopology, error) {
	// Fetch the CronJob
	cronJob, err := s.clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get cronjob: %w", err)
	}

	topology := &CronJobTopology{
		Namespace: namespace,
		CronJob:   s.buildCronJobInfo(cronJob),
	}

	// Fetch Jobs created by this CronJob
	jobs, err := s.getJobsForCronJob(ctx, namespace, cronJob)
	if err != nil {
		return nil, fmt.Errorf("failed to get jobs for cronjob %s: %w", cronJob.Name, err)
	}

	// Process jobs and collect pods
	var allPods []corev1.Pod
	for _, job := range jobs {
		topology.Jobs = append(topology.Jobs, s.buildJobRef(&job))

		// Get pods for this job
		pods, err := s.getPodsForJob(ctx, namespace, &job)
		if err != nil {
			log.Printf("Failed to get pods for job %s: %v", job.Name, err)
			continue
		}
		allPods = append(allPods, pods...)
	}

	// Add pods to topology
	for _, pod := range allPods {
		topology.Pods = append(topology.Pods, s.service.buildPodRef(&pod))
	}

	// Fetch Services that might select these pods
	if len(allPods) > 0 {
		services, err := s.getServicesForCronJob(ctx, namespace, cronJob)
		if err != nil {
			return nil, fmt.Errorf("failed to get services: %w", err)
		}

		for _, svc := range services {
			topology.Services = append(topology.Services, s.service.buildServiceRef(&svc))
		}

		// Fetch Endpoints for services
		for _, svc := range services {
			endpoints, err := s.clientset.CoreV1().Endpoints(namespace).Get(ctx, svc.Name, metav1.GetOptions{})
			if err == nil {
				topology.Endpoints = append(topology.Endpoints, s.service.buildEndpointsRef(endpoints))
			}
		}
	}

	// Fetch Secrets and ConfigMaps from CronJob template
	secrets, configMaps := s.getAllSecretsAndConfigMapsForCronJob(ctx, namespace, cronJob)
	topology.Secrets = secrets
	topology.ConfigMaps = configMaps

	// Fetch ServiceAccount
	saName := cronJob.Spec.JobTemplate.Spec.Template.Spec.ServiceAccountName
	if saName == "" {
		saName = "default"
	}
	
	sa, err := s.clientset.CoreV1().ServiceAccounts(namespace).Get(ctx, saName, metav1.GetOptions{})
	if err == nil {
		topology.ServiceAccount = s.service.buildServiceAccountRef(sa)
		
		// Fetch RBAC resources related to the ServiceAccount
		// Fetch RoleBindings
		roleBindings, err := s.clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, rb := range roleBindings.Items {
				for _, subject := range rb.Subjects {
					if subject.Kind == "ServiceAccount" && subject.Name == saName && subject.Namespace == namespace {
						topology.RoleBindings = append(topology.RoleBindings, s.service.buildRoleBindingRef(&rb))
						
						// Fetch the associated Role
						if rb.RoleRef.Kind == "Role" {
							role, err := s.clientset.RbacV1().Roles(namespace).Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
							if err == nil {
								topology.Roles = append(topology.Roles, s.service.buildRoleRef(role))
							}
						}
						break
					}
				}
			}
		}
		
		// Fetch ClusterRoleBindings
		clusterRoleBindings, err := s.clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, crb := range clusterRoleBindings.Items {
				for _, subject := range crb.Subjects {
					if subject.Kind == "ServiceAccount" && subject.Name == saName && subject.Namespace == namespace {
						topology.ClusterRoleBindings = append(topology.ClusterRoleBindings, s.service.buildClusterRoleBindingRef(&crb))
						
						// Fetch the associated ClusterRole
						if crb.RoleRef.Kind == "ClusterRole" {
							clusterRole, err := s.clientset.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
							if err == nil {
								topology.ClusterRoles = append(topology.ClusterRoles, s.service.buildClusterRoleRef(clusterRole))
							}
						}
						break
					}
				}
			}
		}
	}

	return topology, nil
}

// ListCronJobs lists all CronJobs in a namespace
func (s *CronJobService) ListCronJobs(ctx context.Context, namespace string) (*ListCronJobsResponse, error) {
	cronJobs, err := s.clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list cronjobs: %w", err)
	}

	response := &ListCronJobsResponse{
		CronJobs: make([]CronJobSummary, 0, len(cronJobs.Items)),
	}

	for _, cj := range cronJobs.Items {
		// Count active jobs
		activeCount := len(cj.Status.Active)
		
		// Calculate next schedule time using proper cron parsing
		var nextScheduleTime *time.Time
		if cj.Spec.Suspend == nil || !*cj.Spec.Suspend {
			// CronJob is not suspended, calculate next run time
			next, err := calculateNextScheduleTime(cj.Spec.Schedule, nil)
			if err != nil {
				log.Printf("Failed to calculate next schedule time for %s: %v", cj.Name, err)
			} else {
				nextScheduleTime = next
			}
		}

		// Handle LastScheduleTime safely
		var lastScheduleTime *time.Time
		if cj.Status.LastScheduleTime != nil {
			lastScheduleTime = &cj.Status.LastScheduleTime.Time
		}
		
		response.CronJobs = append(response.CronJobs, CronJobSummary{
			Name:             cj.Name,
			Namespace:        cj.Namespace,
			Schedule:         cj.Spec.Schedule,
			Suspend:          cj.Spec.Suspend,
			Active:           activeCount,
			LastScheduleTime: lastScheduleTime,
			NextScheduleTime: nextScheduleTime,
		})
	}

	return response, nil
}

// buildCronJobInfo builds CronJobInfo from a k8s CronJob
func (s *CronJobService) buildCronJobInfo(cj *batchv1.CronJob) CronJobInfo {
	info := CronJobInfo{
		Name:                       cj.Name,
		Namespace:                  cj.Namespace,
		Labels:                     cj.Labels,
		Annotations:                cj.Annotations,
		CreationTimestamp:          &cj.CreationTimestamp.Time,
		Schedule:                   cj.Spec.Schedule,
		Suspend:                    cj.Spec.Suspend,
		StartingDeadlineSeconds:    cj.Spec.StartingDeadlineSeconds,
		ConcurrencyPolicy:          string(cj.Spec.ConcurrencyPolicy),
		SuccessfulJobsHistoryLimit: cj.Spec.SuccessfulJobsHistoryLimit,
		FailedJobsHistoryLimit:     cj.Spec.FailedJobsHistoryLimit,
	}

	// Set schedule times
	if cj.Status.LastScheduleTime != nil {
		info.LastScheduleTime = &cj.Status.LastScheduleTime.Time
	}
	if cj.Status.LastSuccessfulTime != nil {
		info.LastSuccessfulTime = &cj.Status.LastSuccessfulTime.Time
	}

	// Build active job references
	for _, activeJob := range cj.Status.Active {
		// We'll fetch full job details in getJobsForCronJob
		info.Active = append(info.Active, JobRef{
			Name:      activeJob.Name,
			Namespace: activeJob.Namespace,
		})
	}

	// Determine status
	if cj.Spec.Suspend != nil && *cj.Spec.Suspend {
		info.Status = StatusWarning // Suspended
	} else if len(cj.Status.Active) > 0 {
		info.Status = StatusHealthy // Active jobs running
	} else if cj.Status.LastScheduleTime != nil {
		info.Status = StatusHealthy // Has run before
	} else {
		info.Status = StatusUnknown // Never run
	}

	// Calculate next schedule time using proper cron parsing
	if cj.Spec.Suspend == nil || !*cj.Spec.Suspend {
		next, err := calculateNextScheduleTime(cj.Spec.Schedule, nil)
		if err != nil {
			log.Printf("Failed to calculate next schedule time for %s: %v", cj.Name, err)
		} else {
			info.NextScheduleTime = next
		}
	}

	return info
}

// buildJobRef builds JobRef from a k8s Job
func (s *CronJobService) buildJobRef(job *batchv1.Job) JobRef {
	ref := JobRef{
		Name:         job.Name,
		Namespace:    job.Namespace,
		Active:       job.Status.Active,
		Succeeded:    job.Status.Succeeded,
		Failed:       job.Status.Failed,
		Completions:  job.Spec.Completions,
		Parallelism:  job.Spec.Parallelism,
		BackoffLimit: job.Spec.BackoffLimit,
	}

	if job.Status.StartTime != nil {
		ref.StartTime = &job.Status.StartTime.Time
	}
	if job.Status.CompletionTime != nil {
		ref.CompletionTime = &job.Status.CompletionTime.Time
	}

	// Determine job status
	if job.Status.Succeeded > 0 {
		ref.Status = StatusHealthy
	} else if job.Status.Failed > 0 {
		ref.Status = StatusError
	} else if job.Status.Active > 0 {
		ref.Status = StatusWarning
	} else {
		ref.Status = StatusUnknown
	}

	return ref
}

// getJobsForCronJob gets Jobs created by a CronJob
func (s *CronJobService) getJobsForCronJob(ctx context.Context, namespace string, cj *batchv1.CronJob) ([]batchv1.Job, error) {
	// List all jobs in namespace
	jobs, err := s.clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var ownedJobs []batchv1.Job
	for _, job := range jobs.Items {
		// Check if this job is owned by the CronJob
		for _, owner := range job.OwnerReferences {
			if owner.Kind == "CronJob" && owner.Name == cj.Name && owner.UID == cj.UID {
				ownedJobs = append(ownedJobs, job)
				break
			}
		}
	}

	log.Printf("Found %d jobs for CronJob %s/%s", len(ownedJobs), namespace, cj.Name)
	return ownedJobs, nil
}

// getPodsForJob gets pods owned by a Job
func (s *CronJobService) getPodsForJob(ctx context.Context, namespace string, job *batchv1.Job) ([]corev1.Pod, error) {
	// Get the selector from the Job
	selector, err := metav1.LabelSelectorAsSelector(job.Spec.Selector)
	if err != nil {
		return nil, err
	}

	// List pods with the selector
	pods, err := s.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err != nil {
		return nil, err
	}

	// Filter pods that are owned by this Job
	var ownedPods []corev1.Pod
	for _, pod := range pods.Items {
		if owner := metav1.GetControllerOf(&pod); owner != nil && owner.UID == job.UID {
			ownedPods = append(ownedPods, pod)
		}
	}

	return ownedPods, nil
}

// getServicesForCronJob gets services that might select pods from CronJob's jobs
func (s *CronJobService) getServicesForCronJob(ctx context.Context, namespace string, cj *batchv1.CronJob) ([]corev1.Service, error) {
	// Get the pod labels from the CronJob's job template
	podLabels := cj.Spec.JobTemplate.Spec.Template.Labels
	if len(podLabels) == 0 {
		return nil, nil
	}

	// List all services in the namespace
	services, err := s.clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var matchingServices []corev1.Service
	for _, svc := range services.Items {
		if s.service.selectorMatches(svc.Spec.Selector, podLabels) {
			matchingServices = append(matchingServices, svc)
		}
	}

	return matchingServices, nil
}

// getAllSecretsAndConfigMapsForCronJob gets all secrets and configmaps referenced by a CronJob
func (s *CronJobService) getAllSecretsAndConfigMapsForCronJob(ctx context.Context, namespace string, cj *batchv1.CronJob) ([]SecretRef, []ConfigMapRef) {
	var secrets []SecretRef
	var configMaps []ConfigMapRef
	
	secretNames := make(map[string]bool)
	configMapNames := make(map[string]bool)
	secretKeys := make(map[string]map[string]bool)    // secretName -> keys used
	configMapKeys := make(map[string]map[string]bool) // configMapName -> keys used
	
	// Check volumes in the CronJob's job template spec
	for _, vol := range cj.Spec.JobTemplate.Spec.Template.Spec.Volumes {
		if vol.Secret != nil {
			secretNames[vol.Secret.SecretName] = true
		}
		if vol.ConfigMap != nil {
			configMapNames[vol.ConfigMap.Name] = true
		}
	}
	
	// Check env variables in containers
	for _, container := range cj.Spec.JobTemplate.Spec.Template.Spec.Containers {
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if env.ValueFrom.SecretKeyRef != nil {
					secretName := env.ValueFrom.SecretKeyRef.Name
					secretNames[secretName] = true
					// Track which key is being used
					if secretKeys[secretName] == nil {
						secretKeys[secretName] = make(map[string]bool)
					}
					secretKeys[secretName][env.ValueFrom.SecretKeyRef.Key] = true
				}
				if env.ValueFrom.ConfigMapKeyRef != nil {
					cmName := env.ValueFrom.ConfigMapKeyRef.Name
					configMapNames[cmName] = true
					// Track which key is being used
					if configMapKeys[cmName] == nil {
						configMapKeys[cmName] = make(map[string]bool)
					}
					configMapKeys[cmName][env.ValueFrom.ConfigMapKeyRef.Key] = true
				}
			}
		}
		
		// Check envFrom
		for _, envFrom := range container.EnvFrom {
			if envFrom.SecretRef != nil {
				secretNames[envFrom.SecretRef.Name] = true
			}
			if envFrom.ConfigMapRef != nil {
				configMapNames[envFrom.ConfigMapRef.Name] = true
			}
		}
	}
	
	// Fetch secrets with full metadata and mount information
	for name := range secretNames {
		secret, err := s.clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
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
			
			// Add keys that are specifically used
			if keysUsed, exists := secretKeys[name]; exists {
				for key := range keysUsed {
					secretRef.KeysUsed = append(secretRef.KeysUsed, key)
				}
			}
			
			// Check if this secret is mounted in the CronJob
			mountedAt := s.checkIfMountedInCronJob(secret.Name, "secret", cj)
			if len(mountedAt) > 0 {
				secretRef.MountedAt = mountedAt
			}
			
			secrets = append(secrets, secretRef)
		}
	}
	
	// Fetch configmaps with full metadata and mount information
	for name := range configMapNames {
		cm, err := s.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
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
			
			// Add keys that are specifically used
			if keysUsed, exists := configMapKeys[name]; exists {
				for key := range keysUsed {
					configMapRef.KeysUsed = append(configMapRef.KeysUsed, key)
				}
			}
			
			// Check if this configmap is mounted in the CronJob
			mountedAt := s.checkIfMountedInCronJob(cm.Name, "configmap", cj)
			if len(mountedAt) > 0 {
				configMapRef.MountedAt = mountedAt
			}
			
			configMaps = append(configMaps, configMapRef)
		}
	}
	
	return secrets, configMaps
}

// checkIfMountedInCronJob checks if a ConfigMap or Secret is mounted in CronJob's job template
func (s *CronJobService) checkIfMountedInCronJob(name string, resourceType string, cj *batchv1.CronJob) []string {
	var mountedAt []string
	volumeNameMap := make(map[string]string)
	
	// First, find volumes that use this secret/configmap in the job template
	for _, volume := range cj.Spec.JobTemplate.Spec.Template.Spec.Volumes {
		if resourceType == "secret" && volume.Secret != nil && volume.Secret.SecretName == name {
			volumeNameMap[volume.Name] = fmt.Sprintf("volume:%s", volume.Name)
			fmt.Printf("Found secret volume %s using secret %s\n", volume.Name, name)
		}
		if resourceType == "configmap" && volume.ConfigMap != nil && volume.ConfigMap.Name == name {
			volumeNameMap[volume.Name] = fmt.Sprintf("volume:%s", volume.Name)
			fmt.Printf("Found configmap volume %s using configmap %s\n", volume.Name, name)
		}
	}
	
	hasVolumeMounts := false
	
	// Check where these volumes are mounted in containers
	for _, container := range cj.Spec.JobTemplate.Spec.Template.Spec.Containers {
		fmt.Printf("Checking container %s for volume mounts\n", container.Name)
		for _, volumeMount := range container.VolumeMounts {
			fmt.Printf("  Container %s has volumeMount %s at %s\n", container.Name, volumeMount.Name, volumeMount.MountPath)
			if _, exists := volumeNameMap[volumeMount.Name]; exists {
				// Format: container-name:mount-path
				mountPath := fmt.Sprintf("%s:%s", container.Name, volumeMount.MountPath)
				mountedAt = append(mountedAt, mountPath)
				hasVolumeMounts = true
				fmt.Printf("  -> Matched! Adding mount path: %s\n", mountPath)
			}
		}
		
		// Also check environment variables
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
					// Format: container-name:env:ENV_NAME:key:KEY_NAME
					envPath := fmt.Sprintf("%s:env:%s:key:%s", container.Name, env.Name, env.ValueFrom.SecretKeyRef.Key)
					mountedAt = append(mountedAt, envPath)
				}
				if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
					// Format: container-name:env:ENV_NAME:key:KEY_NAME
					envPath := fmt.Sprintf("%s:env:%s:key:%s", container.Name, env.Name, env.ValueFrom.ConfigMapKeyRef.Key)
					mountedAt = append(mountedAt, envPath)
				}
			}
		}
		
		// Check envFrom for entire ConfigMap/Secret as environment variables
		for _, envFrom := range container.EnvFrom {
			if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
				envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
				mountedAt = append(mountedAt, envPath)
			}
			if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
				envPath := fmt.Sprintf("%s:envFrom:all", container.Name)
				mountedAt = append(mountedAt, envPath)
			}
		}
	}
	
	// Also check init containers
	for _, container := range cj.Spec.JobTemplate.Spec.Template.Spec.InitContainers {
		for _, volumeMount := range container.VolumeMounts {
			if _, exists := volumeNameMap[volumeMount.Name]; exists {
				// Format: container-name:mount-path (with init- prefix)
				mountPath := fmt.Sprintf("init-%s:%s", container.Name, volumeMount.MountPath)
				mountedAt = append(mountedAt, mountPath)
				hasVolumeMounts = true
			}
		}
		
		// Check environment variables in init containers
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
					envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
					mountedAt = append(mountedAt, envPath)
				}
				if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
					envPath := fmt.Sprintf("init-%s:env:%s", container.Name, env.Name)
					mountedAt = append(mountedAt, envPath)
				}
			}
		}
		
		// Check envFrom in init containers
		for _, envFrom := range container.EnvFrom {
			if resourceType == "secret" && envFrom.SecretRef != nil && envFrom.SecretRef.Name == name {
				envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
				mountedAt = append(mountedAt, envPath)
			}
			if resourceType == "configmap" && envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == name {
				envPath := fmt.Sprintf("init-%s:envFrom:all", container.Name)
				mountedAt = append(mountedAt, envPath)
			}
		}
	}
	
	// If volumes are defined but not mounted anywhere, report them as defined
	if !hasVolumeMounts && len(volumeNameMap) > 0 {
		for volumeName := range volumeNameMap {
			definedPath := fmt.Sprintf("defined-as-volume:%s", volumeName)
			mountedAt = append(mountedAt, definedPath)
		}
	}
	
	return mountedAt
}