package namespaces

import (
	"context"
	"net/http"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Handler handles namespace comparison requests
type Handler struct {
	manager    *kubernetes.ClusterManager
	comparator *Comparator
}

// NewHandler creates a new namespace handler
func NewHandler(manager *kubernetes.ClusterManager) *Handler {
	return &Handler{
		manager:    manager,
		comparator: NewComparator(),
	}
}

// GetNamespaceSnapshot handles GET /api/v1/namespaces/snapshot
func (h *Handler) GetNamespaceSnapshot(c *gin.Context) {
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")
	
	if cluster == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "cluster and namespace parameters are required",
		})
		return
	}
	
	// Get clientset for the cluster
	clientset, err := h.manager.GetClientset(cluster)
	if err != nil {
		// Try to connect to the cluster
		if connectErr := h.manager.ConnectToCluster(cluster); connectErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to connect to cluster: " + connectErr.Error(),
			})
			return
		}
		// Try again after connecting
		clientset, err = h.manager.GetClientset(cluster)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to get clientset: " + err.Error(),
			})
			return
		}
	}
	
	// Create collector and collect metrics
	collector := NewCollector(clientset)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	snapshot, err := collector.CollectNamespaceSnapshot(ctx, cluster, namespace)
	if err != nil {
		// Return partial data if available
		if snapshot != nil {
			c.JSON(http.StatusPartialContent, gin.H{
				"snapshot": snapshot,
				"warning":  "Partial data collected: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to collect namespace snapshot: " + err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"snapshot": snapshot,
	})
}

// CompareNamespaces handles POST /api/v1/namespaces/compare
func (h *Handler) CompareNamespaces(c *gin.Context) {
	var req ComparisonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}
	
	// Collect snapshots for both namespaces in parallel
	type snapshotResult struct {
		snapshot *NamespaceSnapshot
		err      error
		which    string
	}
	
	results := make(chan snapshotResult, 2)
	
	// Collect snapshot A
	go func() {
		clientset, err := h.manager.GetClientset(req.ClusterA)
		if err != nil {
			// Try to connect
			if connectErr := h.manager.ConnectToCluster(req.ClusterA); connectErr != nil {
				results <- snapshotResult{nil, connectErr, "A"}
				return
			}
			clientset, err = h.manager.GetClientset(req.ClusterA)
			if err != nil {
				results <- snapshotResult{nil, err, "A"}
				return
			}
		}
		
		collector := NewCollector(clientset)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		
		snapshot, err := collector.CollectNamespaceSnapshot(ctx, req.ClusterA, req.NamespaceA)
		results <- snapshotResult{snapshot, err, "A"}
	}()
	
	// Collect snapshot B
	go func() {
		clientset, err := h.manager.GetClientset(req.ClusterB)
		if err != nil {
			// Try to connect
			if connectErr := h.manager.ConnectToCluster(req.ClusterB); connectErr != nil {
				results <- snapshotResult{nil, connectErr, "B"}
				return
			}
			clientset, err = h.manager.GetClientset(req.ClusterB)
			if err != nil {
				results <- snapshotResult{nil, err, "B"}
				return
			}
		}
		
		collector := NewCollector(clientset)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		
		snapshot, err := collector.CollectNamespaceSnapshot(ctx, req.ClusterB, req.NamespaceB)
		results <- snapshotResult{snapshot, err, "B"}
	}()
	
	// Wait for both results
	var snapshotA, snapshotB *NamespaceSnapshot
	var errors []string
	
	for i := 0; i < 2; i++ {
		result := <-results
		if result.err != nil {
			errors = append(errors, "Snapshot "+result.which+": "+result.err.Error())
		}
		if result.which == "A" {
			snapshotA = result.snapshot
		} else {
			snapshotB = result.snapshot
		}
	}
	
	// Check if we have both snapshots
	if snapshotA == nil || snapshotB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Failed to collect snapshots",
			"details":   errors,
			"snapshotA": snapshotA,
			"snapshotB": snapshotB,
		})
		return
	}
	
	// Generate comparison
	comparisonRows := h.comparator.Compare(snapshotA, snapshotB)
	
	response := ComparisonResponse{
		SnapshotA: snapshotA,
		SnapshotB: snapshotB,
		Rows:      comparisonRows,
	}
	
	if len(errors) > 0 {
		c.JSON(http.StatusPartialContent, gin.H{
			"comparison": response,
			"warnings":   errors,
		})
		return
	}
	
	c.JSON(http.StatusOK, response)
}

// ListNamespaces handles GET /api/v1/namespaces/list
func (h *Handler) ListNamespaces(c *gin.Context) {
	cluster := c.Query("cluster")
	if cluster == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "cluster parameter is required",
		})
		return
	}
	
	// Get clientset for the cluster
	clientset, err := h.manager.GetClientset(cluster)
	if err != nil {
		// Try to connect to the cluster
		if connectErr := h.manager.ConnectToCluster(cluster); connectErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to connect to cluster: " + connectErr.Error(),
			})
			return
		}
		// Try again after connecting
		clientset, err = h.manager.GetClientset(cluster)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to get clientset: " + err.Error(),
			})
			return
		}
	}
	
	// List namespaces
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list namespaces: " + err.Error(),
		})
		return
	}
	
	// Extract namespace names
	var namespaceNames []string
	for _, ns := range namespaces.Items {
		namespaceNames = append(namespaceNames, ns.Name)
	}
	
	c.JSON(http.StatusOK, gin.H{
		"namespaces": namespaceNames,
		"total":      len(namespaceNames),
	})
}