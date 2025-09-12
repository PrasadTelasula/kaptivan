package routes

import (
	"github.com/gin-gonic/gin"
	linterHandlers "github.com/prasad/kaptivan/backend/internal/api/handlers/linter"
	"github.com/prasad/kaptivan/backend/internal/linter/wrapper"
)

// RegisterLinterRoutes registers linter API routes
func RegisterLinterRoutes(router *gin.RouterGroup, linter *wrapper.Linter) {
	handler := linterHandlers.NewHandler(linter)

	api := router.Group("/linter")
	{
		// Core linting endpoints
		api.POST("/lint", handler.LintManifest)
		api.POST("/lint-multiple", handler.LintMultipleManifests)

		// Check management endpoints
		api.GET("/checks", handler.GetAvailableChecks)
		api.GET("/checks/custom", handler.GetCustomChecks)
		api.GET("/checks/:check", handler.GetCheckDetails)

		// Statistics and summary endpoints
		api.GET("/summary", handler.GetLintSummary)
		api.GET("/statistics", handler.GetLintStatistics)
	}
}
