package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/api"
)

func main() {
	r := gin.Default()

	// Setup all routes including linter routes
	api.SetupRoutes(r)

	port := ":8080"
	log.Printf("Kaptivan backend server starting on port %s", port)
	log.Fatal(r.Run(port))
}
