package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/api"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.Default()
	api.SetupRoutes(r)

	log.Printf("Starting server on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}