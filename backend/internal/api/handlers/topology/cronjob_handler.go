package topology

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"k8s.io/client-go/kubernetes"
)

// ListCronJobs handles the listing of CronJobs in a namespace
func (h *Handler) ListCronJobs(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Query("namespace")
	
	if namespace == "" {
		namespace = "default"
	}
	
	// Get the clientset for this context
	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Create service and get CronJobs
	service := NewCronJobService(clientset.(*kubernetes.Clientset))
	response, err := service.ListCronJobs(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, response)
}

// GetCronJobTopology handles fetching the topology for a specific CronJob
func (h *Handler) GetCronJobTopology(c *gin.Context) {
	context := c.Param("context")
	namespace := c.Param("namespace")
	name := c.Param("name")
	
	// Get the clientset for this context
	clientset, err := h.manager.GetClientset(context)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Create service and get topology
	service := NewCronJobService(clientset.(*kubernetes.Clientset))
	topology, err := service.GetCronJobTopology(c.Request.Context(), namespace, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, topology)
}