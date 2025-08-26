package pods

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/yaml"
)

// TransformPodList transforms a Kubernetes PodList to our PodInfo format
func TransformPodList(podList *corev1.PodList) []PodInfo {
	var result []PodInfo
	
	for _, pod := range podList.Items {
		result = append(result, TransformPod(&pod))
	}
	
	return result
}

// TransformPod transforms a Kubernetes Pod to our PodInfo format
func TransformPod(pod *corev1.Pod) PodInfo {
	var containerNames []string
	var totalRestarts int32
	readyContainers := 0
	totalContainers := len(pod.Spec.Containers)

	for _, container := range pod.Spec.Containers {
		containerNames = append(containerNames, container.Name)
	}

	for _, containerStatus := range pod.Status.ContainerStatuses {
		totalRestarts += containerStatus.RestartCount
		if containerStatus.Ready {
			readyContainers++
		}
	}

	return PodInfo{
		Name:       pod.Name,
		Namespace:  pod.Namespace,
		Status:     string(pod.Status.Phase),
		Ready:      fmt.Sprintf("%d/%d", readyContainers, totalContainers),
		Restarts:   totalRestarts,
		Age:        formatAge(pod.CreationTimestamp.Time),
		IP:         pod.Status.PodIP,
		Node:       pod.Spec.NodeName,
		Labels:     pod.Labels,
		Containers: containerNames,
	}
}

// TransformPodDetailed transforms a Kubernetes Pod to our detailed PodDetail format
func TransformPodDetailed(pod *corev1.Pod) PodDetail {
	detail := PodDetail{
		// Basic info
		Name:              pod.Name,
		Namespace:         pod.Namespace,
		UID:               string(pod.UID),
		ResourceVersion:   pod.ResourceVersion,
		Generation:        pod.Generation,
		CreationTimestamp: pod.CreationTimestamp.Time,
		Labels:            pod.Labels,
		Annotations:       pod.Annotations,
		
		// Spec
		NodeName:           pod.Spec.NodeName,
		ServiceAccountName: pod.Spec.ServiceAccountName,
		HostNetwork:        pod.Spec.HostNetwork,
		DNSPolicy:          string(pod.Spec.DNSPolicy),
		RestartPolicy:      string(pod.Spec.RestartPolicy),
		Priority:           pod.Spec.Priority,
		PriorityClassName:  pod.Spec.PriorityClassName,
		
		// Status
		Phase:     string(pod.Status.Phase),
		Message:   pod.Status.Message,
		Reason:    pod.Status.Reason,
		PodIP:     pod.Status.PodIP,
		QOSClass:  string(pod.Status.QOSClass),
		HostIP:    pod.Status.HostIP,
		
		// Node selector
		NodeSelector: pod.Spec.NodeSelector,
		
		// Generate YAML without managedFields
		Yaml: generateCleanYAML(pod),
	}
	
	// Deletion timestamp
	if pod.DeletionTimestamp != nil {
		detail.DeletionTimestamp = &pod.DeletionTimestamp.Time
	}
	
	// Start time
	if pod.Status.StartTime != nil {
		detail.StartTime = &pod.Status.StartTime.Time
	}
	
	// Owner references
	for _, ref := range pod.OwnerReferences {
		detail.OwnerReferences = append(detail.OwnerReferences, OwnerReference{
			APIVersion: ref.APIVersion,
			Kind:       ref.Kind,
			Name:       ref.Name,
			UID:        string(ref.UID),
			Controller: ref.Controller,
		})
	}
	
	// Pod IPs
	for _, podIP := range pod.Status.PodIPs {
		detail.PodIPs = append(detail.PodIPs, podIP.IP)
	}
	
	// Conditions
	for _, cond := range pod.Status.Conditions {
		condition := PodCondition{
			Type:               string(cond.Type),
			Status:             string(cond.Status),
			LastTransitionTime: cond.LastTransitionTime.Time,
			Reason:             cond.Reason,
			Message:            cond.Message,
		}
		// LastProbeTime is not a pointer in v1.PodCondition
		detail.Conditions = append(detail.Conditions, condition)
	}
	
	// Init containers
	for _, container := range pod.Spec.InitContainers {
		detail.InitContainers = append(detail.InitContainers, transformContainer(container))
	}
	
	// Containers
	for _, container := range pod.Spec.Containers {
		detail.Containers = append(detail.Containers, transformContainer(container))
	}
	
	// Container statuses
	for _, status := range pod.Status.ContainerStatuses {
		detail.ContainerStatuses = append(detail.ContainerStatuses, transformContainerStatus(status))
	}
	
	// Init container statuses
	for _, status := range pod.Status.InitContainerStatuses {
		detail.InitContainerStatuses = append(detail.InitContainerStatuses, transformContainerStatus(status))
	}
	
	// Volumes
	for _, vol := range pod.Spec.Volumes {
		volume := Volume{
			Name:         vol.Name,
			VolumeSource: make(map[string]interface{}),
		}
		
		// Add volume source info (simplified for now)
		if vol.ConfigMap != nil {
			volume.VolumeSource["configMap"] = vol.ConfigMap.Name
		} else if vol.Secret != nil {
			volume.VolumeSource["secret"] = vol.Secret.SecretName
		} else if vol.PersistentVolumeClaim != nil {
			volume.VolumeSource["persistentVolumeClaim"] = vol.PersistentVolumeClaim.ClaimName
		} else if vol.EmptyDir != nil {
			volume.VolumeSource["emptyDir"] = true
		} else if vol.HostPath != nil {
			volume.VolumeSource["hostPath"] = vol.HostPath.Path
		}
		
		detail.Volumes = append(detail.Volumes, volume)
	}
	
	// Tolerations
	for _, tol := range pod.Spec.Tolerations {
		detail.Tolerations = append(detail.Tolerations, Toleration{
			Key:               tol.Key,
			Operator:          string(tol.Operator),
			Value:             tol.Value,
			Effect:            string(tol.Effect),
			TolerationSeconds: tol.TolerationSeconds,
		})
	}
	
	return detail
}

func transformContainer(container corev1.Container) ContainerDetail {
	detail := ContainerDetail{
		Name:            container.Name,
		Image:           container.Image,
		ImagePullPolicy: string(container.ImagePullPolicy),
		Command:         container.Command,
		Args:            container.Args,
		WorkingDir:      container.WorkingDir,
	}
	
	// Ports
	for _, port := range container.Ports {
		detail.Ports = append(detail.Ports, ContainerPort{
			Name:          port.Name,
			HostPort:      port.HostPort,
			ContainerPort: port.ContainerPort,
			Protocol:      string(port.Protocol),
			HostIP:        port.HostIP,
		})
	}
	
	// Environment variables
	for _, env := range container.Env {
		envVar := EnvVar{
			Name:  env.Name,
			Value: env.Value,
		}
		
		if env.ValueFrom != nil {
			envVar.ValueFrom = &EnvVarSource{}
			if env.ValueFrom.ConfigMapKeyRef != nil {
				envVar.ValueFrom.ConfigMapKeyRef = &ConfigMapKeySelector{
					Name: env.ValueFrom.ConfigMapKeyRef.Name,
					Key:  env.ValueFrom.ConfigMapKeyRef.Key,
				}
			}
			if env.ValueFrom.SecretKeyRef != nil {
				envVar.ValueFrom.SecretKeyRef = &SecretKeySelector{
					Name: env.ValueFrom.SecretKeyRef.Name,
					Key:  env.ValueFrom.SecretKeyRef.Key,
				}
			}
		}
		
		detail.Env = append(detail.Env, envVar)
	}
	
	// Resources
	detail.Resources = ResourceRequirements{
		Limits:   make(map[string]string),
		Requests: make(map[string]string),
	}
	
	for name, quantity := range container.Resources.Limits {
		detail.Resources.Limits[string(name)] = quantity.String()
	}
	
	for name, quantity := range container.Resources.Requests {
		detail.Resources.Requests[string(name)] = quantity.String()
	}
	
	// Volume mounts
	for _, mount := range container.VolumeMounts {
		detail.VolumeMounts = append(detail.VolumeMounts, VolumeMount{
			Name:      mount.Name,
			ReadOnly:  mount.ReadOnly,
			MountPath: mount.MountPath,
			SubPath:   mount.SubPath,
		})
	}
	
	// Probes
	if container.LivenessProbe != nil {
		detail.LivenessProbe = transformProbe(container.LivenessProbe)
	}
	
	if container.ReadinessProbe != nil {
		detail.ReadinessProbe = transformProbe(container.ReadinessProbe)
	}
	
	if container.StartupProbe != nil {
		detail.StartupProbe = transformProbe(container.StartupProbe)
	}
	
	return detail
}

func transformProbe(probe *corev1.Probe) *Probe {
	p := &Probe{
		InitialDelaySeconds: probe.InitialDelaySeconds,
		TimeoutSeconds:      probe.TimeoutSeconds,
		PeriodSeconds:       probe.PeriodSeconds,
		SuccessThreshold:    probe.SuccessThreshold,
		FailureThreshold:    probe.FailureThreshold,
	}
	
	// Handler
	if probe.Exec != nil {
		p.Handler.Exec = &ExecAction{
			Command: probe.Exec.Command,
		}
	}
	
	if probe.HTTPGet != nil {
		httpGet := &HTTPGetAction{
			Path:   probe.HTTPGet.Path,
			Host:   probe.HTTPGet.Host,
			Scheme: string(probe.HTTPGet.Scheme),
		}
		
		// Handle port
		if probe.HTTPGet.Port.IntVal > 0 {
			httpGet.Port = probe.HTTPGet.Port.IntVal
		}
		
		// Headers
		for _, header := range probe.HTTPGet.HTTPHeaders {
			httpGet.HTTPHeaders = append(httpGet.HTTPHeaders, HTTPHeader{
				Name:  header.Name,
				Value: header.Value,
			})
		}
		
		p.Handler.HTTPGet = httpGet
	}
	
	if probe.TCPSocket != nil {
		tcpSocket := &TCPSocketAction{
			Host: probe.TCPSocket.Host,
		}
		
		// Handle port
		if probe.TCPSocket.Port.IntVal > 0 {
			tcpSocket.Port = probe.TCPSocket.Port.IntVal
		}
		
		p.Handler.TCPSocket = tcpSocket
	}
	
	return p
}

func transformContainerStatus(status corev1.ContainerStatus) ContainerStatus {
	cs := ContainerStatus{
		Name:         status.Name,
		Ready:        status.Ready,
		RestartCount: status.RestartCount,
		Image:        status.Image,
		ImageID:      status.ImageID,
		ContainerID:  status.ContainerID,
		Started:      status.Started,
	}
	
	// Current state
	cs.State = transformContainerState(status.State)
	
	// Last state
	cs.LastState = transformContainerState(status.LastTerminationState)
	
	return cs
}

func transformContainerState(state corev1.ContainerState) ContainerState {
	cs := ContainerState{}
	
	if state.Waiting != nil {
		cs.Waiting = &ContainerStateWaiting{
			Reason:  state.Waiting.Reason,
			Message: state.Waiting.Message,
		}
	}
	
	if state.Running != nil {
		cs.Running = &ContainerStateRunning{
			StartedAt: state.Running.StartedAt.Time,
		}
	}
	
	if state.Terminated != nil {
		cs.Terminated = &ContainerStateTerminated{
			ExitCode:    state.Terminated.ExitCode,
			Signal:      state.Terminated.Signal,
			Reason:      state.Terminated.Reason,
			Message:     state.Terminated.Message,
			StartedAt:   state.Terminated.StartedAt.Time,
			FinishedAt:  state.Terminated.FinishedAt.Time,
			ContainerID: state.Terminated.ContainerID,
		}
	}
	
	return cs
}

// TransformEventList transforms Kubernetes Events to our EventInfo format
func TransformEventList(events *corev1.EventList) []EventInfo {
	var result []EventInfo
	
	for _, event := range events.Items {
		result = append(result, EventInfo{
			Type:           event.Type,
			Reason:         event.Reason,
			Message:        event.Message,
			Source:         event.Source.Component,
			FirstTimestamp: event.FirstTimestamp.Time,
			LastTimestamp:  event.LastTimestamp.Time,
			Count:          event.Count,
		})
	}
	
	return result
}

// formatAge formats the age of a resource
func formatAge(t time.Time) string {
	duration := time.Since(t)
	
	if duration.Hours() > 24*365 {
		years := int(duration.Hours() / (24 * 365))
		return fmt.Sprintf("%dy", years)
	}
	
	if duration.Hours() > 24*30 {
		months := int(duration.Hours() / (24 * 30))
		return fmt.Sprintf("%dmo", months)
	}
	
	if duration.Hours() > 24 {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
	
	if duration.Hours() > 1 {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	}
	
	if duration.Minutes() > 1 {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	}
	
	return fmt.Sprintf("%ds", int(duration.Seconds()))
}

// formatResourceQuantity formats a resource quantity
func formatResourceQuantity(q resource.Quantity) string {
	return q.String()
}

// generateCleanYAML generates YAML representation without managedFields
func generateCleanYAML(pod *corev1.Pod) string {
	// Create a copy of the pod to avoid modifying the original
	podCopy := pod.DeepCopy()
	
	// Remove managedFields
	podCopy.ManagedFields = nil
	
	// Remove resourceVersion to make it cleaner
	podCopy.ResourceVersion = ""
	
	// Remove selfLink if present
	podCopy.SelfLink = ""
	
	// Remove UID for cleaner output
	podCopy.UID = ""
	
	// LastProbeTime is deprecated and already not used in newer versions
	
	// Convert to unstructured to remove empty fields
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(podCopy)
	if err != nil {
		return fmt.Sprintf("# Error converting to unstructured: %v", err)
	}
	
	// Explicitly remove managedFields from the unstructured object
	if metadata, ok := unstructuredObj["metadata"].(map[string]interface{}); ok {
		delete(metadata, "managedFields")
		delete(metadata, "resourceVersion")
		delete(metadata, "selfLink")
		delete(metadata, "uid")
		
		// Clean up empty metadata fields
		if generation, ok := metadata["generation"].(int64); ok && generation == 0 {
			delete(metadata, "generation")
		}
	}
	
	// Remove empty status fields
	if status, ok := unstructuredObj["status"].(map[string]interface{}); ok {
		// Remove nulls and empty arrays from status
		if conditions, ok := status["conditions"].([]interface{}); ok && len(conditions) == 0 {
			delete(status, "conditions")
		}
	}
	
	// Convert to YAML
	yamlBytes, err := yaml.Marshal(unstructuredObj)
	if err != nil {
		return fmt.Sprintf("# Error generating YAML: %v", err)
	}
	
	return string(yamlBytes)
}