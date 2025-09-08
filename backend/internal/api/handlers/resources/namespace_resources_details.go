package resources

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ResourceDetails struct {
	Name        string            `json:"name"`
	Status      string            `json:"status,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
	Details     interface{}       `json:"details,omitempty"`
}

type ResourceListDetails struct {
	ResourceType string            `json:"resourceType"`
	Items        []ResourceDetails `json:"items"`
}

type NamespaceResourcesDetails struct {
	Namespace string                `json:"namespace"`
	Cluster   string                `json:"cluster"`
	Resources []ResourceListDetails `json:"resources"`
}

// GetNamespaceResourcesDetails returns detailed list of resources in a namespace
func GetNamespaceResourcesDetails(c *gin.Context) {
	contextName := c.Query("context")
	namespace := c.Query("namespace")
	resourceType := c.Query("resourceType")

	if contextName == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context and namespace are required"})
		return
	}

	clientset, err := manager.GetClientset(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}

	ctx := context.Background()
	var resourceList ResourceListDetails
	resourceList.ResourceType = resourceType

		switch strings.ToLower(resourceType) {
		case "pods":
			pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(pods.Items))
			for _, pod := range pods.Items {
				status := string(pod.Status.Phase)
				if pod.Status.Reason != "" {
					status = pod.Status.Reason
				}
				
				// Extract container details
				containers := make([]map[string]interface{}, 0, len(pod.Spec.Containers))
				for _, container := range pod.Spec.Containers {
					containerDetails := map[string]interface{}{
						"name":  container.Name,
						"image": container.Image,
					}
					
					// Add resource requests and limits
					if container.Resources.Requests != nil {
						requests := map[string]string{}
						if cpu := container.Resources.Requests.Cpu(); cpu != nil {
							requests["cpu"] = cpu.String()
						}
						if memory := container.Resources.Requests.Memory(); memory != nil {
							requests["memory"] = memory.String()
						}
						containerDetails["requests"] = requests
					}
					
					if container.Resources.Limits != nil {
						limits := map[string]string{}
						if cpu := container.Resources.Limits.Cpu(); cpu != nil {
							limits["cpu"] = cpu.String()
						}
						if memory := container.Resources.Limits.Memory(); memory != nil {
							limits["memory"] = memory.String()
						}
						containerDetails["limits"] = limits
					}
					
					// Add environment variables count
					containerDetails["envCount"] = len(container.Env)
					
					// Add volume mounts
					volumeMounts := make([]string, 0, len(container.VolumeMounts))
					for _, mount := range container.VolumeMounts {
						volumeMounts = append(volumeMounts, mount.Name)
					}
					containerDetails["volumeMounts"] = volumeMounts
					
					containers = append(containers, containerDetails)
				}
				
				// Extract volumes
				volumes := make([]string, 0, len(pod.Spec.Volumes))
				for _, volume := range pod.Spec.Volumes {
					volumes = append(volumes, volume.Name)
				}
				
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        pod.Name,
					Status:      status,
					Labels:      pod.Labels,
					Annotations: pod.Annotations,
					Details: map[string]interface{}{
						"containers":       containers,
						"containersCount":  len(pod.Spec.Containers),
						"nodeName":         pod.Spec.NodeName,
						"ready":            isPodReady(&pod),
						"volumes":          volumes,
						"nodeSelector":     pod.Spec.NodeSelector,
						"tolerations":      len(pod.Spec.Tolerations),
						"serviceAccount":   pod.Spec.ServiceAccountName,
						"restartPolicy":    pod.Spec.RestartPolicy,
					},
				})
			}

		case "configmaps":
			configMaps, err := clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(configMaps.Items))
			for _, cm := range configMaps.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        cm.Name,
					Labels:      cm.Labels,
					Annotations: cm.Annotations,
					Details: map[string]interface{}{
						"dataKeys": len(cm.Data),
						"size":     calculateSize(cm.Data),
					},
				})
			}

		case "secrets":
			secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(secrets.Items))
			for _, secret := range secrets.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        secret.Name,
					Labels:      secret.Labels,
					Annotations: secret.Annotations,
					Details: map[string]interface{}{
						"type":     string(secret.Type),
						"dataKeys": len(secret.Data),
					},
				})
			}

		case "services":
			services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(services.Items))
			for _, svc := range services.Items {
				ports := []string{}
				for _, port := range svc.Spec.Ports {
					ports = append(ports, port.Name)
				}
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        svc.Name,
					Labels:      svc.Labels,
					Annotations: svc.Annotations,
					Details: map[string]interface{}{
						"type":      string(svc.Spec.Type),
						"clusterIP": svc.Spec.ClusterIP,
						"ports":     ports,
					},
				})
			}

		case "deployments":
			deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(deployments.Items))
			for _, dep := range deployments.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        dep.Name,
					Labels:      dep.Labels,
					Annotations: dep.Annotations,
					Details: map[string]interface{}{
						"replicas":      *dep.Spec.Replicas,
						"readyReplicas": dep.Status.ReadyReplicas,
						"strategy":      string(dep.Spec.Strategy.Type),
					},
				})
			}

		case "statefulsets":
			statefulSets, err := clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(statefulSets.Items))
			for _, sts := range statefulSets.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        sts.Name,
					Labels:      sts.Labels,
					Annotations: sts.Annotations,
					Details: map[string]interface{}{
						"replicas":      *sts.Spec.Replicas,
						"readyReplicas": sts.Status.ReadyReplicas,
					},
				})
			}

		case "daemonsets":
			daemonSets, err := clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(daemonSets.Items))
			for _, ds := range daemonSets.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        ds.Name,
					Labels:      ds.Labels,
					Annotations: ds.Annotations,
					Details: map[string]interface{}{
						"desiredNodes": ds.Status.DesiredNumberScheduled,
						"readyNodes":   ds.Status.NumberReady,
					},
				})
			}

		case "replicasets":
			replicaSets, err := clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(replicaSets.Items))
			for _, rs := range replicaSets.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        rs.Name,
					Labels:      rs.Labels,
					Annotations: rs.Annotations,
					Details: map[string]interface{}{
						"replicas":      *rs.Spec.Replicas,
						"readyReplicas": rs.Status.ReadyReplicas,
					},
				})
			}

		case "jobs":
			jobs, err := clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(jobs.Items))
			for _, job := range jobs.Items {
				status := "Unknown"
				if job.Status.Succeeded > 0 {
					status = "Succeeded"
				} else if job.Status.Failed > 0 {
					status = "Failed"
				} else if job.Status.Active > 0 {
					status = "Active"
				}
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        job.Name,
					Status:      status,
					Labels:      job.Labels,
					Annotations: job.Annotations,
					Details: map[string]interface{}{
						"active":    job.Status.Active,
						"succeeded": job.Status.Succeeded,
						"failed":    job.Status.Failed,
					},
				})
			}

		case "cronjobs":
			cronJobs, err := clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(cronJobs.Items))
			for _, cj := range cronJobs.Items {
				status := "Active"
				if cj.Spec.Suspend != nil && *cj.Spec.Suspend {
					status = "Suspended"
				}
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        cj.Name,
					Status:      status,
					Labels:      cj.Labels,
					Annotations: cj.Annotations,
					Details: map[string]interface{}{
						"schedule": cj.Spec.Schedule,
						"suspend":  cj.Spec.Suspend != nil && *cj.Spec.Suspend,
						"active":   len(cj.Status.Active),
					},
				})
			}

		case "ingresses":
			ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(ingresses.Items))
			for _, ing := range ingresses.Items {
				hosts := []string{}
				for _, rule := range ing.Spec.Rules {
					if rule.Host != "" {
						hosts = append(hosts, rule.Host)
					}
				}
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        ing.Name,
					Labels:      ing.Labels,
					Annotations: ing.Annotations,
					Details: map[string]interface{}{
						"hosts":       hosts,
						"ingressClass": ing.Spec.IngressClassName,
					},
				})
			}

		case "networkpolicies":
			networkPolicies, err := clientset.NetworkingV1().NetworkPolicies(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(networkPolicies.Items))
			for _, np := range networkPolicies.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        np.Name,
					Labels:      np.Labels,
					Annotations: np.Annotations,
					Details: map[string]interface{}{
						"podSelector": np.Spec.PodSelector.MatchLabels,
						"policyTypes": np.Spec.PolicyTypes,
					},
				})
			}

		case "pvcs", "persistentvolumeclaims":
			pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(pvcs.Items))
			for _, pvc := range pvcs.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        pvc.Name,
					Status:      string(pvc.Status.Phase),
					Labels:      pvc.Labels,
					Annotations: pvc.Annotations,
					Details: map[string]interface{}{
						"storageClass": *pvc.Spec.StorageClassName,
						"capacity":     pvc.Status.Capacity,
						"accessModes":  pvc.Spec.AccessModes,
					},
				})
			}

		case "serviceaccounts":
			serviceAccounts, err := clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(serviceAccounts.Items))
			for _, sa := range serviceAccounts.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        sa.Name,
					Labels:      sa.Labels,
					Annotations: sa.Annotations,
					Details: map[string]interface{}{
						"secrets": len(sa.Secrets),
					},
				})
			}

		case "roles":
			roles, err := clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(roles.Items))
			for _, role := range roles.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        role.Name,
					Labels:      role.Labels,
					Annotations: role.Annotations,
					Details: map[string]interface{}{
						"rules": len(role.Rules),
					},
				})
			}

		case "rolebindings":
			roleBindings, err := clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			resourceList.Items = make([]ResourceDetails, 0, len(roleBindings.Items))
			for _, rb := range roleBindings.Items {
				resourceList.Items = append(resourceList.Items, ResourceDetails{
					Name:        rb.Name,
					Labels:      rb.Labels,
					Annotations: rb.Annotations,
					Details: map[string]interface{}{
						"roleRef":  rb.RoleRef.Name,
						"subjects": len(rb.Subjects),
					},
				})
			}

		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported resource type"})
			return
		}

	c.JSON(http.StatusOK, resourceList)
}

func isPodReady(pod *corev1.Pod) bool {
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady {
			return condition.Status == corev1.ConditionTrue
		}
	}
	return false
}

func calculateSize(data map[string]string) int {
	size := 0
	for _, v := range data {
		size += len(v)
	}
	return size
}