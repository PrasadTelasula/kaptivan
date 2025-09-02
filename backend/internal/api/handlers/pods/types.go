package pods

import (
	"time"
)

// PodInfo represents basic pod information for listing
type PodInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Status      string            `json:"status"`
	Ready       string            `json:"ready"`
	Restarts    int32             `json:"restarts"`
	Age         string            `json:"age"`
	IP          string            `json:"ip"`
	Node        string            `json:"node"`
	Labels      map[string]string `json:"labels"`
	Containers  []string          `json:"containers"`
}

// PodDetail represents detailed pod information
type PodDetail struct {
	// Basic info
	Name              string                 `json:"name"`
	Namespace         string                 `json:"namespace"`
	UID               string                 `json:"uid"`
	ResourceVersion   string                 `json:"resourceVersion"`
	Generation        int64                  `json:"generation"`
	CreationTimestamp time.Time              `json:"creationTimestamp"`
	DeletionTimestamp *time.Time             `json:"deletionTimestamp,omitempty"`
	Labels            map[string]string      `json:"labels"`
	Annotations       map[string]string      `json:"annotations"`
	OwnerReferences   []OwnerReference       `json:"ownerReferences"`
	
	// Spec
	NodeName           string                `json:"nodeName"`
	ServiceAccountName string                `json:"serviceAccountName"`
	HostNetwork        bool                  `json:"hostNetwork"`
	DNSPolicy          string                `json:"dnsPolicy"`
	RestartPolicy      string                `json:"restartPolicy"`
	Priority           *int32                `json:"priority,omitempty"`
	PriorityClassName  string                `json:"priorityClassName,omitempty"`
	
	// Status
	Phase             string                 `json:"phase"`
	Conditions        []PodCondition         `json:"conditions"`
	Message           string                 `json:"message,omitempty"`
	Reason            string                 `json:"reason,omitempty"`
	PodIP             string                 `json:"podIP"`
	PodIPs            []string               `json:"podIPs"`
	StartTime         *time.Time             `json:"startTime,omitempty"`
	QOSClass          string                 `json:"qosClass"`
	
	// Containers
	InitContainers       []ContainerDetail   `json:"initContainers"`
	Containers           []ContainerDetail   `json:"containers"`
	ContainerStatuses    []ContainerStatus   `json:"containerStatuses"`
	InitContainerStatuses []ContainerStatus  `json:"initContainerStatuses"`
	
	// Volumes
	Volumes              []Volume            `json:"volumes"`
	
	// Network
	HostIP               string              `json:"hostIP"`
	
	// Node selector and tolerations
	NodeSelector         map[string]string   `json:"nodeSelector"`
	Tolerations          []Toleration        `json:"tolerations"`
	
	// YAML representation without managedFields
	Yaml                 string              `json:"yaml"`
}

// OwnerReference represents an owner reference
type OwnerReference struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	UID        string `json:"uid"`
	Controller *bool  `json:"controller,omitempty"`
}

// PodCondition represents a pod condition
type PodCondition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	LastProbeTime      *time.Time `json:"lastProbeTime,omitempty"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
	Reason             string    `json:"reason,omitempty"`
	Message            string    `json:"message,omitempty"`
}

// ContainerDetail represents detailed container information
type ContainerDetail struct {
	Name            string                   `json:"name"`
	Image           string                   `json:"image"`
	ImagePullPolicy string                   `json:"imagePullPolicy"`
	Command         []string                 `json:"command,omitempty"`
	Args            []string                 `json:"args,omitempty"`
	WorkingDir      string                   `json:"workingDir,omitempty"`
	Ports           []ContainerPort          `json:"ports,omitempty"`
	Env             []EnvVar                 `json:"env,omitempty"`
	Resources       ResourceRequirements     `json:"resources"`
	VolumeMounts    []VolumeMount            `json:"volumeMounts,omitempty"`
	LivenessProbe   *Probe                   `json:"livenessProbe,omitempty"`
	ReadinessProbe  *Probe                   `json:"readinessProbe,omitempty"`
	StartupProbe    *Probe                   `json:"startupProbe,omitempty"`
}

// ContainerStatus represents container status
type ContainerStatus struct {
	Name         string         `json:"name"`
	State        ContainerState `json:"state"`
	LastState    ContainerState `json:"lastState"`
	Ready        bool           `json:"ready"`
	RestartCount int32          `json:"restartCount"`
	Image        string         `json:"image"`
	ImageID      string         `json:"imageID"`
	ContainerID  string         `json:"containerID,omitempty"`
	Started      *bool          `json:"started,omitempty"`
}

// ContainerState represents container state
type ContainerState struct {
	Waiting    *ContainerStateWaiting    `json:"waiting,omitempty"`
	Running    *ContainerStateRunning    `json:"running,omitempty"`
	Terminated *ContainerStateTerminated `json:"terminated,omitempty"`
}

// ContainerStateWaiting represents waiting state
type ContainerStateWaiting struct {
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

// ContainerStateRunning represents running state
type ContainerStateRunning struct {
	StartedAt time.Time `json:"startedAt"`
}

// ContainerStateTerminated represents terminated state
type ContainerStateTerminated struct {
	ExitCode    int32     `json:"exitCode"`
	Signal      int32     `json:"signal,omitempty"`
	Reason      string    `json:"reason,omitempty"`
	Message     string    `json:"message,omitempty"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	FinishedAt  time.Time `json:"finishedAt"`
	ContainerID string    `json:"containerID,omitempty"`
}

// ContainerPort represents a container port
type ContainerPort struct {
	Name          string `json:"name,omitempty"`
	HostPort      int32  `json:"hostPort,omitempty"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol,omitempty"`
	HostIP        string `json:"hostIP,omitempty"`
}

// EnvVar represents an environment variable
type EnvVar struct {
	Name      string        `json:"name"`
	Value     string        `json:"value,omitempty"`
	ValueFrom *EnvVarSource `json:"valueFrom,omitempty"`
}

// EnvVarSource represents the source of an environment variable
type EnvVarSource struct {
	ConfigMapKeyRef *ConfigMapKeySelector `json:"configMapKeyRef,omitempty"`
	SecretKeyRef    *SecretKeySelector    `json:"secretKeyRef,omitempty"`
}

// ConfigMapKeySelector selects a key from a ConfigMap
type ConfigMapKeySelector struct {
	Name string `json:"name"`
	Key  string `json:"key"`
}

// SecretKeySelector selects a key from a Secret
type SecretKeySelector struct {
	Name string `json:"name"`
	Key  string `json:"key"`
}

// ResourceRequirements represents resource requirements
type ResourceRequirements struct {
	Limits   map[string]string `json:"limits,omitempty"`
	Requests map[string]string `json:"requests,omitempty"`
}

// VolumeMount represents a volume mount
type VolumeMount struct {
	Name      string `json:"name"`
	ReadOnly  bool   `json:"readOnly,omitempty"`
	MountPath string `json:"mountPath"`
	SubPath   string `json:"subPath,omitempty"`
}

// Volume represents a volume
type Volume struct {
	Name         string                  `json:"name"`
	VolumeSource map[string]interface{} `json:"volumeSource"`
}

// Probe represents a probe
type Probe struct {
	Handler             ProbeHandler `json:"handler"`
	InitialDelaySeconds int32        `json:"initialDelaySeconds,omitempty"`
	TimeoutSeconds      int32        `json:"timeoutSeconds,omitempty"`
	PeriodSeconds       int32        `json:"periodSeconds,omitempty"`
	SuccessThreshold    int32        `json:"successThreshold,omitempty"`
	FailureThreshold    int32        `json:"failureThreshold,omitempty"`
}

// ProbeHandler represents probe handler
type ProbeHandler struct {
	Exec      *ExecAction      `json:"exec,omitempty"`
	HTTPGet   *HTTPGetAction   `json:"httpGet,omitempty"`
	TCPSocket *TCPSocketAction `json:"tcpSocket,omitempty"`
}

// ExecAction represents exec action
type ExecAction struct {
	Command []string `json:"command,omitempty"`
}

// HTTPGetAction represents HTTP GET action
type HTTPGetAction struct {
	Path        string `json:"path,omitempty"`
	Port        int32  `json:"port"`
	Host        string `json:"host,omitempty"`
	Scheme      string `json:"scheme,omitempty"`
	HTTPHeaders []HTTPHeader `json:"httpHeaders,omitempty"`
}

// HTTPHeader represents an HTTP header
type HTTPHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// TCPSocketAction represents TCP socket action
type TCPSocketAction struct {
	Port int32  `json:"port"`
	Host string `json:"host,omitempty"`
}

// Toleration represents a toleration
type Toleration struct {
	Key               string `json:"key,omitempty"`
	Operator          string `json:"operator,omitempty"`
	Value             string `json:"value,omitempty"`
	Effect            string `json:"effect,omitempty"`
	TolerationSeconds *int64 `json:"tolerationSeconds,omitempty"`
}

// EventInfo represents event information
type EventInfo struct {
	Type           string    `json:"type"`
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	Source         string    `json:"source"`
	FirstTimestamp time.Time `json:"firstTimestamp"`
	LastTimestamp  time.Time `json:"lastTimestamp"`
	Count          int32     `json:"count"`
}

// PodIdentifier represents a pod identifier for batch operations
type PodIdentifier struct {
	Context   string `json:"context" binding:"required"`
	Namespace string `json:"namespace" binding:"required"`
	Name      string `json:"name" binding:"required"`
}

// BatchGetRequest represents a request to get multiple pod details
type BatchGetRequest struct {
	Pods []PodIdentifier `json:"pods" binding:"required"`
}

// BatchGetResponse represents a response with multiple pod details
type BatchGetResponse struct {
	Pods   []PodDetail `json:"pods"`
	Errors []PodError  `json:"errors,omitempty"`
}

// PodError represents an error for a specific pod in batch operations
type PodError struct {
	Context   string `json:"context"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Error     string `json:"error"`
}