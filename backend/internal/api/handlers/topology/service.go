package topology

import (
	"context"
	"fmt"
	"log"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Service handles topology operations
type Service struct {
	clientset kubernetes.Interface
}

// NewService creates a new topology service
func NewService(clientset kubernetes.Interface) *Service {
	return &Service{
		clientset: clientset,
	}
}

// GetDeploymentTopology fetches the complete topology for a deployment
func (s *Service) GetDeploymentTopology(ctx context.Context, namespace, deploymentName string) (*DeploymentTopology, error) {
	// Fetch the deployment
	deployment, err := s.clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment: %w", err)
	}

	topology := &DeploymentTopology{
		Namespace:  namespace,
		Deployment: s.buildDeploymentInfo(deployment),
	}

	// Fetch related ReplicaSets
	replicaSets, err := s.getRelatedReplicaSets(ctx, namespace, deployment)
	if err != nil {
		return nil, fmt.Errorf("failed to get replicasets: %w", err)
	}

	// OPTIMIZATION: Fetch all pods in the namespace once, then filter locally
	// This reduces API calls from N (number of ReplicaSets) to 1
	allPods, err := s.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pods: %w", err)
	}
	
	// Create a map of ReplicaSet UID to pods for efficient lookup
	rsPodMap := make(map[string][]corev1.Pod)
	for _, pod := range allPods.Items {
		if owner := metav1.GetControllerOf(&pod); owner != nil && owner.Kind == "ReplicaSet" {
			rsPodMap[string(owner.UID)] = append(rsPodMap[string(owner.UID)], pod)
		}
	}

	// Build ReplicaSet references with their pods
	for _, rs := range replicaSets {
		rsRef := s.buildReplicaSetRef(&rs)
		
		// Get pods for this ReplicaSet from our pre-fetched map
		if pods, exists := rsPodMap[string(rs.UID)]; exists {
			for _, pod := range pods {
				rsRef.Pods = append(rsRef.Pods, s.buildPodRef(&pod))
			}
		}
		
		topology.ReplicaSets = append(topology.ReplicaSets, rsRef)
	}

	// Fetch Services that might select these pods
	services, err := s.getServicesForDeployment(ctx, namespace, deployment)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}
	
	for _, svc := range services {
		topology.Services = append(topology.Services, s.buildServiceRef(&svc))
	}

	// Fetch Secrets and ConfigMaps mounted by the pods
	// Get all secrets and configmaps in the namespace, not just mounted ones
	secrets, configMaps := s.getAllSecretsAndConfigMaps(ctx, namespace, deployment)
	fmt.Printf("Found %d secrets and %d configmaps in namespace %s\n", len(secrets), len(configMaps), namespace)
	for i, secret := range secrets {
		fmt.Printf("Secret %d: %s\n", i, secret.Name)
	}
	topology.Secrets = secrets
	topology.ConfigMaps = configMaps

	// Fetch ServiceAccount
	saName := deployment.Spec.Template.Spec.ServiceAccountName
	if saName == "" {
		saName = "default"
	}
	sa, err := s.clientset.CoreV1().ServiceAccounts(namespace).Get(
		ctx, saName, metav1.GetOptions{},
	)
	if err == nil {
		topology.ServiceAccount = s.buildServiceAccountRef(sa)
	}

	// Fetch Endpoints for services
	fmt.Printf("Fetching endpoints for %d services\n", len(services))
	for _, svc := range services {
		endpoints, err := s.clientset.CoreV1().Endpoints(namespace).Get(ctx, svc.Name, metav1.GetOptions{})
		if err == nil {
			fmt.Printf("Found endpoints for service %s with %d subsets\n", svc.Name, len(endpoints.Subsets))
			topology.Endpoints = append(topology.Endpoints, s.buildEndpointsRef(endpoints))
		} else {
			fmt.Printf("No endpoints found for service %s: %v\n", svc.Name, err)
		}
	}
	fmt.Printf("Total endpoints collected: %d\n", len(topology.Endpoints))

	// Fetch RBAC resources related to the ServiceAccount
	if saName != "" {
		fmt.Printf("Fetching RBAC resources for ServiceAccount: %s in namespace: %s\n", saName, namespace)
		
		// Fetch RoleBindings
		roleBindings, err := s.clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			fmt.Printf("Found %d RoleBindings in namespace %s\n", len(roleBindings.Items), namespace)
			for _, rb := range roleBindings.Items {
				for _, subject := range rb.Subjects {
					if subject.Kind == "ServiceAccount" && subject.Name == saName && subject.Namespace == namespace {
						fmt.Printf("Found RoleBinding %s for ServiceAccount %s\n", rb.Name, saName)
						topology.RoleBindings = append(topology.RoleBindings, s.buildRoleBindingRef(&rb))
						
						// Fetch the associated Role
						if rb.RoleRef.Kind == "Role" {
							role, err := s.clientset.RbacV1().Roles(namespace).Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
							if err == nil {
								fmt.Printf("Found Role %s associated with RoleBinding %s\n", role.Name, rb.Name)
								topology.Roles = append(topology.Roles, s.buildRoleRef(role))
							} else {
								fmt.Printf("Error fetching Role %s: %v\n", rb.RoleRef.Name, err)
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
			fmt.Printf("Found %d ClusterRoleBindings\n", len(clusterRoleBindings.Items))
			for _, crb := range clusterRoleBindings.Items {
				for _, subject := range crb.Subjects {
					if subject.Kind == "ServiceAccount" && subject.Name == saName && subject.Namespace == namespace {
						fmt.Printf("Found ClusterRoleBinding %s for ServiceAccount %s/%s\n", crb.Name, namespace, saName)
						topology.ClusterRoleBindings = append(topology.ClusterRoleBindings, s.buildClusterRoleBindingRef(&crb))
						
						// Fetch the associated ClusterRole
						if crb.RoleRef.Kind == "ClusterRole" {
							clusterRole, err := s.clientset.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
							if err == nil {
								fmt.Printf("Found ClusterRole %s associated with ClusterRoleBinding %s\n", clusterRole.Name, crb.Name)
								topology.ClusterRoles = append(topology.ClusterRoles, s.buildClusterRoleRef(clusterRole))
							} else {
								fmt.Printf("Error fetching ClusterRole %s: %v\n", crb.RoleRef.Name, err)
							}
						}
						break
					}
				}
			}
		} else {
			fmt.Printf("Error fetching ClusterRoleBindings: %v\n", err)
		}
		
		fmt.Printf("RBAC Summary - Roles: %d, RoleBindings: %d, ClusterRoles: %d, ClusterRoleBindings: %d\n", 
			len(topology.Roles), len(topology.RoleBindings), 
			len(topology.ClusterRoles), len(topology.ClusterRoleBindings))
	}

	return topology, nil
}

// ListDeployments lists all deployments in a namespace
func (s *Service) ListDeployments(ctx context.Context, namespace string) ([]DeploymentSummary, error) {
	var deployments []DeploymentSummary
	
	// If namespace is empty, list all namespaces
	if namespace == "" {
		namespaces, err := s.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list namespaces: %w", err)
		}
		
		for _, ns := range namespaces.Items {
			deploys, err := s.clientset.AppsV1().Deployments(ns.Name).List(ctx, metav1.ListOptions{})
			if err != nil {
				continue
			}
			
			for _, d := range deploys.Items {
				deployments = append(deployments, DeploymentSummary{
					Name:      d.Name,
					Namespace: d.Namespace,
					Replicas:  *d.Spec.Replicas,
					Ready:     d.Status.ReadyReplicas,
				})
			}
		}
	} else {
		deploys, err := s.clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list deployments: %w", err)
		}
		
		for _, d := range deploys.Items {
			deployments = append(deployments, DeploymentSummary{
				Name:      d.Name,
				Namespace: d.Namespace,
				Replicas:  *d.Spec.Replicas,
				Ready:     d.Status.ReadyReplicas,
			})
		}
	}
	
	return deployments, nil
}

// Helper functions

func (s *Service) buildDeploymentInfo(deployment *appsv1.Deployment) DeploymentInfo {
	info := DeploymentInfo{
		Name:              deployment.Name,
		Replicas:          *deployment.Spec.Replicas,
		Available:         deployment.Status.AvailableReplicas,
		Ready:             deployment.Status.ReadyReplicas,
		Updated:           deployment.Status.UpdatedReplicas,
		Labels:            deployment.Labels,
		Status:            s.getDeploymentStatus(deployment),
		CreationTimestamp: &deployment.CreationTimestamp.Time,
	}
	
	if deployment.Spec.Strategy.Type != "" {
		info.Strategy = string(deployment.Spec.Strategy.Type)
	}
	
	// Add conditions
	for _, cond := range deployment.Status.Conditions {
		info.Conditions = append(info.Conditions, Condition{
			Type:    string(cond.Type),
			Status:  string(cond.Status),
			Reason:  cond.Reason,
			Message: cond.Message,
		})
	}
	
	return info
}

func (s *Service) getDeploymentStatus(deployment *appsv1.Deployment) K8sStatus {
	if deployment.Status.ReadyReplicas == *deployment.Spec.Replicas {
		return StatusHealthy
	}
	if deployment.Status.ReadyReplicas == 0 {
		return StatusError
	}
	if deployment.Status.ReadyReplicas < *deployment.Spec.Replicas {
		return StatusWarning
	}
	return StatusUnknown
}

func (s *Service) buildReplicaSetRef(rs *appsv1.ReplicaSet) ReplicaSetRef {
	return ReplicaSetRef{
		Name:              rs.Name,
		Desired:           *rs.Spec.Replicas,
		Ready:             rs.Status.ReadyReplicas,
		Available:         rs.Status.AvailableReplicas,
		Generation:        rs.Generation,
		CreationTimestamp: &rs.CreationTimestamp.Time,
		Pods:              []PodRef{},
	}
}

func (s *Service) buildPodRef(pod *corev1.Pod) PodRef {
	podRef := PodRef{
		Name:      pod.Name,
		Phase:     s.getPodPhase(pod),
		NodeName: pod.Spec.NodeName,
		HostIP:   pod.Status.HostIP,
		PodIP:    pod.Status.PodIP,
		Labels:   pod.Labels,
	}
	
	// Add owner references
	for _, owner := range pod.OwnerReferences {
		podRef.OwnerReferences = append(podRef.OwnerReferences, OwnerReference{
			Kind: owner.Kind,
			Name: owner.Name,
		})
	}
	
	// Add start time if available
	if pod.Status.StartTime != nil {
		startTime := pod.Status.StartTime.Time
		podRef.StartTime = &startTime
	}
	
	// QoS Class
	if pod.Status.QOSClass != "" {
		podRef.QosClass = string(pod.Status.QOSClass)
	}
	
	// Build container references
	for _, container := range pod.Spec.Containers {
		containerRef := ContainerRef{
			Name:  container.Name,
			Image: container.Image,
		}
		
		// Add resource requirements
		if container.Resources.Limits != nil || container.Resources.Requests != nil {
			containerRef.Resources = &ResourceRequirements{}
			
			if container.Resources.Requests != nil {
				containerRef.Resources.Requests = ResourceList{}
				if cpu := container.Resources.Requests.Cpu(); cpu != nil {
					containerRef.Resources.Requests.CPU = cpu.String()
				}
				if mem := container.Resources.Requests.Memory(); mem != nil {
					containerRef.Resources.Requests.Memory = mem.String()
				}
			}
			
			if container.Resources.Limits != nil {
				containerRef.Resources.Limits = ResourceList{}
				if cpu := container.Resources.Limits.Cpu(); cpu != nil {
					containerRef.Resources.Limits.CPU = cpu.String()
				}
				if mem := container.Resources.Limits.Memory(); mem != nil {
					containerRef.Resources.Limits.Memory = mem.String()
				}
			}
		}
		
		// Add ports
		for _, port := range container.Ports {
			containerRef.Ports = append(containerRef.Ports, ContainerPort{
				Name:          port.Name,
				ContainerPort: port.ContainerPort,
				Protocol:      string(port.Protocol),
			})
		}
		
		// Add volume mounts
		for _, mount := range container.VolumeMounts {
			containerRef.Mounts = append(containerRef.Mounts, mount.MountPath)
		}
		
		// Find container status
		for _, status := range pod.Status.ContainerStatuses {
			if status.Name == container.Name {
				containerRef.Ready = status.Ready
				containerRef.RestartCount = status.RestartCount
				
				if status.State.Running != nil {
					containerRef.State = "running"
					containerRef.StartTime = &status.State.Running.StartedAt.Time
				} else if status.State.Waiting != nil {
					containerRef.State = "waiting"
					containerRef.Reason = status.State.Waiting.Reason
				} else if status.State.Terminated != nil {
					containerRef.State = "terminated"
					containerRef.Reason = status.State.Terminated.Reason
					containerRef.StartTime = &status.State.Terminated.StartedAt.Time
				}
				break
			}
		}
		
		podRef.Containers = append(podRef.Containers, containerRef)
	}
	
	return podRef
}

func (s *Service) getPodPhase(pod *corev1.Pod) PodPhase {
	// Check for deletion
	if pod.DeletionTimestamp != nil {
		return PodTerminating
	}
	
	// Check container statuses for CrashLoopBackOff
	for _, status := range pod.Status.ContainerStatuses {
		if status.State.Waiting != nil && status.State.Waiting.Reason == "CrashLoopBackOff" {
			return PodCrashLoopBackOff
		}
	}
	
	switch pod.Status.Phase {
	case corev1.PodPending:
		return PodPending
	case corev1.PodRunning:
		return PodRunning
	case corev1.PodSucceeded:
		return PodSucceeded
	case corev1.PodFailed:
		return PodFailed
	default:
		return PodUnknown
	}
}

func (s *Service) buildServiceRef(svc *corev1.Service) ServiceRef {
	ref := ServiceRef{
		Name:              svc.Name,
		Type:              string(svc.Spec.Type),
		ClusterIP:         svc.Spec.ClusterIP,
		ExternalIPs:       svc.Spec.ExternalIPs,
		Selector:          svc.Spec.Selector,
		CreationTimestamp: &svc.CreationTimestamp.Time,
		Ports:             []ServicePort{},
	}
	
	for _, port := range svc.Spec.Ports {
		servicePort := ServicePort{
			Name:     port.Name,
			Port:     port.Port,
			Protocol: string(port.Protocol),
		}
		
		if port.TargetPort.IntVal != 0 {
			servicePort.TargetPort = fmt.Sprintf("%d", port.TargetPort.IntVal)
		} else {
			servicePort.TargetPort = port.TargetPort.StrVal
		}
		
		if port.NodePort != 0 {
			servicePort.NodePort = port.NodePort
		}
		
		ref.Ports = append(ref.Ports, servicePort)
	}
	
	return ref
}

func (s *Service) buildServiceAccountRef(sa *corev1.ServiceAccount) *ServiceAccountRef {
	ref := &ServiceAccountRef{
		Name:                         sa.Name,
		AutomountServiceAccountToken: sa.AutomountServiceAccountToken,
		Secrets:                      []string{},
	}
	
	for _, secret := range sa.Secrets {
		ref.Secrets = append(ref.Secrets, secret.Name)
	}
	
	return ref
}

func (s *Service) getRelatedReplicaSets(ctx context.Context, namespace string, deployment *appsv1.Deployment) ([]appsv1.ReplicaSet, error) {
	allRS, err := s.clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	
	var relatedRS []appsv1.ReplicaSet
	var currentRS *appsv1.ReplicaSet
	var previousRSList []appsv1.ReplicaSet
	
	// First pass: categorize ReplicaSets
	for _, rs := range allRS.Items {
		// Check if this ReplicaSet belongs to the deployment
		if owner := metav1.GetControllerOf(&rs); owner != nil && owner.UID == deployment.UID {
			// Check if this is the current ReplicaSet (has desired replicas > 0)
			if rs.Spec.Replicas != nil && *rs.Spec.Replicas > 0 {
				currentRS = &rs
			} else {
				// This is a previous ReplicaSet (scaled down)
				previousRSList = append(previousRSList, rs)
			}
		}
	}
	
	// Add current ReplicaSet if exists
	if currentRS != nil {
		relatedRS = append(relatedRS, *currentRS)
	}
	
	// Sort previous ReplicaSets by creation time (newest first)
	if len(previousRSList) > 0 {
		// Sort by creation timestamp in descending order (newest first)
		for i := 0; i < len(previousRSList)-1; i++ {
			for j := i + 1; j < len(previousRSList); j++ {
				if previousRSList[j].CreationTimestamp.After(previousRSList[i].CreationTimestamp.Time) {
					previousRSList[i], previousRSList[j] = previousRSList[j], previousRSList[i]
				}
			}
		}
		
		// Add only the most recent previous ReplicaSet
		relatedRS = append(relatedRS, previousRSList[0])
	}
	
	// Log what we're returning
	log.Printf("Returning %d ReplicaSets for deployment %s (1 current, %d previous)", 
		len(relatedRS), deployment.Name, len(relatedRS)-1)
	for _, rs := range relatedRS {
		replicas := int32(0)
		if rs.Spec.Replicas != nil {
			replicas = *rs.Spec.Replicas
		}
		log.Printf("  - ReplicaSet %s: %d desired, %d ready", rs.Name, replicas, rs.Status.ReadyReplicas)
	}
	
	return relatedRS, nil
}

func (s *Service) getPodsForReplicaSet(ctx context.Context, namespace string, rs *appsv1.ReplicaSet) ([]corev1.Pod, error) {
	// Get the selector from the ReplicaSet
	selector, err := metav1.LabelSelectorAsSelector(rs.Spec.Selector)
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
	
	// Filter pods that are owned by this ReplicaSet
	var ownedPods []corev1.Pod
	for _, pod := range pods.Items {
		if owner := metav1.GetControllerOf(&pod); owner != nil && owner.UID == rs.UID {
			ownedPods = append(ownedPods, pod)
		}
	}
	
	return ownedPods, nil
}

func (s *Service) getServicesForDeployment(ctx context.Context, namespace string, deployment *appsv1.Deployment) ([]corev1.Service, error) {
	// Get all services in the namespace
	services, err := s.clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	
	// Filter services that select pods from this deployment
	var matchingServices []corev1.Service
	deploymentLabels := deployment.Spec.Template.Labels
	
	for _, svc := range services.Items {
		if s.selectorMatches(svc.Spec.Selector, deploymentLabels) {
			matchingServices = append(matchingServices, svc)
		}
	}
	
	return matchingServices, nil
}

func (s *Service) selectorMatches(selector, labels map[string]string) bool {
	if len(selector) == 0 {
		return false
	}
	
	for key, value := range selector {
		if labelValue, exists := labels[key]; !exists || labelValue != value {
			return false
		}
	}
	
	return true
}

func (s *Service) getAllSecretsAndConfigMaps(ctx context.Context, namespace string, deployment *appsv1.Deployment) ([]SecretRef, []ConfigMapRef) {
	var secrets []SecretRef
	var configMaps []ConfigMapRef
	
	// Collect names of secrets and configmaps actually used by the deployment
	secretNames := make(map[string]bool)
	configMapNames := make(map[string]bool)
	
	// Check volumes in the deployment pod spec
	for _, vol := range deployment.Spec.Template.Spec.Volumes {
		if vol.Secret != nil {
			secretNames[vol.Secret.SecretName] = true
		}
		if vol.ConfigMap != nil {
			configMapNames[vol.ConfigMap.Name] = true
		}
		if vol.Projected != nil {
			for _, source := range vol.Projected.Sources {
				if source.Secret != nil {
					secretNames[source.Secret.Name] = true
				}
				if source.ConfigMap != nil {
					configMapNames[source.ConfigMap.Name] = true
				}
			}
		}
	}
	
	// Check env variables in containers
	for _, container := range deployment.Spec.Template.Spec.Containers {
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if env.ValueFrom.SecretKeyRef != nil {
					secretNames[env.ValueFrom.SecretKeyRef.Name] = true
				}
				if env.ValueFrom.ConfigMapKeyRef != nil {
					configMapNames[env.ValueFrom.ConfigMapKeyRef.Name] = true
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
	
	// Also check init containers
	for _, container := range deployment.Spec.Template.Spec.InitContainers {
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if env.ValueFrom.SecretKeyRef != nil {
					secretNames[env.ValueFrom.SecretKeyRef.Name] = true
				}
				if env.ValueFrom.ConfigMapKeyRef != nil {
					configMapNames[env.ValueFrom.ConfigMapKeyRef.Name] = true
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
	
	// Fetch only the referenced secrets
	for name := range secretNames {
		secret, err := s.clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			continue // Secret might not exist yet
		}
		
		secretRef := SecretRef{
			Name:              secret.Name,
			Type:              string(secret.Type),
			Immutable:         secret.Immutable != nil && *secret.Immutable,
			Data:              make(map[string]string),
			CreationTimestamp: &secret.CreationTimestamp.Time,
		}
		
		// Add data keys (just keys, not values for security)
		for key := range secret.Data {
			secretRef.Data[key] = "***" // Don't expose actual secret values
		}
		for key := range secret.StringData {
			secretRef.Data[key] = "***" // Don't expose actual secret values
		}
		
		// Check if this secret is mounted in the deployment
		mountedAt := s.checkIfMountedInDeployment(secret.Name, "secret", deployment)
		if len(mountedAt) > 0 {
			secretRef.MountedAt = mountedAt
		}
		
		secrets = append(secrets, secretRef)
	}
	
	// Fetch only the referenced configmaps
	for name := range configMapNames {
		cm, err := s.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			continue // ConfigMap might not exist yet
		}
		
		configMapRef := ConfigMapRef{
			Name:              cm.Name,
			Immutable:         cm.Immutable != nil && *cm.Immutable,
			Data:              make(map[string]string),
			CreationTimestamp: &cm.CreationTimestamp.Time,
		}
		
		// Add data keys
		for key := range cm.Data {
			configMapRef.Data[key] = cm.Data[key] // ConfigMap data is not sensitive
		}
		for key := range cm.BinaryData {
			configMapRef.Data[key+" (binary)"] = "***" // Don't expose binary data
		}
		
		// Check if this configmap is mounted in the deployment
		mountedAt := s.checkIfMountedInDeployment(cm.Name, "configmap", deployment)
		if len(mountedAt) > 0 {
			configMapRef.MountedAt = mountedAt
		}
		
		configMaps = append(configMaps, configMapRef)
	}
	
	return secrets, configMaps
}

func (s *Service) checkIfMountedInDeployment(name string, resourceType string, deployment *appsv1.Deployment) []string {
	var mountedAt []string
	volumeNameMap := make(map[string]bool)
	
	// First, find volumes that use this secret/configmap
	for _, volume := range deployment.Spec.Template.Spec.Volumes {
		if resourceType == "secret" && volume.Secret != nil && volume.Secret.SecretName == name {
			volumeNameMap[volume.Name] = true
		}
		if resourceType == "configmap" && volume.ConfigMap != nil && volume.ConfigMap.Name == name {
			volumeNameMap[volume.Name] = true
		}
	}
	
	// Check where these volumes are mounted in containers
	for _, container := range deployment.Spec.Template.Spec.Containers {
		for _, volumeMount := range container.VolumeMounts {
			if volumeNameMap[volumeMount.Name] {
				// Format: container-name:mount-path
				mountPath := fmt.Sprintf("%s:%s", container.Name, volumeMount.MountPath)
				mountedAt = append(mountedAt, mountPath)
			}
		}
		
		// Also check environment variables
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if resourceType == "secret" && env.ValueFrom.SecretKeyRef != nil && env.ValueFrom.SecretKeyRef.Name == name {
					// Format: container-name:env:ENV_NAME
					envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
					mountedAt = append(mountedAt, envPath)
				}
				if resourceType == "configmap" && env.ValueFrom.ConfigMapKeyRef != nil && env.ValueFrom.ConfigMapKeyRef.Name == name {
					// Format: container-name:env:ENV_NAME
					envPath := fmt.Sprintf("%s:env:%s", container.Name, env.Name)
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
	for _, container := range deployment.Spec.Template.Spec.InitContainers {
		for _, volumeMount := range container.VolumeMounts {
			if volumeNameMap[volumeMount.Name] {
				// Format: container-name:mount-path (with init- prefix)
				mountPath := fmt.Sprintf("init-%s:%s", container.Name, volumeMount.MountPath)
				mountedAt = append(mountedAt, mountPath)
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
	
	// Deduplicate the mountedAt array in case of duplicates
	seen := make(map[string]bool)
	var unique []string
	for _, path := range mountedAt {
		if !seen[path] {
			seen[path] = true
			unique = append(unique, path)
		}
	}
	
	return unique
}

func (s *Service) getVolumeMounts(ctx context.Context, namespace string, deployment *appsv1.Deployment) ([]SecretRef, []ConfigMapRef) {
	secretsMap := make(map[string]*SecretRef)
	configMapsMap := make(map[string]*ConfigMapRef)
	
	// Check volumes in the deployment spec
	for _, volume := range deployment.Spec.Template.Spec.Volumes {
		if volume.Secret != nil {
			if _, exists := secretsMap[volume.Secret.SecretName]; !exists {
				secretsMap[volume.Secret.SecretName] = &SecretRef{
					Name:      volume.Secret.SecretName,
					MountedAt: []string{},
				}
			}
		}
		
		if volume.ConfigMap != nil {
			if _, exists := configMapsMap[volume.ConfigMap.Name]; !exists {
				configMapsMap[volume.ConfigMap.Name] = &ConfigMapRef{
					Name:      volume.ConfigMap.Name,
					MountedAt: []string{},
				}
			}
		}
	}
	
	// Fetch actual Secret and ConfigMap objects
	for name, ref := range secretsMap {
		secret, err := s.clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ref.Type = string(secret.Type)
			ref.Immutable = secret.Immutable != nil && *secret.Immutable
		}
	}
	
	for name, ref := range configMapsMap {
		cm, err := s.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			ref.Immutable = cm.Immutable != nil && *cm.Immutable
			// Don't include actual data for security reasons, just keys
			if cm.Data != nil {
				ref.Data = make(map[string]string)
				for key := range cm.Data {
					ref.Data[key] = "***"
				}
			}
		}
	}
	
	// Convert maps to slices
	var secrets []SecretRef
	var configMaps []ConfigMapRef
	
	for _, ref := range secretsMap {
		secrets = append(secrets, *ref)
	}
	
	for _, ref := range configMapsMap {
		configMaps = append(configMaps, *ref)
	}
	
	return secrets, configMaps
}

// buildEndpointsRef builds an EndpointsRef from Kubernetes Endpoints
func (s *Service) buildEndpointsRef(endpoints *corev1.Endpoints) EndpointsRef {
	ref := EndpointsRef{
		Name:      endpoints.Name,
		Addresses: []EndpointAddress{},
		Ports:     []EndpointPort{},
	}
	
	// Build addresses
	for _, subset := range endpoints.Subsets {
		for _, addr := range subset.Addresses {
			address := EndpointAddress{
				IP:       addr.IP,
			}
			
			if addr.NodeName != nil {
				address.NodeName = *addr.NodeName
			}
			
			if addr.TargetRef != nil {
				address.TargetRef = &EndpointTargetRef{
					Kind:      addr.TargetRef.Kind,
					Name:      addr.TargetRef.Name,
					Namespace: addr.TargetRef.Namespace,
				}
			}
			
			ref.Addresses = append(ref.Addresses, address)
		}
		
		// Build ports
		for _, port := range subset.Ports {
			epPort := EndpointPort{
				Port:     port.Port,
				Protocol: string(port.Protocol),
			}
			if port.Name != "" {
				epPort.Name = port.Name
			}
			ref.Ports = append(ref.Ports, epPort)
		}
	}
	
	return ref
}

// buildRoleRef builds a RoleRef from Kubernetes Role
func (s *Service) buildRoleRef(role *rbacv1.Role) RoleRef {
	ref := RoleRef{
		Name:      role.Name,
		Namespace: role.Namespace,
		Rules:     []PolicyRule{},
	}
	
	for _, rule := range role.Rules {
		policyRule := PolicyRule{
			APIGroups:     rule.APIGroups,
			Resources:     rule.Resources,
			Verbs:         rule.Verbs,
			ResourceNames: rule.ResourceNames,
		}
		ref.Rules = append(ref.Rules, policyRule)
	}
	
	return ref
}

// buildClusterRoleRef builds a RoleRef from Kubernetes ClusterRole
func (s *Service) buildClusterRoleRef(role *rbacv1.ClusterRole) RoleRef {
	ref := RoleRef{
		Name:  role.Name,
		Rules: []PolicyRule{},
	}
	
	for _, rule := range role.Rules {
		policyRule := PolicyRule{
			APIGroups:     rule.APIGroups,
			Resources:     rule.Resources,
			Verbs:         rule.Verbs,
			ResourceNames: rule.ResourceNames,
		}
		ref.Rules = append(ref.Rules, policyRule)
	}
	
	return ref
}

// buildRoleBindingRef builds a RoleBindingRef from Kubernetes RoleBinding
func (s *Service) buildRoleBindingRef(rb *rbacv1.RoleBinding) RoleBindingRef {
	ref := RoleBindingRef{
		Name:      rb.Name,
		Namespace: rb.Namespace,
		RoleRef: RoleRefInfo{
			APIGroup: rb.RoleRef.APIGroup,
			Kind:     rb.RoleRef.Kind,
			Name:     rb.RoleRef.Name,
		},
		Subjects: []Subject{},
	}
	
	for _, subject := range rb.Subjects {
		ref.Subjects = append(ref.Subjects, Subject{
			Kind:      subject.Kind,
			Name:      subject.Name,
			Namespace: subject.Namespace,
		})
	}
	
	return ref
}

// buildClusterRoleBindingRef builds a RoleBindingRef from Kubernetes ClusterRoleBinding
func (s *Service) buildClusterRoleBindingRef(crb *rbacv1.ClusterRoleBinding) RoleBindingRef {
	ref := RoleBindingRef{
		Name: crb.Name,
		RoleRef: RoleRefInfo{
			APIGroup: crb.RoleRef.APIGroup,
			Kind:     crb.RoleRef.Kind,
			Name:     crb.RoleRef.Name,
		},
		Subjects: []Subject{},
	}
	
	for _, subject := range crb.Subjects {
		ref.Subjects = append(ref.Subjects, Subject{
			Kind:      subject.Kind,
			Name:      subject.Name,
			Namespace: subject.Namespace,
		})
	}
	
	return ref
}