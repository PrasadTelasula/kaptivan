package services

import "k8s.io/apimachinery/pkg/util/intstr"

type ServiceInfo struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	Type         string            `json:"type"`
	ClusterIP    string            `json:"clusterIP"`
	ExternalIP   string            `json:"externalIP,omitempty"`
	Ports        []string          `json:"ports"`
	Selectors    map[string]string `json:"selectors"`
	Age          string            `json:"age"`
	Labels       map[string]string `json:"labels,omitempty"`
	Annotations  map[string]string `json:"annotations,omitempty"`
}

type ServiceDetail struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	UID               string            `json:"uid"`
	ResourceVersion   string            `json:"resourceVersion"`
	CreationTimestamp string            `json:"creationTimestamp"`
	Labels            map[string]string `json:"labels,omitempty"`
	Annotations       map[string]string `json:"annotations,omitempty"`
	
	Type                     string               `json:"type"`
	ClusterIP                string               `json:"clusterIP,omitempty"`
	ClusterIPs               []string             `json:"clusterIPs,omitempty"`
	ExternalIPs              []string             `json:"externalIPs,omitempty"`
	LoadBalancerIP           string               `json:"loadBalancerIP,omitempty"`
	LoadBalancerSourceRanges []string             `json:"loadBalancerSourceRanges,omitempty"`
	ExternalName             string               `json:"externalName,omitempty"`
	ExternalTrafficPolicy    string               `json:"externalTrafficPolicy,omitempty"`
	HealthCheckNodePort      int32                `json:"healthCheckNodePort,omitempty"`
	PublishNotReadyAddresses bool                 `json:"publishNotReadyAddresses"`
	SessionAffinity          string               `json:"sessionAffinity,omitempty"`
	SessionAffinityConfig    *SessionAffinityConfig `json:"sessionAffinityConfig,omitempty"`
	IPFamilies               []string             `json:"ipFamilies,omitempty"`
	IPFamilyPolicy           string               `json:"ipFamilyPolicy,omitempty"`
	AllocateLoadBalancerNodePorts *bool         `json:"allocateLoadBalancerNodePorts,omitempty"`
	LoadBalancerClass        string               `json:"loadBalancerClass,omitempty"`
	InternalTrafficPolicy    string               `json:"internalTrafficPolicy,omitempty"`
	
	Selector map[string]string `json:"selector,omitempty"`
	Ports    []ServicePort     `json:"ports,omitempty"`
	
	Status LoadBalancerStatus `json:"status,omitempty"`
	
	YAML string `json:"yaml"`
	
	Endpoints []EndpointInfo `json:"endpoints,omitempty"`
}

type ServicePort struct {
	Name        string             `json:"name,omitempty"`
	Protocol    string             `json:"protocol,omitempty"`
	AppProtocol string             `json:"appProtocol,omitempty"`
	Port        int32              `json:"port"`
	TargetPort  intstr.IntOrString `json:"targetPort,omitempty"`
	NodePort    int32              `json:"nodePort,omitempty"`
}

type SessionAffinityConfig struct {
	ClientIP *ClientIPConfig `json:"clientIP,omitempty"`
}

type ClientIPConfig struct {
	TimeoutSeconds int32 `json:"timeoutSeconds,omitempty"`
}

type LoadBalancerStatus struct {
	Ingress []LoadBalancerIngress `json:"ingress,omitempty"`
}

type LoadBalancerIngress struct {
	IP       string                `json:"ip,omitempty"`
	Hostname string                `json:"hostname,omitempty"`
	Ports    []PortStatus          `json:"ports,omitempty"`
}

type PortStatus struct {
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
	Error    string `json:"error,omitempty"`
}

type EndpointInfo struct {
	IP       string `json:"ip"`
	NodeName string `json:"nodeName,omitempty"`
	PodName  string `json:"podName,omitempty"`
	Ready    bool   `json:"ready"`
}

type ListServicesRequest struct {
	Contexts   []string `json:"contexts"`
	Namespaces []string `json:"namespaces,omitempty"`
}

type ListServicesResponse struct {
	Services []ServiceInfo `json:"services"`
}