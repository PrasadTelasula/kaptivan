package api

import (
	"fmt"
	"log"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/api/handlers"
	"github.com/prasad/kaptivan/backend/internal/api/handlers/apidocs"
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
		// Initialize APIDocs handlers
		apidocs.Initialize(manager)
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
		v1.GET("/clusters/info", handlers.GetClusterInfo)
		
		// Pod endpoints (new structured handlers)
		podsGroup := v1.Group("/pods")
		{
			podsGroup.POST("/list", pods.List)
			podsGroup.POST("/list-detailed", pods.ListDetailed) // New endpoint for detailed pod list
			podsGroup.POST("/batch", pods.BatchGet) // New batch endpoint for multiple pod details
			podsGroup.GET("/get", pods.Get)
			podsGroup.GET("/logs", pods.GetLogs)
			podsGroup.GET("/events", pods.GetEvents)
			podsGroup.DELETE("/delete", pods.Delete)
			podsGroup.POST("/exec", pods.Exec)
			podsGroup.GET("/exec/ws", pods.ExecWebSocket)
			podsGroup.GET("/logs/ws", pods.LogsWebSocket)
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
			servicesGroup.DELETE("/:context/:namespace/:name", services.DeleteService)
		}
		
		// Manifest endpoints (new structured handlers)
		manifestGroup := v1.Group("/manifests")
		{
			manifestGroup.POST("/apply", manifests.Apply)
			manifestGroup.POST("/compare", manifests.Compare)
			manifestGroup.POST("/validate", manifests.Validate)
			manifestGroup.GET("/resource", manifests.GetResource)
			manifestGroup.POST("/resource", manifests.UpdateResource)
			manifestGroup.DELETE("/resource", manifests.DeleteResource)
		}
		
		// Topology endpoints
		topologyGroup := v1.Group("/topology")
		{
			topologyGroup.POST("/deployment", topology.GetDeploymentTopology)
			topologyGroup.POST("/daemonset", topology.GetDaemonSetTopology)
			topologyGroup.POST("/job", topology.GetJobTopology)
			topologyGroup.POST("/cronjob", topology.GetCronJobTopology)
		}
		
		// APIDocs endpoints
		apiDocsGroup := v1.Group("/apidocs")
		{
			apiDocsHandler := apidocs.GetHandler()
			
			if apiDocsHandler != nil {
				apiDocsGroup.GET("/groups", apiDocsHandler.GetAPIGroups)
				apiDocsGroup.GET("/resources", apiDocsHandler.GetAPIResources)
				apiDocsGroup.GET("/schema", apiDocsHandler.GetResourceSchema)
				apiDocsGroup.GET("/explain", apiDocsHandler.GetResourceExplain)
				apiDocsGroup.GET("/search", apiDocsHandler.SearchResources)
			} else {
				println("Warning: APIDocs handler not initialized - APIDocs endpoints will not be available")
			}
		}
		
		// Resource endpoints (legacy, will be deprecated)
		resources := v1.Group("/resources")
		{
			resources.POST("/pods", handlers.ListPods)
			resources.POST("/deployments", handlers.ListDeployments)
			resources.POST("/services", handlers.ListServices)
			resources.GET("/namespaces", handlers.ListNamespaces)
			resources.GET("/nodes", handlers.ListNodes)
			resources.GET("/events", handlers.ListEvents)
			resources.POST("/apply", handlers.ApplyManifest)
			resources.POST("/delete", handlers.DeleteResource)
		}
		
		// Test endpoints (only in debug mode)
		if gin.Mode() == gin.DebugMode {
			v1.GET("/test/kubectl", handlers.TestKubectl)
			v1.GET("/test/clusters", handlers.TestClusters)
		}
		
		// Auth endpoints
		v1.POST("/auth/login", handlers.Login)
	}
	
	// Websocket endpoints
	v1.GET("/ws/exec", handlers.WebSocketExec)
	v1.GET("/ws/logs", handlers.WebSocketLogs)
	
	// Catch-all for debugging
	v1.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"error": "Endpoint not found",
			"path":  c.Request.URL.Path,
			"method": c.Request.Method,
			"available_endpoints": []string{
				"/api/v1/clusters",
				"/api/v1/clusters/config",
				"/api/v1/clusters/connect",
				"/api/v1/clusters/disconnect",
				"/api/v1/pods/*",
				"/api/v1/deployments/*",
				"/api/v1/services/*",
				"/api/v1/manifests/*",
				"/api/v1/topology/*",
				"/api/v1/apidocs/*",
				"/api/v1/resources/*",
			},
		})
	})
	
	log.Printf("API routes configured successfully")
}

// Helper function to get the list of available routes
func GetRoutes(r *gin.Engine) []gin.RouteInfo {
	return r.Routes()
}

// Helper function to print routes for debugging
func PrintRoutes(r *gin.Engine) {
	routes := r.Routes()
	fmt.Println("\n=== Registered Routes ===")
	for _, route := range routes {
		fmt.Printf("%-6s %s\n", route.Method, route.Path)
	}
	fmt.Println("========================\n")
}
