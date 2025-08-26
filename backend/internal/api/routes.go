package api

import (
	"fmt"
	"log"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/api/handlers"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/deployments"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/manifests"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/pods"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/services"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/topology"
	"github.com/prasad/kaptivan/backend/internal/api/middleware"
)

func SetupRoutes(r *gin.Engine) {
	r.Use(middleware.CORS())
	
	// Initialize cluster manager
	manager, err := handlers.InitializeClusterManager()
	if err != nil {
		// Log error but continue - clusters can be loaded later
		println("Warning: Failed to initialize cluster manager:", err.Error())
	} else {
		// Initialize resource handlers with cluster manager
		handlers.InitResourceHandlers(manager)
		// Initialize pod handlers
		pods.Initialize(manager)
		// Initialize deployment handlers
		deployments.Initialize(manager)
		// Initialize services handlers
		services.Initialize(manager)
		// Initialize manifest handlers
		manifests.Initialize(manager)
		// Initialize topology handlers
		topology.Initialize(manager)
	}
	
	r.GET("/health", handlers.Health)
	
	v1 := r.Group("/api/v1")
	{
		// Legacy endpoint (kept for compatibility)
		v1.GET("/clusters", handlers.ListClusters)
		
		// New cluster management endpoints
		v1.GET("/clusters/config", handlers.ListClustersFromConfig)
		v1.POST("/clusters/connect", handlers.ConnectCluster)
		v1.POST("/clusters/disconnect", handlers.DisconnectCluster)
		v1.GET("/clusters/:context", handlers.GetClusterInfo)
		
		// Pod endpoints (new structured handlers)
		podsGroup := v1.Group("/pods")
		{
			podsGroup.POST("/list", pods.List)
			podsGroup.GET("/:context/:namespace/:name", pods.Get)
			podsGroup.GET("/:context/:namespace/:name/logs", pods.GetLogs)
			podsGroup.GET("/:context/:namespace/:name/events", pods.GetEvents)
			podsGroup.DELETE("/:context/:namespace/:name", pods.Delete)
			podsGroup.POST("/:context/:namespace/:name/exec", pods.Exec)
			podsGroup.GET("/:context/:namespace/:name/exec/ws", pods.ExecWebSocket)
			podsGroup.GET("/:context/:namespace/:name/logs/ws", pods.LogsWebSocket)
		}
		
		// Deployment endpoints (new structured handlers)
		deploymentsGroup := v1.Group("/deployments")
		{
			deploymentsGroup.POST("/list", deployments.List)
			deploymentsGroup.GET("/:context/:namespace/:name", deployments.Get)
			deploymentsGroup.POST("/:context/:namespace/:name/scale", deployments.Scale)
			deploymentsGroup.POST("/:context/:namespace/:name/restart", deployments.Restart)
			deploymentsGroup.DELETE("/:context/:namespace/:name", deployments.Delete)
		}
		
		// Services endpoints (new structured handlers)
		servicesGroup := v1.Group("/services")
		{
			servicesGroup.POST("/list", services.ListServices)
			servicesGroup.GET("/:context/:namespace/:name", services.GetService)
			servicesGroup.GET("/:context/:namespace/:name/endpoints", services.GetServiceEndpoints)
			servicesGroup.PUT("/:context/:namespace/:name", services.UpdateService)
			servicesGroup.DELETE("/:context/:namespace/:name", services.DeleteService)
		}
		
		// Legacy resource endpoints (kept for compatibility)
		v1.POST("/resources/pods", handlers.ListPods)
		v1.GET("/resources/pods/:context/:namespace/:name", handlers.GetPod)
		v1.POST("/resources/deployments", handlers.ListDeployments)
		v1.POST("/resources/services", handlers.ListServices)
		v1.GET("/resources/namespaces", handlers.ListNamespaces)
		v1.GET("/resources/nodes", handlers.ListNodes)
		
		// Manifest endpoints
		manifestsGroup := v1.Group("/manifests")
		{
			manifestsGroup.GET("/discover", manifests.ListAPIResources)
			manifestsGroup.POST("/list", manifests.ListResources)
			manifestsGroup.GET("/:context/:name", manifests.GetManifest)
			manifestsGroup.GET("/:context/:name/related", manifests.GetRelatedResources)
		}
		
		// Topology endpoints
		// Initialize topology handler if not already done
		if topology.GetHandler() == nil && manager != nil {
			topology.Initialize(manager)
		}
		
		topologyGroup := v1.Group("/topology")
		{
			topologyHandler := topology.GetHandler()
			
			if topologyHandler != nil {
				topologyGroup.GET("/:context/namespaces", topologyHandler.ListNamespaces)
				topologyGroup.GET("/:context/deployments", topologyHandler.ListDeployments)
				topologyGroup.GET("/:context/deployment/:namespace/:name", topologyHandler.GetDeploymentTopology)
				topologyGroup.GET("/:context/daemonsets", topologyHandler.ListDaemonSets)
				topologyGroup.GET("/:context/daemonset/:namespace/:name", topologyHandler.GetDaemonSetTopology)
				topologyGroup.GET("/:context/jobs", topologyHandler.ListJobs)
				topologyGroup.GET("/:context/job/:namespace/:name", topologyHandler.GetJobTopology)
				topologyGroup.GET("/:context/cronjobs", topologyHandler.ListCronJobs)
				topologyGroup.GET("/:context/cronjob/:namespace/:name", topologyHandler.GetCronJobTopology)
				
				// WebSocket endpoint for real-time updates
				topologyGroup.GET("/ws/:context/:namespace", func(c *gin.Context) {
					context := c.Param("context")
					
					// Try to get clientset, if not connected, try to connect
					clientset, err := manager.GetClientset(context)
					if err != nil {
						// Try to connect to the cluster
						log.Printf("Cluster not connected, attempting to connect: %s", context)
						if connectErr := manager.ConnectToCluster(context); connectErr != nil {
							c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to connect to cluster %s: %v", context, connectErr)})
							return
						}
						// Try again after connecting
						clientset, err = manager.GetClientset(context)
						if err != nil {
							c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get clientset after connecting: %v", err)})
							return
						}
					}
					topology.HandleTopologyWebSocket(clientset)(c)
				})
			} else {
				// Log error but don't crash - topology endpoints won't work
				println("Warning: Topology handler not initialized - topology endpoints will not be available")
			}
		}
		
		// Auth endpoints
		v1.POST("/auth/login", handlers.Login)
	}
}