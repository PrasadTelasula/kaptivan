package deployments

import (
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"sigs.k8s.io/yaml"
)

// TransformDeploymentList transforms a Kubernetes DeploymentList to our DeploymentInfo format
func TransformDeploymentList(deploymentList *appsv1.DeploymentList) []DeploymentInfo {
	var result []DeploymentInfo
	
	for _, deployment := range deploymentList.Items {
		result = append(result, TransformDeployment(&deployment))
	}
	
	return result
}

// TransformDeployment transforms a Kubernetes Deployment to our DeploymentInfo format
func TransformDeployment(deployment *appsv1.Deployment) DeploymentInfo {
	// Extract images from containers
	var images []string
	imageMap := make(map[string]bool)
	for _, container := range deployment.Spec.Template.Spec.Containers {
		if !imageMap[container.Image] {
			images = append(images, container.Image)
			imageMap[container.Image] = true
		}
	}

	// Extract conditions
	var conditions []string
	for _, condition := range deployment.Status.Conditions {
		if condition.Status == "True" {
			conditions = append(conditions, string(condition.Type))
		}
	}

	// Format replicas as "ready/desired"
	desired := int32(1)
	if deployment.Spec.Replicas != nil {
		desired = *deployment.Spec.Replicas
	}
	replicas := fmt.Sprintf("%d/%d", deployment.Status.ReadyReplicas, desired)

	// Extract selector
	selector := make(map[string]string)
	if deployment.Spec.Selector != nil && deployment.Spec.Selector.MatchLabels != nil {
		selector = deployment.Spec.Selector.MatchLabels
	}

	return DeploymentInfo{
		Name:              deployment.Name,
		Namespace:         deployment.Namespace,
		Replicas:          replicas,
		UpdatedReplicas:   deployment.Status.UpdatedReplicas,
		AvailableReplicas: deployment.Status.AvailableReplicas,
		Age:               formatAge(deployment.CreationTimestamp.Time),
		Labels:            deployment.Labels,
		Selector:          selector,
		Strategy:          string(deployment.Spec.Strategy.Type),
		Images:            images,
		Conditions:        conditions,
	}
}

// TransformDeploymentDetailed transforms a Kubernetes Deployment to our detailed DeploymentDetail format
func TransformDeploymentDetailed(deployment *appsv1.Deployment) DeploymentDetail {
	detail := DeploymentDetail{
		// Basic info
		Name:              deployment.Name,
		Namespace:         deployment.Namespace,
		UID:               string(deployment.UID),
		ResourceVersion:   deployment.ResourceVersion,
		Generation:        deployment.Generation,
		CreationTimestamp: deployment.CreationTimestamp.Time,
		Labels:            deployment.Labels,
		Annotations:       deployment.Annotations,
		
		// Spec
		Replicas:                deployment.Spec.Replicas,
		MinReadySeconds:         deployment.Spec.MinReadySeconds,
		Paused:                  deployment.Spec.Paused,
		RevisionHistoryLimit:    deployment.Spec.RevisionHistoryLimit,
		ProgressDeadlineSeconds: deployment.Spec.ProgressDeadlineSeconds,
		
		// Status
		ObservedGeneration:  deployment.Status.ObservedGeneration,
		StatusReplicas:      deployment.Status.Replicas,
		UpdatedReplicas:     deployment.Status.UpdatedReplicas,
		ReadyReplicas:       deployment.Status.ReadyReplicas,
		AvailableReplicas:   deployment.Status.AvailableReplicas,
		UnavailableReplicas: deployment.Status.UnavailableReplicas,
		CollisionCount:      deployment.Status.CollisionCount,
		
		// Generate YAML
		Yaml: generateCleanYAML(deployment),
	}
	
	// Transform selector
	if deployment.Spec.Selector != nil && deployment.Spec.Selector.MatchLabels != nil {
		detail.Selector = deployment.Spec.Selector.MatchLabels
	}
	
	// Transform strategy
	detail.Strategy = DeploymentStrategy{
		Type: string(deployment.Spec.Strategy.Type),
	}
	
	if deployment.Spec.Strategy.RollingUpdate != nil {
		detail.Strategy.RollingUpdate = &RollingUpdateDeployment{
			MaxUnavailable: intOrStringToString(deployment.Spec.Strategy.RollingUpdate.MaxUnavailable),
			MaxSurge:       intOrStringToString(deployment.Spec.Strategy.RollingUpdate.MaxSurge),
		}
	}
	
	// Transform conditions
	for _, cond := range deployment.Status.Conditions {
		detail.Conditions = append(detail.Conditions, DeploymentCondition{
			Type:               string(cond.Type),
			Status:             string(cond.Status),
			LastUpdateTime:     cond.LastUpdateTime.Time,
			LastTransitionTime: cond.LastTransitionTime.Time,
			Reason:             cond.Reason,
			Message:            cond.Message,
		})
	}
	
	// Transform pod template
	detail.PodTemplate = transformPodTemplateSpec(deployment.Spec.Template)
	
	return detail
}

func transformPodTemplateSpec(template corev1.PodTemplateSpec) PodTemplateSpec {
	pts := PodTemplateSpec{
		Labels:      template.Labels,
		Annotations: template.Annotations,
		NodeSelector: template.Spec.NodeSelector,
	}
	
	// Transform containers
	for _, container := range template.Spec.Containers {
		containerSpec := ContainerSpec{
			Name:            container.Name,
			Image:           container.Image,
			ImagePullPolicy: string(container.ImagePullPolicy),
			Command:         container.Command,
			Args:            container.Args,
		}
		
		// Ports
		for _, port := range container.Ports {
			containerSpec.Ports = append(containerSpec.Ports, ContainerPort{
				Name:          port.Name,
				ContainerPort: port.ContainerPort,
				Protocol:      string(port.Protocol),
			})
		}
		
		// Environment variables
		for _, env := range container.Env {
			containerSpec.Env = append(containerSpec.Env, EnvVar{
				Name:  env.Name,
				Value: env.Value,
			})
		}
		
		// Resources
		containerSpec.Resources = ResourceRequirements{
			Limits:   make(map[string]string),
			Requests: make(map[string]string),
		}
		
		for name, quantity := range container.Resources.Limits {
			containerSpec.Resources.Limits[string(name)] = quantity.String()
		}
		
		for name, quantity := range container.Resources.Requests {
			containerSpec.Resources.Requests[string(name)] = quantity.String()
		}
		
		// Volume mounts
		for _, mount := range container.VolumeMounts {
			containerSpec.VolumeMounts = append(containerSpec.VolumeMounts, VolumeMount{
				Name:      mount.Name,
				MountPath: mount.MountPath,
				ReadOnly:  mount.ReadOnly,
			})
		}
		
		pts.Containers = append(pts.Containers, containerSpec)
	}
	
	// Transform volumes
	for _, volume := range template.Spec.Volumes {
		volumeSpec := VolumeSpec{
			Name:   volume.Name,
			Source: make(map[string]interface{}),
		}
		
		// Add volume source info (simplified)
		if volume.ConfigMap != nil {
			volumeSpec.Source["configMap"] = volume.ConfigMap.Name
		} else if volume.Secret != nil {
			volumeSpec.Source["secret"] = volume.Secret.SecretName
		} else if volume.PersistentVolumeClaim != nil {
			volumeSpec.Source["persistentVolumeClaim"] = volume.PersistentVolumeClaim.ClaimName
		} else if volume.EmptyDir != nil {
			volumeSpec.Source["emptyDir"] = true
		}
		
		pts.Volumes = append(pts.Volumes, volumeSpec)
	}
	
	// Transform tolerations
	for _, toleration := range template.Spec.Tolerations {
		pts.Tolerations = append(pts.Tolerations, TolerationSpec{
			Key:      toleration.Key,
			Operator: string(toleration.Operator),
			Value:    toleration.Value,
			Effect:   string(toleration.Effect),
		})
	}
	
	// Store affinity as raw interface (can be expanded later)
	if template.Spec.Affinity != nil {
		pts.Affinity = template.Spec.Affinity
	}
	
	return pts
}

// generateCleanYAML generates YAML representation without managedFields
func generateCleanYAML(deployment *appsv1.Deployment) string {
	// Create a copy to avoid modifying the original
	deploymentCopy := deployment.DeepCopy()
	
	// Remove managedFields
	deploymentCopy.ManagedFields = nil
	
	// Remove resourceVersion to make it cleaner
	deploymentCopy.ResourceVersion = ""
	
	// Remove selfLink if present
	deploymentCopy.SelfLink = ""
	
	// Remove UID for cleaner output
	deploymentCopy.UID = ""
	
	// Convert to unstructured to remove empty fields
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(deploymentCopy)
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
	
	// Convert to YAML
	yamlBytes, err := yaml.Marshal(unstructuredObj)
	if err != nil {
		return fmt.Sprintf("# Error generating YAML: %v", err)
	}
	
	return string(yamlBytes)
}

// Helper functions
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

func intOrStringToString(val *intstr.IntOrString) string {
	if val == nil {
		return ""
	}
	if val.Type == intstr.Int {
		return fmt.Sprintf("%d", val.IntVal)
	}
	return val.StrVal
}