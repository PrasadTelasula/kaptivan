package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
)

var clusterManager *kubernetes.ClusterManager

// InitializeClusterManager initializes the cluster manager
func InitializeClusterManager() (*kubernetes.ClusterManager, error) {
	clusterManager = kubernetes.NewClusterManager("")
	err := clusterManager.LoadClusters()
	return clusterManager, err
}

// ListClustersFromConfig lists all clusters from kubeconfig
func ListClustersFromConfig(c *gin.Context) {
	if clusterManager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cluster manager not initialized",
		})
		return
	}

	clusters := clusterManager.ListClusters()
	c.JSON(http.StatusOK, gin.H{
		"clusters": clusters,
		"total":    len(clusters),
	})
}

// ConnectCluster connects to a specific cluster
func ConnectCluster(c *gin.Context) {
	var req struct {
		Context string `json:"context" binding:"required"`
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

	if err := clusterManager.ConnectToCluster(req.Context); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully connected to cluster",
		"context": req.Context,
	})
}

// DisconnectCluster disconnects from a specific cluster
func DisconnectCluster(c *gin.Context) {
	var req struct {
		Context string `json:"context" binding:"required"`
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

	if err := clusterManager.DisconnectFromCluster(req.Context); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully disconnected from cluster",
		"context": req.Context,
	})
}

// GetClusterInfo gets information about a specific cluster
func GetClusterInfo(c *gin.Context) {
	context := c.Query("context")
	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Context parameter is required",
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
			"error": err.Error(),
		})
		return
	}

	// Get server version for additional info
	version, err := conn.ClientSet.Discovery().ServerVersion()
	var versionInfo map[string]string
	if err == nil {
		versionInfo = map[string]string{
			"major":        version.Major,
			"minor":        version.Minor,
			"gitVersion":   version.GitVersion,
			"platform":     version.Platform,
			"goVersion":    version.GoVersion,
			"gitCommit":    version.GitCommit,
			"buildDate":    version.BuildDate,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"context":   context,
		"name":      conn.Name,
		"connected": conn.Connected,
		"version":   versionInfo,
	})
}

// GetClusterManager returns the cluster manager instance (for use by other handlers)
func GetClusterManager() *kubernetes.ClusterManager {
	return clusterManager
}