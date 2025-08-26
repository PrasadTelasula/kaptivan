package deployments

import (
	"time"
)

// DeploymentInfo represents basic deployment information for listing
type DeploymentInfo struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	Replicas        string            `json:"replicas"`        // "2/3" format (ready/desired)
	UpdatedReplicas int32             `json:"updatedReplicas"`
	AvailableReplicas int32           `json:"availableReplicas"`
	Age             string            `json:"age"`
	Labels          map[string]string `json:"labels"`
	Selector        map[string]string `json:"selector"`
	Strategy        string            `json:"strategy"`
	Images          []string          `json:"images"`
	Conditions      []string          `json:"conditions"`
}

// DeploymentDetail represents detailed deployment information
type DeploymentDetail struct {
	// Basic info
	Name              string                 `json:"name"`
	Namespace         string                 `json:"namespace"`
	UID               string                 `json:"uid"`
	ResourceVersion   string                 `json:"resourceVersion"`
	Generation        int64                  `json:"generation"`
	CreationTimestamp time.Time              `json:"creationTimestamp"`
	Labels            map[string]string      `json:"labels"`
	Annotations       map[string]string      `json:"annotations"`
	
	// Spec
	Replicas          *int32                 `json:"replicas"`
	Selector          map[string]string      `json:"selector"`
	Strategy          DeploymentStrategy     `json:"strategy"`
	MinReadySeconds   int32                  `json:"minReadySeconds"`
	RevisionHistoryLimit *int32              `json:"revisionHistoryLimit"`
	Paused            bool                   `json:"paused"`
	ProgressDeadlineSeconds *int32          `json:"progressDeadlineSeconds"`
	
	// Status
	ObservedGeneration int64                 `json:"observedGeneration"`
	StatusReplicas    int32                  `json:"statusReplicas"`
	UpdatedReplicas   int32                  `json:"updatedReplicas"`
	ReadyReplicas     int32                  `json:"readyReplicas"`
	AvailableReplicas int32                  `json:"availableReplicas"`
	UnavailableReplicas int32                `json:"unavailableReplicas"`
	Conditions        []DeploymentCondition  `json:"conditions"`
	CollisionCount    *int32                 `json:"collisionCount,omitempty"`
	
	// Template
	PodTemplate       PodTemplateSpec        `json:"podTemplate"`
	
	// YAML representation without managedFields
	Yaml              string                 `json:"yaml"`
}

// DeploymentStrategy represents deployment strategy
type DeploymentStrategy struct {
	Type           string                    `json:"type"`
	RollingUpdate  *RollingUpdateDeployment  `json:"rollingUpdate,omitempty"`
}

// RollingUpdateDeployment represents rolling update configuration
type RollingUpdateDeployment struct {
	MaxUnavailable string `json:"maxUnavailable,omitempty"`
	MaxSurge       string `json:"maxSurge,omitempty"`
}

// DeploymentCondition represents a deployment condition
type DeploymentCondition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	LastUpdateTime     time.Time `json:"lastUpdateTime"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
	Reason             string    `json:"reason,omitempty"`
	Message            string    `json:"message,omitempty"`
}

// PodTemplateSpec represents the pod template
type PodTemplateSpec struct {
	Labels        map[string]string   `json:"labels"`
	Annotations   map[string]string   `json:"annotations"`
	Containers    []ContainerSpec     `json:"containers"`
	Volumes       []VolumeSpec        `json:"volumes"`
	NodeSelector  map[string]string   `json:"nodeSelector,omitempty"`
	Affinity      interface{}         `json:"affinity,omitempty"`
	Tolerations   []TolerationSpec    `json:"tolerations,omitempty"`
}

// ContainerSpec represents container specification
type ContainerSpec struct {
	Name            string                   `json:"name"`
	Image           string                   `json:"image"`
	ImagePullPolicy string                   `json:"imagePullPolicy"`
	Command         []string                 `json:"command,omitempty"`
	Args            []string                 `json:"args,omitempty"`
	Ports           []ContainerPort          `json:"ports,omitempty"`
	Env             []EnvVar                 `json:"env,omitempty"`
	Resources       ResourceRequirements     `json:"resources"`
	VolumeMounts    []VolumeMount            `json:"volumeMounts,omitempty"`
}

// ContainerPort represents a container port
type ContainerPort struct {
	Name          string `json:"name,omitempty"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol,omitempty"`
}

// EnvVar represents an environment variable
type EnvVar struct {
	Name  string `json:"name"`
	Value string `json:"value,omitempty"`
}

// ResourceRequirements represents resource requirements
type ResourceRequirements struct {
	Limits   map[string]string `json:"limits,omitempty"`
	Requests map[string]string `json:"requests,omitempty"`
}

// VolumeMount represents a volume mount
type VolumeMount struct {
	Name      string `json:"name"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly,omitempty"`
}

// VolumeSpec represents a volume specification
type VolumeSpec struct {
	Name   string                 `json:"name"`
	Source map[string]interface{} `json:"source"`
}

// TolerationSpec represents a toleration
type TolerationSpec struct {
	Key      string `json:"key,omitempty"`
	Operator string `json:"operator,omitempty"`
	Value    string `json:"value,omitempty"`
	Effect   string `json:"effect,omitempty"`
}