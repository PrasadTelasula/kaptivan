package kubernetes

import (
	"context"
	"fmt"
	"sort"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// ClusterConnection represents a connection to a Kubernetes cluster
type ClusterConnection struct {
	Name       string
	Context    string
	Config     *rest.Config
	ClientSet  kubernetes.Interface
	Connected  bool
	LastError  error
}

// ClusterManager manages multiple cluster connections
type ClusterManager struct {
	kubeConfigPath string
	connections    map[string]*ClusterConnection
	mu             sync.RWMutex
}

// NewClusterManager creates a new cluster manager
func NewClusterManager(kubeConfigPath string) *ClusterManager {
	return &ClusterManager{
		kubeConfigPath: kubeConfigPath,
		connections:    make(map[string]*ClusterConnection),
	}
}

// LoadClusters loads all clusters from kubeconfig
func (cm *ClusterManager) LoadClusters() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Load kubeconfig
	kubeConfig, err := LoadKubeConfig(cm.kubeConfigPath)
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	// Create connections for each cluster
	for _, clusterInfo := range kubeConfig.Clusters {
		conn := &ClusterConnection{
			Name:      clusterInfo.Name,
			Context:   clusterInfo.Context,
			Connected: false,
		}
		cm.connections[clusterInfo.Context] = conn
	}

	return nil
}

// ConnectToCluster establishes a connection to a specific cluster
func (cm *ClusterManager) ConnectToCluster(contextName string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	conn, exists := cm.connections[contextName]
	if !exists {
		return fmt.Errorf("cluster context %s not found", contextName)
	}

	// Build config from kubeconfig
	config, err := cm.buildConfigForContext(contextName)
	if err != nil {
		conn.LastError = err
		conn.Connected = false
		return fmt.Errorf("failed to build config for context %s: %w", contextName, err)
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		conn.LastError = err
		conn.Connected = false
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	// Test connection by getting server version
	_, err = clientset.Discovery().ServerVersion()
	if err != nil {
		conn.LastError = err
		conn.Connected = false
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}

	// Update connection
	conn.Config = config
	conn.ClientSet = clientset
	conn.Connected = true
	conn.LastError = nil

	return nil
}

// DisconnectFromCluster closes a connection to a specific cluster
func (cm *ClusterManager) DisconnectFromCluster(contextName string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	conn, exists := cm.connections[contextName]
	if !exists {
		return fmt.Errorf("cluster context %s not found", contextName)
	}

	conn.Connected = false
	conn.ClientSet = nil
	conn.Config = nil

	return nil
}

// GetConnection returns a specific cluster connection
func (cm *ClusterManager) GetConnection(contextName string) (*ClusterConnection, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	conn, exists := cm.connections[contextName]
	if !exists {
		return nil, fmt.Errorf("cluster context %s not found", contextName)
	}

	if !conn.Connected {
		return nil, fmt.Errorf("cluster %s is not connected", contextName)
	}

	return conn, nil
}

// GetClientset returns the clientset for a specific context
func (cm *ClusterManager) GetClientset(contextName string) (kubernetes.Interface, error) {
	conn, err := cm.GetConnection(contextName)
	if err != nil {
		return nil, err
	}
	return conn.ClientSet, nil
}

// GetAllConnections returns all cluster connections
func (cm *ClusterManager) GetAllConnections() map[string]*ClusterConnection {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	// Create a copy to avoid race conditions
	result := make(map[string]*ClusterConnection)
	for k, v := range cm.connections {
		result[k] = v
	}
	return result
}

// ListClusters returns information about all clusters
func (cm *ClusterManager) ListClusters() []ClusterStatus {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var clusters []ClusterStatus
	for contextName, conn := range cm.connections {
		status := ClusterStatus{
			Name:      conn.Name,
			Context:   contextName,
			Connected: conn.Connected,
		}
		
		if conn.LastError != nil {
			errMsg := conn.LastError.Error()
			status.Error = &errMsg
		}
		
		clusters = append(clusters, status)
	}
	
	// Sort clusters by name to maintain consistent order
	sort.Slice(clusters, func(i, j int) bool {
		return clusters[i].Name < clusters[j].Name
	})
	
	return clusters
}

// ClusterStatus represents the status of a cluster
type ClusterStatus struct {
	Name      string  `json:"name"`
	Context   string  `json:"context"`
	Connected bool    `json:"connected"`
	Error     *string `json:"error,omitempty"`
}

// buildConfigForContext builds a rest.Config for a specific context
func (cm *ClusterManager) buildConfigForContext(contextName string) (*rest.Config, error) {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if cm.kubeConfigPath != "" {
		loadingRules.ExplicitPath = cm.kubeConfigPath
	}

	configOverrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextName,
	}

	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules,
		configOverrides,
	)

	config, err := kubeConfig.ClientConfig()
	if err != nil {
		return nil, err
	}

	// Set reasonable defaults for timeouts
	config.QPS = 100
	config.Burst = 100

	return config, nil
}

// TestConnection tests if a cluster is reachable
func (cm *ClusterManager) TestConnection(contextName string) error {
	conn, err := cm.GetConnection(contextName)
	if err != nil {
		return err
	}

	ctx := context.Background()
	_, err = conn.ClientSet.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	return err
}