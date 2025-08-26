package services

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"

	"github.com/prasad/kaptivan/backend/internal/kubernetes"
)

var clusterManager *kubernetes.ClusterManager

func Initialize(cm *kubernetes.ClusterManager) {
	clusterManager = cm
}

func ListServices(c *gin.Context) {
	var req ListServicesRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allServices := []ServiceInfo{}

	for _, contextName := range req.Contexts {
		client, err := clusterManager.GetConnection(contextName)
		if err != nil {
			continue
		}

		namespaces := req.Namespaces
		if len(namespaces) == 0 {
			namespaces = []string{corev1.NamespaceAll}
		}

		for _, namespace := range namespaces {
			services, err := client.ClientSet.CoreV1().Services(namespace).List(context.Background(), metav1.ListOptions{})
			if err != nil {
				continue
			}

			transformed := TransformServiceList(services.Items)
			allServices = append(allServices, transformed...)
		}
	}

	c.JSON(http.StatusOK, ListServicesResponse{
		Services: allServices,
	})
}

func GetService(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	client, err := clusterManager.GetConnection(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster client"})
		return
	}

	service, err := client.ClientSet.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}
	
	endpoints, _ := client.ClientSet.CoreV1().Endpoints(namespace).Get(context.Background(), name, metav1.GetOptions{})

	detail := TransformServiceDetail(*service, endpoints)
	
	serviceCopy := service.DeepCopy()
	removeManagedFields(serviceCopy)
	
	yamlBytes, err := yaml.Marshal(serviceCopy)
	if err == nil {
		detail.YAML = string(yamlBytes)
	}

	c.JSON(http.StatusOK, detail)
}

func DeleteService(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	client, err := clusterManager.GetConnection(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster client"})
		return
	}

	err = client.ClientSet.CoreV1().Services(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete service"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
}

func UpdateService(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Selector map[string]string `json:"selector,omitempty"`
		Ports    []ServicePort     `json:"ports,omitempty"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client, err := clusterManager.GetConnection(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster client"})
		return
	}

	service, err := client.ClientSet.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	if req.Selector != nil {
		service.Spec.Selector = req.Selector
	}

	if req.Ports != nil {
		service.Spec.Ports = make([]corev1.ServicePort, len(req.Ports))
		for i, port := range req.Ports {
			service.Spec.Ports[i] = corev1.ServicePort{
				Name:       port.Name,
				Protocol:   corev1.Protocol(port.Protocol),
				Port:       port.Port,
				TargetPort: port.TargetPort,
				NodePort:   port.NodePort,
			}
			if port.AppProtocol != "" {
				service.Spec.Ports[i].AppProtocol = &port.AppProtocol
			}
		}
	}

	_, err = client.ClientSet.CoreV1().Services(namespace).Update(context.Background(), service, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update service"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service updated successfully"})
}

func GetServiceEndpoints(c *gin.Context) {
	contextName := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")

	client, err := clusterManager.GetConnection(contextName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster client"})
		return
	}

	endpoints, err := client.ClientSet.CoreV1().Endpoints(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Endpoints not found"})
		return
	}

	endpointInfo := transformEndpoints(endpoints)
	c.JSON(http.StatusOK, gin.H{"endpoints": endpointInfo})
}

func removeManagedFields(obj interface{}) {
	switch v := obj.(type) {
	case *corev1.Service:
		v.ManagedFields = nil
		if v.Annotations != nil {
			delete(v.Annotations, "kubectl.kubernetes.io/last-applied-configuration")
		}
	}
}