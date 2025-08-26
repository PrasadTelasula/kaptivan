package topology

import (
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
)

var handler *Handler

// Initialize sets up the topology handler with the cluster manager
func Initialize(manager *kubernetes.ClusterManager) {
	if manager != nil {
		handler = NewHandlerWithManager(manager)
	}
}

// GetHandler returns the initialized handler
func GetHandler() *Handler {
	return handler
}

// SetCluster updates the handler to use a specific cluster
func SetCluster(contextName string, manager *kubernetes.ClusterManager) error {
	conn, err := manager.GetConnection(contextName)
	if err != nil {
		return err
	}
	handler = NewHandler(conn.ClientSet)
	return nil
}