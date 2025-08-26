package topology

import (
	"time"
)

// K8sStatus represents the health status of a resource
type K8sStatus string

const (
	StatusHealthy K8sStatus = "Healthy"
	StatusWarning K8sStatus = "Warning"
	StatusError   K8sStatus = "Error"
	StatusUnknown K8sStatus = "Unknown"
)

// PodPhase represents the phase of a pod
type PodPhase string

const (
	PodPending            PodPhase = "Pending"
	PodRunning            PodPhase = "Running"
	PodSucceeded          PodPhase = "Succeeded"
	PodFailed             PodPhase = "Failed"
	PodUnknown            PodPhase = "Unknown"
	PodTerminating        PodPhase = "Terminating"
	PodCrashLoopBackOff   PodPhase = "CrashLoopBackOff"
)

// ResourceRequirements represents container resource requirements
type ResourceRequirements struct {
	Limits   ResourceList `json:"limits,omitempty"`
	Requests ResourceList `json:"requests,omitempty"`
}

// ResourceList represents a list of resources
type ResourceList struct {
	CPU    string `json:"cpu,omitempty"`
	Memory string `json:"memory,omitempty"`
}

// ContainerRef represents a container within a pod
type ContainerRef struct {
	Name         string                `json:"name"`
	Image        string                `json:"image"`
	Ready        bool                  `json:"ready"`
	RestartCount int32                 `json:"restartCount,omitempty"`
	State        string                `json:"state,omitempty"`
	Reason       string                `json:"reason,omitempty"`
	StartTime    *time.Time            `json:"startTime,omitempty"`
	Resources    *ResourceRequirements `json:"resources,omitempty"`
	Ports        []ContainerPort       `json:"ports,omitempty"`
	Mounts       []string              `json:"mounts,omitempty"`
}

// ContainerPort represents a container port
type ContainerPort struct {
	Name          string `json:"name,omitempty"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol,omitempty"`
}

// PodRef represents a pod reference
type PodRef struct {
	Name            string           `json:"name"`
	Phase           PodPhase         `json:"phase"`
	Containers      []ContainerRef   `json:"containers"`
	NodeName        string           `json:"nodeName,omitempty"`
	HostIP          string           `json:"hostIP,omitempty"`
	PodIP           string           `json:"podIP,omitempty"`
	QosClass        string           `json:"qosClass,omitempty"`
	StartTime       *time.Time       `json:"startTime,omitempty"`
	OwnerReferences []OwnerReference `json:"ownerReferences,omitempty"`
	Labels          map[string]string `json:"labels,omitempty"`
}

// OwnerReference represents an owner reference for a Kubernetes resource
type OwnerReference struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// ReplicaSetRef represents a ReplicaSet reference
type ReplicaSetRef struct {
	Name               string     `json:"name"`
	Desired            int32      `json:"desired"`
	Ready              int32      `json:"ready"`
	Available          int32      `json:"available,omitempty"`
	CreationTimestamp  *time.Time `json:"creationTimestamp,omitempty"`
	Generation int64    `json:"generation,omitempty"`
	Pods       []PodRef `json:"pods"`
}

// ServiceRef represents a Service reference
type ServiceRef struct {
	Name              string              `json:"name"`
	Type              string              `json:"type"`
	ClusterIP         string              `json:"clusterIP,omitempty"`
	ExternalIPs       []string            `json:"externalIPs,omitempty"`
	Ports             []ServicePort       `json:"ports"`
	Selector          map[string]string   `json:"selector,omitempty"`
	CreationTimestamp *time.Time          `json:"creationTimestamp,omitempty"`
}

// ServicePort represents a service port
type ServicePort struct {
	Name       string `json:"name,omitempty"`
	Port       int32  `json:"port"`
	TargetPort string `json:"targetPort"`
	Protocol   string `json:"protocol"`
	NodePort   int32  `json:"nodePort,omitempty"`
}

// SecretRef represents a Secret reference
type SecretRef struct {
	Name              string            `json:"name"`
	Type              string            `json:"type,omitempty"`
	MountedAt         []string          `json:"mountedAt,omitempty"`
	Data              map[string]string `json:"data,omitempty"`
	KeysUsed          []string          `json:"keysUsed,omitempty"`  // Which keys are actually referenced
	Immutable         bool              `json:"immutable,omitempty"`
	CreationTimestamp *time.Time        `json:"creationTimestamp,omitempty"`
}

// ConfigMapRef represents a ConfigMap reference
type ConfigMapRef struct {
	Name              string            `json:"name"`
	MountedAt         []string          `json:"mountedAt,omitempty"`
	Data              map[string]string `json:"data,omitempty"`
	KeysUsed          []string          `json:"keysUsed,omitempty"`  // Which keys are actually referenced
	Immutable         bool              `json:"immutable,omitempty"`
	CreationTimestamp *time.Time        `json:"creationTimestamp,omitempty"`
}

// ServiceAccountRef represents a ServiceAccount reference
type ServiceAccountRef struct {
	Name                         string   `json:"name"`
	AutomountServiceAccountToken *bool    `json:"automountServiceAccountToken,omitempty"`
	Secrets                      []string `json:"secrets,omitempty"`
}

// DeploymentInfo represents deployment metadata
type DeploymentInfo struct {
	Name              string            `json:"name"`
	Replicas          int32             `json:"replicas"`
	Available         int32             `json:"available"`
	Ready             int32             `json:"ready,omitempty"`
	Updated           int32             `json:"updated,omitempty"`
	Revision          int64             `json:"revision,omitempty"`
	Status            K8sStatus         `json:"status"`
	Labels            map[string]string `json:"labels,omitempty"`
	Strategy          string            `json:"strategy,omitempty"`
	Conditions        []Condition       `json:"conditions,omitempty"`
	CreationTimestamp *time.Time        `json:"creationTimestamp,omitempty"`
}

// Condition represents a deployment condition
type Condition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

// EndpointsRef represents an Endpoints resource
type EndpointsRef struct {
	Name      string            `json:"name"`
	Addresses []EndpointAddress `json:"addresses"`
	Ports     []EndpointPort    `json:"ports"`
}

// EndpointAddress represents an endpoint address
type EndpointAddress struct {
	IP        string             `json:"ip"`
	NodeName  string             `json:"nodeName,omitempty"`
	TargetRef *EndpointTargetRef `json:"targetRef,omitempty"`
}

// EndpointTargetRef represents a reference to a target
type EndpointTargetRef struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// EndpointPort represents an endpoint port
type EndpointPort struct {
	Name     string `json:"name,omitempty"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

// RoleRef represents a Role or ClusterRole
type RoleRef struct {
	Name      string       `json:"name"`
	Namespace string       `json:"namespace,omitempty"` // empty for ClusterRole
	Rules     []PolicyRule `json:"rules"`
}

// PolicyRule represents a policy rule
type PolicyRule struct {
	APIGroups     []string `json:"apiGroups,omitempty"`
	Resources     []string `json:"resources,omitempty"`
	Verbs         []string `json:"verbs"`
	ResourceNames []string `json:"resourceNames,omitempty"`
}

// RoleBindingRef represents a RoleBinding or ClusterRoleBinding
type RoleBindingRef struct {
	Name      string      `json:"name"`
	Namespace string      `json:"namespace,omitempty"` // empty for ClusterRoleBinding
	RoleRef   RoleRefInfo `json:"roleRef"`
	Subjects  []Subject   `json:"subjects"`
}

// RoleRefInfo represents a reference to a role
type RoleRefInfo struct {
	APIGroup string `json:"apiGroup"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// Subject represents a subject in a binding
type Subject struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
}

// DeploymentTopology represents the complete topology of a deployment
type DeploymentTopology struct {
	Namespace           string             `json:"namespace"`
	Deployment          DeploymentInfo     `json:"deployment"`
	Services            []ServiceRef       `json:"services"`
	Endpoints           []EndpointsRef     `json:"endpoints"`
	ReplicaSets         []ReplicaSetRef    `json:"replicasets"`
	Secrets             []SecretRef        `json:"secrets"`
	ConfigMaps          []ConfigMapRef     `json:"configmaps"`
	ServiceAccount      *ServiceAccountRef `json:"serviceAccount,omitempty"`
	Roles               []RoleRef          `json:"roles,omitempty"`
	RoleBindings        []RoleBindingRef   `json:"roleBindings,omitempty"`
	ClusterRoles        []RoleRef          `json:"clusterRoles,omitempty"`
	ClusterRoleBindings []RoleBindingRef   `json:"clusterRoleBindings,omitempty"`
}

// ListDeploymentsResponse represents the response for listing deployments
type ListDeploymentsResponse struct {
	Deployments []DeploymentSummary `json:"deployments"`
}

// DeploymentSummary represents a summary of a deployment
type DeploymentSummary struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Replicas  int32  `json:"replicas"`
	Ready     int32  `json:"ready"`
}

// DaemonSetInfo represents daemonset metadata
type DaemonSetInfo struct {
	Name                      string            `json:"name"`
	DesiredNumberScheduled    int32             `json:"desiredNumberScheduled"`
	CurrentNumberScheduled    int32             `json:"currentNumberScheduled"`
	NumberReady               int32             `json:"numberReady"`
	NumberAvailable           int32             `json:"numberAvailable,omitempty"`
	NumberMisscheduled        int32             `json:"numberMisscheduled,omitempty"`
	UpdatedNumberScheduled    int32             `json:"updatedNumberScheduled,omitempty"`
	Status                    K8sStatus         `json:"status"`
	Labels                    map[string]string `json:"labels,omitempty"`
	UpdateStrategy            string            `json:"updateStrategy,omitempty"`
	NodeSelector              map[string]string `json:"nodeSelector,omitempty"`
	Conditions                []Condition       `json:"conditions,omitempty"`
	CreationTimestamp         *time.Time        `json:"creationTimestamp,omitempty"`
}

// DaemonSetTopology represents the complete topology of a daemonset
type DaemonSetTopology struct {
	Namespace           string             `json:"namespace"`
	DaemonSet           DaemonSetInfo      `json:"daemonset"`
	Pods                []PodRef           `json:"pods,omitempty"`
	Services            []ServiceRef       `json:"services,omitempty"`
	Endpoints           []EndpointsRef     `json:"endpoints,omitempty"`
	Secrets             []SecretRef        `json:"secrets,omitempty"`
	ConfigMaps          []ConfigMapRef     `json:"configmaps,omitempty"`
	ServiceAccount      *ServiceAccountRef `json:"serviceAccount,omitempty"`
	Roles               []RoleRef          `json:"roles,omitempty"`
	RoleBindings        []RoleBindingRef   `json:"roleBindings,omitempty"`
	ClusterRoles        []RoleRef          `json:"clusterRoles,omitempty"`
	ClusterRoleBindings []RoleBindingRef   `json:"clusterRoleBindings,omitempty"`
}

// DaemonSetSummary represents a summary of a daemonset
type DaemonSetSummary struct {
	Name                   string `json:"name"`
	Namespace              string `json:"namespace"`
	DesiredNumberScheduled int32  `json:"desiredNumberScheduled"`
	NumberReady            int32  `json:"numberReady"`
}

// ListDaemonSetsResponse represents the response for listing daemonsets
type ListDaemonSetsResponse struct {
	DaemonSets []DaemonSetSummary `json:"daemonsets"`
}

// JobInfo represents job metadata
type JobInfo struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	Labels            map[string]string `json:"labels,omitempty"`
	Annotations       map[string]string `json:"annotations,omitempty"`
	CreationTimestamp *time.Time        `json:"creationTimestamp,omitempty"`
	StartTime         *time.Time        `json:"startTime,omitempty"`
	CompletionTime    *time.Time        `json:"completionTime,omitempty"`
	Completions       *int32            `json:"completions,omitempty"`
	Parallelism       *int32            `json:"parallelism,omitempty"`
	BackoffLimit      *int32            `json:"backoffLimit,omitempty"`
	Active            int32             `json:"active"`
	Succeeded         int32             `json:"succeeded"`
	Failed            int32             `json:"failed"`
	Status            K8sStatus         `json:"status"`
	Conditions        []Condition       `json:"conditions,omitempty"`
}

// JobTopology represents the complete topology of a job
type JobTopology struct {
	Namespace           string             `json:"namespace"`
	Job                 JobInfo            `json:"job"`
	Pods                []PodRef           `json:"pods,omitempty"`
	Services            []ServiceRef       `json:"services,omitempty"`
	Endpoints           []EndpointsRef     `json:"endpoints,omitempty"`
	Secrets             []SecretRef        `json:"secrets,omitempty"`
	ConfigMaps          []ConfigMapRef     `json:"configmaps,omitempty"`
	ServiceAccount      *ServiceAccountRef `json:"serviceAccount,omitempty"`
	Roles               []RoleRef          `json:"roles,omitempty"`
	RoleBindings        []RoleBindingRef   `json:"roleBindings,omitempty"`
	ClusterRoles        []RoleRef          `json:"clusterRoles,omitempty"`
	ClusterRoleBindings []RoleBindingRef   `json:"clusterRoleBindings,omitempty"`
}

// JobSummary represents a summary of a job
type JobSummary struct {
	Name           string     `json:"name"`
	Namespace      string     `json:"namespace"`
	Completions    *int32     `json:"completions,omitempty"`
	Parallelism    *int32     `json:"parallelism,omitempty"`
	Active         int32      `json:"active"`
	Succeeded      int32      `json:"succeeded"`
	Failed         int32      `json:"failed"`
	StartTime      *time.Time `json:"startTime,omitempty"`
	CompletionTime *time.Time `json:"completionTime,omitempty"`
}

// ListJobsResponse represents the response for listing jobs
type ListJobsResponse struct {
	Jobs []JobSummary `json:"jobs"`
}

// CronJobInfo represents information about a CronJob
type CronJobInfo struct {
	Name                       string            `json:"name"`
	Namespace                  string            `json:"namespace"`
	Labels                     map[string]string `json:"labels,omitempty"`
	Annotations                map[string]string `json:"annotations,omitempty"`
	CreationTimestamp          *time.Time        `json:"creationTimestamp,omitempty"`
	Schedule                   string            `json:"schedule"`
	Suspend                    *bool             `json:"suspend,omitempty"`
	StartingDeadlineSeconds    *int64            `json:"startingDeadlineSeconds,omitempty"`
	ConcurrencyPolicy          string            `json:"concurrencyPolicy"`
	SuccessfulJobsHistoryLimit *int32            `json:"successfulJobsHistoryLimit,omitempty"`
	FailedJobsHistoryLimit     *int32            `json:"failedJobsHistoryLimit,omitempty"`
	LastScheduleTime           *time.Time        `json:"lastScheduleTime,omitempty"`
	LastSuccessfulTime         *time.Time        `json:"lastSuccessfulTime,omitempty"`
	NextScheduleTime           *time.Time        `json:"nextScheduleTime,omitempty"`
	Active                     []JobRef          `json:"activeJobs,omitempty"`
	Status                     K8sStatus         `json:"status"`
}

// JobRef represents a reference to a Job created by CronJob
type JobRef struct {
	Name              string     `json:"name"`
	Namespace         string     `json:"namespace"`
	StartTime         *time.Time `json:"startTime,omitempty"`
	CompletionTime    *time.Time `json:"completionTime,omitempty"`
	Status            K8sStatus  `json:"status"`
	Active            int32      `json:"active"`
	Succeeded         int32      `json:"succeeded"`
	Failed            int32      `json:"failed"`
	Completions       *int32     `json:"completions,omitempty"`
	Parallelism       *int32     `json:"parallelism,omitempty"`
	BackoffLimit      *int32     `json:"backoffLimit,omitempty"`
}

// CronJobTopology represents the complete topology of a CronJob
type CronJobTopology struct {
	Namespace           string             `json:"namespace"`
	CronJob             CronJobInfo        `json:"cronjob"`
	Jobs                []JobRef           `json:"jobs,omitempty"`
	Pods                []PodRef           `json:"pods,omitempty"`
	Services            []ServiceRef       `json:"services,omitempty"`
	Endpoints           []EndpointsRef     `json:"endpoints,omitempty"`
	Secrets             []SecretRef        `json:"secrets,omitempty"`
	ConfigMaps          []ConfigMapRef     `json:"configmaps,omitempty"`
	ServiceAccount      *ServiceAccountRef `json:"serviceAccount,omitempty"`
	Roles               []RoleRef          `json:"roles,omitempty"`
	RoleBindings        []RoleBindingRef   `json:"roleBindings,omitempty"`
	ClusterRoles        []RoleRef          `json:"clusterRoles,omitempty"`
	ClusterRoleBindings []RoleBindingRef   `json:"clusterRoleBindings,omitempty"`
}

// CronJobSummary represents a summary of a CronJob for listing
type CronJobSummary struct {
	Name               string     `json:"name"`
	Namespace          string     `json:"namespace"`
	Schedule           string     `json:"schedule"`
	Suspend            *bool      `json:"suspend,omitempty"`
	Active             int        `json:"active"`
	LastScheduleTime   *time.Time `json:"lastScheduleTime,omitempty"`
	NextScheduleTime   *time.Time `json:"nextScheduleTime,omitempty"`
}

// ListCronJobsResponse represents the response for listing CronJobs
type ListCronJobsResponse struct {
	CronJobs []CronJobSummary `json:"cronjobs"`
}