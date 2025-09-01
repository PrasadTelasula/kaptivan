package rbac

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	v1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type Handler struct {
	manager *kubernetes.ClusterManager
}

func NewHandler(manager *kubernetes.ClusterManager) *Handler {
	return &Handler{
		manager: manager,
	}
}

// RBACResource represents a complete RBAC resource with all related data
type RBACResource struct {
	Roles               []rbacv1.Role               `json:"roles"`
	ClusterRoles        []rbacv1.ClusterRole        `json:"clusterRoles"`
	RoleBindings        []rbacv1.RoleBinding        `json:"roleBindings"`
	ClusterRoleBindings []rbacv1.ClusterRoleBinding `json:"clusterRoleBindings"`
	ServiceAccounts     []v1.ServiceAccount         `json:"serviceAccounts"`
}

// RBACGraph represents the graph structure for visualization
type RBACGraph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Node struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // "role", "clusterRole", "subject", "serviceAccount"
	Label    string                 `json:"label"`
	Data     map[string]interface{} `json:"data"`
	Position Position               `json:"position"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Edge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"` // "roleBinding", "clusterRoleBinding"
	Label  string `json:"label"`
}

// GetRBACResources fetches all RBAC resources from the cluster
func (h *Handler) GetRBACResources(c *gin.Context) {
	clusterContext := c.Query("context")
	namespace := c.Query("namespace") // Optional, for filtering

	if clusterContext == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	client, err := h.manager.GetClientset(clusterContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get client: %v", err)})
		return
	}

	ctx := context.Background()
	resources := RBACResource{}

	// Fetch Roles (namespace-scoped)
	if namespace != "" {
		roles, err := client.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.Roles = roles.Items
		}

		roleBindings, err := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.RoleBindings = roleBindings.Items
		}

		serviceAccounts, err := client.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.ServiceAccounts = serviceAccounts.Items
		}
	} else {
		// Fetch from all namespaces
		roles, err := client.RbacV1().Roles("").List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.Roles = roles.Items
		}

		roleBindings, err := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.RoleBindings = roleBindings.Items
		}

		serviceAccounts, err := client.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{})
		if err == nil {
			resources.ServiceAccounts = serviceAccounts.Items
		}
	}

	// Fetch ClusterRoles and ClusterRoleBindings (cluster-scoped)
	clusterRoles, err := client.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err == nil {
		resources.ClusterRoles = clusterRoles.Items
	}

	clusterRoleBindings, err := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err == nil {
		resources.ClusterRoleBindings = clusterRoleBindings.Items
	}

	c.JSON(http.StatusOK, resources)
}

// GetRBACGraph returns RBAC data formatted for graph visualization
func (h *Handler) GetRBACGraph(c *gin.Context) {
	clusterContext := c.Query("context")
	namespace := c.Query("namespace")
	filterType := c.Query("filterType") // "user", "serviceAccount", "role"
	filterValue := c.Query("filterValue")

	if clusterContext == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	client, err := h.manager.GetClientset(clusterContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get client: %v", err)})
		return
	}

	ctx := context.Background()
	graph := RBACGraph{
		Nodes: []Node{},
		Edges: []Edge{},
	}

	nodeMap := make(map[string]bool)
	xOffset := 0.0
	yOffset := 0.0

	// Helper function to add a node
	addNode := func(id, nodeType, label string, data map[string]interface{}) {
		if !nodeMap[id] {
			nodeMap[id] = true
			node := Node{
				ID:    id,
				Type:  nodeType,
				Label: label,
				Data:  data,
				Position: Position{
					X: xOffset,
					Y: yOffset,
				},
			}
			graph.Nodes = append(graph.Nodes, node)
			xOffset += 200
			if xOffset > 800 {
				xOffset = 0
				yOffset += 150
			}
		}
	}

	// Fetch and process ClusterRoles
	clusterRoles, _ := client.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	for _, cr := range clusterRoles.Items {
		if filterType == "role" && filterValue != "" && !strings.Contains(cr.Name, filterValue) {
			continue
		}
		
		// Skip system roles unless specifically requested
		if !strings.HasPrefix(cr.Name, "system:") || filterType == "role" {
			addNode(
				fmt.Sprintf("cr-%s", cr.Name),
				"clusterRole",
				cr.Name,
				map[string]interface{}{
					"rules":      len(cr.Rules),
					"namespace": "cluster-wide",
				},
			)
		}
	}

	// Fetch and process Roles
	var roles []rbacv1.Role
	if namespace != "" {
		roleList, _ := client.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
		roles = roleList.Items
	} else {
		roleList, _ := client.RbacV1().Roles("").List(ctx, metav1.ListOptions{})
		roles = roleList.Items
	}

	for _, r := range roles {
		if filterType == "role" && filterValue != "" && !strings.Contains(r.Name, filterValue) {
			continue
		}
		
		addNode(
			fmt.Sprintf("r-%s-%s", r.Namespace, r.Name),
			"role",
			r.Name,
			map[string]interface{}{
				"rules":     len(r.Rules),
				"namespace": r.Namespace,
			},
		)
	}

	// Fetch and process ClusterRoleBindings
	clusterRoleBindings, _ := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	for _, crb := range clusterRoleBindings.Items {
		roleNodeID := fmt.Sprintf("cr-%s", crb.RoleRef.Name)
		
		for _, subject := range crb.Subjects {
			if filterType != "" && filterType != "role" {
				if filterType == "user" && subject.Kind != "User" {
					continue
				}
				if filterType == "serviceAccount" && subject.Kind != "ServiceAccount" {
					continue
				}
				if filterValue != "" && !strings.Contains(subject.Name, filterValue) {
					continue
				}
			}

			subjectID := fmt.Sprintf("%s-%s", strings.ToLower(subject.Kind), subject.Name)
			if subject.Namespace != "" {
				subjectID = fmt.Sprintf("%s-%s-%s", strings.ToLower(subject.Kind), subject.Namespace, subject.Name)
			}

			addNode(
				subjectID,
				strings.ToLower(subject.Kind),
				subject.Name,
				map[string]interface{}{
					"kind":      subject.Kind,
					"namespace": subject.Namespace,
				},
			)

			// Add edge
			edge := Edge{
				ID:     fmt.Sprintf("crb-%s-%s", crb.Name, subjectID),
				Source: subjectID,
				Target: roleNodeID,
				Type:   "clusterRoleBinding",
				Label:  crb.Name,
			}
			graph.Edges = append(graph.Edges, edge)
		}
	}

	// Fetch and process RoleBindings
	var roleBindings []rbacv1.RoleBinding
	if namespace != "" {
		rbList, _ := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	} else {
		rbList, _ := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	}

	for _, rb := range roleBindings {
		var roleNodeID string
		if rb.RoleRef.Kind == "ClusterRole" {
			roleNodeID = fmt.Sprintf("cr-%s", rb.RoleRef.Name)
		} else {
			roleNodeID = fmt.Sprintf("r-%s-%s", rb.Namespace, rb.RoleRef.Name)
		}

		for _, subject := range rb.Subjects {
			if filterType != "" && filterType != "role" {
				if filterType == "user" && subject.Kind != "User" {
					continue
				}
				if filterType == "serviceAccount" && subject.Kind != "ServiceAccount" {
					continue
				}
				if filterValue != "" && !strings.Contains(subject.Name, filterValue) {
					continue
				}
			}

			subjectID := fmt.Sprintf("%s-%s-%s", strings.ToLower(subject.Kind), rb.Namespace, subject.Name)
			
			addNode(
				subjectID,
				strings.ToLower(subject.Kind),
				subject.Name,
				map[string]interface{}{
					"kind":      subject.Kind,
					"namespace": rb.Namespace,
				},
			)

			// Add edge
			edge := Edge{
				ID:     fmt.Sprintf("rb-%s-%s", rb.Name, subjectID),
				Source: subjectID,
				Target: roleNodeID,
				Type:   "roleBinding",
				Label:  rb.Name,
			}
			graph.Edges = append(graph.Edges, edge)
		}
	}

	c.JSON(http.StatusOK, graph)
}

// GetPermissionMatrix returns a matrix view of subjects and their permissions
func (h *Handler) GetPermissionMatrix(c *gin.Context) {
	clusterContext := c.Query("context")
	namespace := c.Query("namespace")

	if clusterContext == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	client, err := h.manager.GetClientset(clusterContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get client: %v", err)})
		return
	}

	ctx := context.Background()
	
	type Permission struct {
		Subject   string   `json:"subject"`
		Namespace string   `json:"namespace"`
		Role      string   `json:"role"`
		Verbs     []string `json:"verbs"`
		Resources []string `json:"resources"`
	}

	permissions := []Permission{}

	// Process ClusterRoleBindings
	clusterRoleBindings, _ := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	for _, crb := range clusterRoleBindings.Items {
		// Get the ClusterRole
		clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		for _, subject := range crb.Subjects {
			for _, rule := range clusterRole.Rules {
				perm := Permission{
					Subject:   fmt.Sprintf("%s:%s", subject.Kind, subject.Name),
					Namespace: "cluster-wide",
					Role:      crb.RoleRef.Name,
					Verbs:     rule.Verbs,
					Resources: rule.Resources,
				}
				permissions = append(permissions, perm)
			}
		}
	}

	// Process RoleBindings
	var roleBindings []rbacv1.RoleBinding
	if namespace != "" {
		rbList, _ := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	} else {
		rbList, _ := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	}

	for _, rb := range roleBindings {
		var rules []rbacv1.PolicyRule

		if rb.RoleRef.Kind == "ClusterRole" {
			clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
			if err == nil {
				rules = clusterRole.Rules
			}
		} else {
			role, err := client.RbacV1().Roles(rb.Namespace).Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
			if err == nil {
				rules = role.Rules
			}
		}

		for _, subject := range rb.Subjects {
			for _, rule := range rules {
				perm := Permission{
					Subject:   fmt.Sprintf("%s:%s", subject.Kind, subject.Name),
					Namespace: rb.Namespace,
					Role:      rb.RoleRef.Name,
					Verbs:     rule.Verbs,
					Resources: rule.Resources,
				}
				permissions = append(permissions, perm)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
	})
}

// GetRoleDetails returns detailed information about a specific role
func (h *Handler) GetRoleDetails(c *gin.Context) {
	clusterContext := c.Query("context")
	roleName := c.Query("name")
	roleType := c.Query("type") // "role" or "clusterRole"
	namespace := c.Query("namespace")

	if clusterContext == "" || roleName == "" || roleType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, name, and type are required"})
		return
	}

	client, err := h.manager.GetClientset(clusterContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get client: %v", err)})
		return
	}

	ctx := context.Background()

	if roleType == "clusterRole" {
		clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, roleName, metav1.GetOptions{})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("ClusterRole not found: %v", err)})
			return
		}

		// Find bindings for this ClusterRole
		bindings := []interface{}{}
		clusterRoleBindings, _ := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
		for _, crb := range clusterRoleBindings.Items {
			if crb.RoleRef.Name == roleName {
				bindings = append(bindings, crb)
			}
		}

		roleBindings, _ := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
		for _, rb := range roleBindings.Items {
			if rb.RoleRef.Kind == "ClusterRole" && rb.RoleRef.Name == roleName {
				bindings = append(bindings, rb)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"role":     clusterRole,
			"bindings": bindings,
		})
	} else {
		if namespace == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is required for Role"})
			return
		}

		role, err := client.RbacV1().Roles(namespace).Get(ctx, roleName, metav1.GetOptions{})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Role not found: %v", err)})
			return
		}

		// Find bindings for this Role
		bindings := []rbacv1.RoleBinding{}
		roleBindings, _ := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		for _, rb := range roleBindings.Items {
			if rb.RoleRef.Kind == "Role" && rb.RoleRef.Name == roleName {
				bindings = append(bindings, rb)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"role":     role,
			"bindings": bindings,
		})
	}
}

// GetSubjectPermissions returns all permissions for a specific subject
func (h *Handler) GetSubjectPermissions(c *gin.Context) {
	clusterContext := c.Query("context")
	subjectName := c.Query("name")
	subjectKind := c.Query("kind") // "User", "Group", "ServiceAccount"
	namespace := c.Query("namespace")

	if clusterContext == "" || subjectName == "" || subjectKind == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context, name, and kind are required"})
		return
	}

	client, err := h.manager.GetClientset(clusterContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get client: %v", err)})
		return
	}

	ctx := context.Background()
	
	type SubjectPermission struct {
		Role      string                 `json:"role"`
		RoleType  string                 `json:"roleType"`
		Namespace string                 `json:"namespace"`
		Rules     []rbacv1.PolicyRule    `json:"rules"`
		Binding   map[string]interface{} `json:"binding"`
	}

	permissions := []SubjectPermission{}

	// Check ClusterRoleBindings
	clusterRoleBindings, _ := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	for _, crb := range clusterRoleBindings.Items {
		for _, subject := range crb.Subjects {
			if subject.Kind == subjectKind && subject.Name == subjectName {
				if namespace == "" || subject.Namespace == namespace {
					// Get the ClusterRole
					clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
					if err == nil {
						perm := SubjectPermission{
							Role:      crb.RoleRef.Name,
							RoleType:  "ClusterRole",
							Namespace: "cluster-wide",
							Rules:     clusterRole.Rules,
							Binding: map[string]interface{}{
								"name": crb.Name,
								"type": "ClusterRoleBinding",
							},
						}
						permissions = append(permissions, perm)
					}
				}
			}
		}
	}

	// Check RoleBindings
	var roleBindings []rbacv1.RoleBinding
	if namespace != "" {
		rbList, _ := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	} else {
		rbList, _ := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
		roleBindings = rbList.Items
	}

	for _, rb := range roleBindings {
		for _, subject := range rb.Subjects {
			if subject.Kind == subjectKind && subject.Name == subjectName {
				var rules []rbacv1.PolicyRule
				roleType := rb.RoleRef.Kind

				if rb.RoleRef.Kind == "ClusterRole" {
					clusterRole, err := client.RbacV1().ClusterRoles().Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
					if err == nil {
						rules = clusterRole.Rules
					}
				} else {
					role, err := client.RbacV1().Roles(rb.Namespace).Get(ctx, rb.RoleRef.Name, metav1.GetOptions{})
					if err == nil {
						rules = role.Rules
					}
				}

				perm := SubjectPermission{
					Role:      rb.RoleRef.Name,
					RoleType:  roleType,
					Namespace: rb.Namespace,
					Rules:     rules,
					Binding: map[string]interface{}{
						"name": rb.Name,
						"type": "RoleBinding",
					},
				}
				permissions = append(permissions, perm)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"subject":     subjectName,
		"kind":        subjectKind,
		"permissions": permissions,
	})
}