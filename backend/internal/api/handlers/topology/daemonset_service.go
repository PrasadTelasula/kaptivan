package topology

import (
	"context"
	"fmt"
	"log"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetDaemonSetTopology retrieves the complete topology for a DaemonSet
func (s *Service) GetDaemonSetTopology(ctx context.Context, namespace, name string) (*DaemonSetTopology, error) {
	// Fetch the DaemonSet
	daemonSet, err := s.clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get daemonset: %w", err)
	}

	topology := &DaemonSetTopology{
		Namespace: namespace,
		DaemonSet: s.buildDaemonSetInfo(daemonSet),
	}

	// Fetch pods for this DaemonSet
	pods, err := s.getPodsForDaemonSet(ctx, namespace, daemonSet)
	if err != nil {
		return nil, fmt.Errorf("failed to get pods for daemonset %s: %w", daemonSet.Name, err)
	}

	for _, pod := range pods {
		topology.Pods = append(topology.Pods, s.buildPodRef(&pod))
	}

	// Fetch Services that might select these pods
	services, err := s.getServicesForDaemonSet(ctx, namespace, daemonSet)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}

	for _, svc := range services {
		topology.Services = append(topology.Services, s.buildServiceRef(&svc))
	}

	// Fetch Endpoints for services
	for _, svc := range services {
		endpoints, err := s.clientset.CoreV1().Endpoints(namespace).Get(ctx, svc.Name, metav1.GetOptions{})
		if err == nil {
			topology.Endpoints = append(topology.Endpoints, s.buildEndpointsRef(endpoints))
		}
	}

	// Fetch Secrets and ConfigMaps mounted by the pods
	secrets, configMaps := s.getAllSecretsAndConfigMapsForDaemonSet(ctx, namespace, daemonSet)
	topology.Secrets = secrets
	topology.ConfigMaps = configMaps

	// Fetch ServiceAccount
	saName := daemonSet.Spec.Template.Spec.ServiceAccountName
	if saName == "" {
		saName = "default"
	}
	
	sa, err := s.clientset.CoreV1().ServiceAccounts(namespace).Get(ctx, saName, metav1.GetOptions{})
	if err == nil {
		topology.ServiceAccount = s.buildServiceAccountRef(sa)
	}

	// Fetch RBAC resources (reuse existing RBAC fetch logic from service.go)
	// For now, leave empty as these are optional
	// TODO: Extract RBAC fetching into a shared method

	return topology, nil
}

// ListDaemonSets lists all DaemonSets in a namespace
func (s *Service) ListDaemonSets(ctx context.Context, namespace string) (*ListDaemonSetsResponse, error) {
	daemonSets, err := s.clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list daemonsets: %w", err)
	}

	response := &ListDaemonSetsResponse{
		DaemonSets: make([]DaemonSetSummary, 0, len(daemonSets.Items)),
	}

	for _, ds := range daemonSets.Items {
		response.DaemonSets = append(response.DaemonSets, DaemonSetSummary{
			Name:                   ds.Name,
			Namespace:              ds.Namespace,
			DesiredNumberScheduled: ds.Status.DesiredNumberScheduled,
			NumberReady:            ds.Status.NumberReady,
		})
	}

	return response, nil
}

// buildDaemonSetInfo builds DaemonSetInfo from a k8s DaemonSet
func (s *Service) buildDaemonSetInfo(ds *appsv1.DaemonSet) DaemonSetInfo {
	info := DaemonSetInfo{
		Name:                   ds.Name,
		DesiredNumberScheduled: ds.Status.DesiredNumberScheduled,
		CurrentNumberScheduled: ds.Status.CurrentNumberScheduled,
		NumberReady:            ds.Status.NumberReady,
		NumberAvailable:        ds.Status.NumberAvailable,
		NumberMisscheduled:     ds.Status.NumberMisscheduled,
		UpdatedNumberScheduled: ds.Status.UpdatedNumberScheduled,
		Labels:                 ds.Labels,
		NodeSelector:           ds.Spec.Template.Spec.NodeSelector,
		CreationTimestamp:      &ds.CreationTimestamp.Time,
	}

	// Determine status
	if ds.Status.NumberReady == ds.Status.DesiredNumberScheduled && ds.Status.DesiredNumberScheduled > 0 {
		info.Status = StatusHealthy
	} else if ds.Status.NumberReady > 0 {
		info.Status = StatusWarning
	} else {
		info.Status = StatusError
	}

	// Set update strategy
	if ds.Spec.UpdateStrategy.Type != "" {
		info.UpdateStrategy = string(ds.Spec.UpdateStrategy.Type)
	} else {
		info.UpdateStrategy = "RollingUpdate"
	}

	// Add conditions
	for _, cond := range ds.Status.Conditions {
		info.Conditions = append(info.Conditions, Condition{
			Type:    string(cond.Type),
			Status:  string(cond.Status),
			Reason:  cond.Reason,
			Message: cond.Message,
		})
	}

	return info
}

// getPodsForDaemonSet gets pods owned by a DaemonSet
func (s *Service) getPodsForDaemonSet(ctx context.Context, namespace string, ds *appsv1.DaemonSet) ([]corev1.Pod, error) {
	// Get the selector from the DaemonSet
	selector, err := metav1.LabelSelectorAsSelector(ds.Spec.Selector)
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

	// Filter pods that are owned by this DaemonSet
	var ownedPods []corev1.Pod
	for _, pod := range pods.Items {
		if owner := metav1.GetControllerOf(&pod); owner != nil && owner.UID == ds.UID {
			ownedPods = append(ownedPods, pod)
		}
	}

	log.Printf("Found %d pods for DaemonSet %s/%s", len(ownedPods), namespace, ds.Name)
	return ownedPods, nil
}

// getServicesForDaemonSet gets services that select pods from a DaemonSet
func (s *Service) getServicesForDaemonSet(ctx context.Context, namespace string, ds *appsv1.DaemonSet) ([]corev1.Service, error) {
	// Get the pod labels from the DaemonSet template
	podLabels := ds.Spec.Template.Labels
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
		if s.selectorMatches(svc.Spec.Selector, podLabels) {
			matchingServices = append(matchingServices, svc)
		}
	}

	return matchingServices, nil
}

// getAllSecretsAndConfigMapsForDaemonSet gets all secrets and configmaps referenced by a DaemonSet
func (s *Service) getAllSecretsAndConfigMapsForDaemonSet(ctx context.Context, namespace string, ds *appsv1.DaemonSet) ([]SecretRef, []ConfigMapRef) {
	var secrets []SecretRef
	var configMaps []ConfigMapRef
	
	secretNames := make(map[string]bool)
	configMapNames := make(map[string]bool)
	
	// Check volumes in the DaemonSet spec
	for _, vol := range ds.Spec.Template.Spec.Volumes {
		if vol.Secret != nil {
			secretNames[vol.Secret.SecretName] = true
		}
		if vol.ConfigMap != nil {
			configMapNames[vol.ConfigMap.Name] = true
		}
	}
	
	// Check env variables in containers
	for _, container := range ds.Spec.Template.Spec.Containers {
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
			
			// Check if this secret is mounted in the DaemonSet
			mountedAt := s.checkIfMountedInDaemonSet(secret.Name, "secret", ds)
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
			
			// Check if this configmap is mounted in the DaemonSet
			mountedAt := s.checkIfMountedInDaemonSet(cm.Name, "configmap", ds)
			if len(mountedAt) > 0 {
				configMapRef.MountedAt = mountedAt
			}
			
			configMaps = append(configMaps, configMapRef)
		}
	}
	
	return secrets, configMaps
}

// checkIfMountedInDaemonSet checks if a ConfigMap or Secret is mounted in DaemonSet
func (s *Service) checkIfMountedInDaemonSet(name string, resourceType string, ds *appsv1.DaemonSet) []string {
	var mountedAt []string
	volumeNameMap := make(map[string]bool)
	
	// First, find volumes that use this secret/configmap
	for _, volume := range ds.Spec.Template.Spec.Volumes {
		if resourceType == "secret" && volume.Secret != nil && volume.Secret.SecretName == name {
			volumeNameMap[volume.Name] = true
		}
		if resourceType == "configmap" && volume.ConfigMap != nil && volume.ConfigMap.Name == name {
			volumeNameMap[volume.Name] = true
		}
	}
	
	// Check where these volumes are mounted in containers
	for _, container := range ds.Spec.Template.Spec.Containers {
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
	for _, container := range ds.Spec.Template.Spec.InitContainers {
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
	
	return mountedAt
}

