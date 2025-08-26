package kubernetes

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ResourceLister provides methods to list Kubernetes resources
type ResourceLister struct {
	conn *ClusterConnection
}

// NewResourceLister creates a new resource lister for a cluster connection
func NewResourceLister(conn *ClusterConnection) *ResourceLister {
	return &ResourceLister{conn: conn}
}

// ListPods lists pods in a namespace
func (rl *ResourceLister) ListPods(namespace string) (*corev1.PodList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
}

// GetPod gets a specific pod by name and namespace
func (rl *ResourceLister) GetPod(namespace, name string) (*corev1.Pod, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
}

// ListDeployments lists deployments in a namespace
func (rl *ResourceLister) ListDeployments(namespace string) (*appsv1.DeploymentList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
}

// ListServices lists services in a namespace
func (rl *ResourceLister) ListServices(namespace string) (*corev1.ServiceList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
}

// ListNamespaces lists all namespaces
func (rl *ResourceLister) ListNamespaces() (*corev1.NamespaceList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
}

// ListNodes lists all nodes
func (rl *ResourceLister) ListNodes() (*corev1.NodeList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
}

// ListStatefulSets lists statefulsets in a namespace
func (rl *ResourceLister) ListStatefulSets(namespace string) (*appsv1.StatefulSetList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
}

// ListDaemonSets lists daemonsets in a namespace
func (rl *ResourceLister) ListDaemonSets(namespace string) (*appsv1.DaemonSetList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
}

// ListConfigMaps lists configmaps in a namespace
func (rl *ResourceLister) ListConfigMaps(namespace string) (*corev1.ConfigMapList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
}

// ListSecrets lists secrets in a namespace
func (rl *ResourceLister) ListSecrets(namespace string) (*corev1.SecretList, error) {
	if rl.conn == nil || !rl.conn.Connected {
		return nil, fmt.Errorf("cluster not connected")
	}

	ctx := context.Background()
	return rl.conn.ClientSet.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
}

// GetResourceSummary returns a summary of resources in a namespace
func (rl *ResourceLister) GetResourceSummary(namespace string) (map[string]int, error) {
	summary := make(map[string]int)

	// Get pods
	pods, err := rl.ListPods(namespace)
	if err == nil {
		summary["pods"] = len(pods.Items)
		
		// Count running pods
		running := 0
		for _, pod := range pods.Items {
			if pod.Status.Phase == corev1.PodRunning {
				running++
			}
		}
		summary["pods_running"] = running
	}

	// Get deployments
	deployments, err := rl.ListDeployments(namespace)
	if err == nil {
		summary["deployments"] = len(deployments.Items)
	}

	// Get services
	services, err := rl.ListServices(namespace)
	if err == nil {
		summary["services"] = len(services.Items)
	}

	// Get configmaps
	configmaps, err := rl.ListConfigMaps(namespace)
	if err == nil {
		summary["configmaps"] = len(configmaps.Items)
	}

	// Get secrets
	secrets, err := rl.ListSecrets(namespace)
	if err == nil {
		summary["secrets"] = len(secrets.Items)
	}

	return summary, nil
}