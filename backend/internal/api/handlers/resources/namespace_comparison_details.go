package resources

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ResourceNamesRequest struct {
	Context      string `json:"context"`
	Namespace    string `json:"namespace"`
	ResourceType string `json:"resourceType"`
}

type ResourceNamesResponse struct {
	ResourceType string   `json:"resourceType"`
	Names        []string `json:"names"`
	Count        int      `json:"count"`
}

// GetResourceNames returns the names of resources in a namespace
func GetResourceNames(c *gin.Context) {
	var req ResourceNamesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Context == "" || req.Namespace == "" || req.ResourceType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, namespace and resourceType are required"})
		return
	}

	clientset, err := manager.GetClientset(req.Context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get clientset: " + err.Error()})
		return
	}

	ctx := context.Background()
	names := []string{}

	switch req.ResourceType {
	case "pods":
		if pods, err := clientset.CoreV1().Pods(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, pod := range pods.Items {
				names = append(names, pod.Name)
			}
		}
	case "services":
		if services, err := clientset.CoreV1().Services(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, service := range services.Items {
				names = append(names, service.Name)
			}
		}
	case "deployments":
		if deployments, err := clientset.AppsV1().Deployments(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, deployment := range deployments.Items {
				names = append(names, deployment.Name)
			}
		}
	case "statefulSets":
		if statefulSets, err := clientset.AppsV1().StatefulSets(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, statefulSet := range statefulSets.Items {
				names = append(names, statefulSet.Name)
			}
		}
	case "daemonSets":
		if daemonSets, err := clientset.AppsV1().DaemonSets(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, daemonSet := range daemonSets.Items {
				names = append(names, daemonSet.Name)
			}
		}
	case "replicaSets":
		if replicaSets, err := clientset.AppsV1().ReplicaSets(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, replicaSet := range replicaSets.Items {
				names = append(names, replicaSet.Name)
			}
		}
	case "jobs":
		if jobs, err := clientset.BatchV1().Jobs(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, job := range jobs.Items {
				names = append(names, job.Name)
			}
		}
	case "cronJobs":
		if cronJobs, err := clientset.BatchV1().CronJobs(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, cronJob := range cronJobs.Items {
				names = append(names, cronJob.Name)
			}
		}
	case "configMaps":
		if configMaps, err := clientset.CoreV1().ConfigMaps(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, configMap := range configMaps.Items {
				names = append(names, configMap.Name)
			}
		}
	case "secrets":
		if secrets, err := clientset.CoreV1().Secrets(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, secret := range secrets.Items {
				names = append(names, secret.Name)
			}
		}
	case "pvcs":
		if pvcs, err := clientset.CoreV1().PersistentVolumeClaims(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, pvc := range pvcs.Items {
				names = append(names, pvc.Name)
			}
		}
	case "ingresses":
		if ingresses, err := clientset.NetworkingV1().Ingresses(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, ingress := range ingresses.Items {
				names = append(names, ingress.Name)
			}
		}
	case "networkPolicies":
		if networkPolicies, err := clientset.NetworkingV1().NetworkPolicies(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, networkPolicy := range networkPolicies.Items {
				names = append(names, networkPolicy.Name)
			}
		}
	case "serviceAccounts":
		if serviceAccounts, err := clientset.CoreV1().ServiceAccounts(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, serviceAccount := range serviceAccounts.Items {
				names = append(names, serviceAccount.Name)
			}
		}
	case "roles":
		if roles, err := clientset.RbacV1().Roles(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, role := range roles.Items {
				names = append(names, role.Name)
			}
		}
	case "roleBindings":
		if roleBindings, err := clientset.RbacV1().RoleBindings(req.Namespace).List(ctx, metav1.ListOptions{}); err == nil {
			for _, roleBinding := range roleBindings.Items {
				names = append(names, roleBinding.Name)
			}
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown resource type: " + req.ResourceType})
		return
	}

	response := ResourceNamesResponse{
		ResourceType: req.ResourceType,
		Names:        names,
		Count:        len(names),
	}

	c.JSON(http.StatusOK, response)
}