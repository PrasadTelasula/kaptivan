package kubernetes

import (
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

type KubeConfig struct {
	Path     string
	Config   *api.Config
	Clusters []ClusterInfo
}

type ClusterInfo struct {
	Name      string `json:"name"`
	Server    string `json:"server"`
	Context   string `json:"context"`
	Namespace string `json:"namespace"`
	User      string `json:"user"`
	IsCurrent bool   `json:"is_current"`
}

// LoadKubeConfig loads and parses the kubeconfig file
func LoadKubeConfig(path string) (*KubeConfig, error) {
	// If no path provided, use default locations
	if path == "" {
		path = getDefaultKubeConfigPath()
	}

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("kubeconfig file not found at %s", path)
	}

	// Load the kubeconfig
	config, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	// Parse cluster information
	clusters := parseClusterInfo(config)

	return &KubeConfig{
		Path:     path,
		Config:   config,
		Clusters: clusters,
	}, nil
}

// GetDefaultKubeConfigPath returns the default kubeconfig path
func getDefaultKubeConfigPath() string {
	if env := os.Getenv("KUBECONFIG"); env != "" {
		return env
	}
	
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	
	return filepath.Join(home, ".kube", "config")
}

// parseClusterInfo extracts cluster information from the config
func parseClusterInfo(config *api.Config) []ClusterInfo {
	var clusters []ClusterInfo
	currentContext := config.CurrentContext

	for contextName, context := range config.Contexts {
		cluster, exists := config.Clusters[context.Cluster]
		if !exists {
			continue
		}

		clusterInfo := ClusterInfo{
			Name:      context.Cluster,
			Server:    cluster.Server,
			Context:   contextName,
			Namespace: context.Namespace,
			User:      context.AuthInfo,
			IsCurrent: contextName == currentContext,
		}

		if clusterInfo.Namespace == "" {
			clusterInfo.Namespace = "default"
		}

		clusters = append(clusters, clusterInfo)
	}

	return clusters
}

// GetClusterByContext returns a specific cluster by context name
func (kc *KubeConfig) GetClusterByContext(contextName string) (*ClusterInfo, error) {
	for _, cluster := range kc.Clusters {
		if cluster.Context == contextName {
			return &cluster, nil
		}
	}
	return nil, fmt.Errorf("context %s not found", contextName)
}

// GetCurrentCluster returns the current cluster based on current-context
func (kc *KubeConfig) GetCurrentCluster() (*ClusterInfo, error) {
	for _, cluster := range kc.Clusters {
		if cluster.IsCurrent {
			return &cluster, nil
		}
	}
	return nil, fmt.Errorf("no current context set")
}