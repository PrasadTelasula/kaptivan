package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"service": "kaptivan-backend",
		})
	})

	// API routes
	api := r.Group("/api/v1")
	{
		// Cluster endpoints
		api.GET("/clusters", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"clusters": []string{},
				"message": "Cluster listing endpoint - to be implemented",
			})
		})

		// Resources endpoints
		api.GET("/resources/:type", func(c *gin.Context) {
			resourceType := c.Param("type")
			c.JSON(http.StatusOK, gin.H{
				"type": resourceType,
				"resources": []string{},
				"message": "Resource listing endpoint - to be implemented",
			})
		})
	}

	port := ":8080"
	fmt.Printf("Kaptivan backend server starting on port %s\n", port)
	log.Fatal(r.Run(port))
}