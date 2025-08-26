package deployments

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var clusterManager *kubernetes.ClusterManager

// Initialize sets up the deployment handlers with the cluster manager
func Initialize(cm *kubernetes.ClusterManager) {
	clusterManager = cm
}

// List handles listing deployments across multiple clusters
func List(c *gin.Context) {
	var req struct {
		Contexts   []string `json:"contexts" binding:"required"`
		Namespaces []string `json:"namespaces"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	var allDeployments []DeploymentInfo

	// Iterate through each cluster context
	for _, contextName := range req.Contexts {
		conn, err := clusterManager.GetConnection(contextName)
		if err != nil {
			// Skip clusters that aren't connected
			continue
		}

		// If no namespaces specified, list from all namespaces
		namespaces := req.Namespaces
		if len(namespaces) == 0 {
			namespaces = []string{""}
		}

		for _, namespace := range namespaces {
			listOptions := metav1.ListOptions{}
			
			// Get deployments from the cluster
			deploymentList, err := conn.ClientSet.AppsV1().Deployments(namespace).List(
				context.Background(),
				listOptions,
			)
			if err != nil {
				continue
			}

			// Transform and add cluster context to each deployment
			deployments := TransformDeploymentList(deploymentList)
			for i := range deployments {
				// Add cluster context as a label for identification
				if deployments[i].Labels == nil {
					deployments[i].Labels = make(map[string]string)
				}
				deployments[i].Labels["cluster"] = contextName
			}
			
			allDeployments = append(allDeployments, deployments...)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": allDeployments,
		"total":       len(allDeployments),
	})
}

// Get handles getting a single deployment details
func Get(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if context == "" || namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "context, namespace, and name are required",
		})
		return
	}

	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Cluster %s not connected", context),
		})
		return
	}

	// Get the deployment
	deployment, err := conn.ClientSet.AppsV1().Deployments(namespace).Get(
		c.Request.Context(),
		name,
		metav1.GetOptions{},
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Deployment %s/%s not found: %v", namespace, name, err),
		})
		return
	}

	// Transform to our format
	deploymentDetail := TransformDeploymentDetailed(deployment)

	c.JSON(http.StatusOK, deploymentDetail)
}

// Scale handles scaling a deployment
func Scale(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Cluster %s not connected", context),
		})
		return
	}

	// Get the deployment
	deployment, err := conn.ClientSet.AppsV1().Deployments(namespace).Get(
		c.Request.Context(),
		name,
		metav1.GetOptions{},
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Deployment %s/%s not found: %v", namespace, name, err),
		})
		return
	}

	// Update replicas
	deployment.Spec.Replicas = &req.Replicas

	// Update the deployment
	updated, err := conn.ClientSet.AppsV1().Deployments(namespace).Update(
		c.Request.Context(),
		deployment,
		metav1.UpdateOptions{},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to scale deployment: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Deployment scaled successfully",
		"replicas": *updated.Spec.Replicas,
	})
}

// Restart handles restarting a deployment
func Restart(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Cluster %s not connected", context),
		})
		return
	}

	// Get the deployment
	deployment, err := conn.ClientSet.AppsV1().Deployments(namespace).Get(
		c.Request.Context(),
		name,
		metav1.GetOptions{},
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Deployment %s/%s not found: %v", namespace, name, err),
		})
		return
	}

	// Add/update restart annotation to trigger rollout
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}
	deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = metav1.Now().String()

	// Update the deployment
	_, err = conn.ClientSet.AppsV1().Deployments(namespace).Update(
		c.Request.Context(),
		deployment,
		metav1.UpdateOptions{},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to restart deployment: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Deployment restart initiated",
	})
}

// Delete handles deleting a deployment
func Delete(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Cluster %s not connected", context),
		})
		return
	}

	// Delete the deployment
	err = conn.ClientSet.AppsV1().Deployments(namespace).Delete(
		c.Request.Context(),
		name,
		metav1.DeleteOptions{},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to delete deployment: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Deployment %s deleted successfully", name),
	})
}