package services

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TransformServiceList(services []corev1.Service) []ServiceInfo {
	result := make([]ServiceInfo, 0, len(services))
	for _, svc := range services {
		result = append(result, TransformService(svc))
	}
	return result
}

func TransformService(svc corev1.Service) ServiceInfo {
	return ServiceInfo{
		Name:        svc.Name,
		Namespace:   svc.Namespace,
		Type:        string(svc.Spec.Type),
		ClusterIP:   svc.Spec.ClusterIP,
		ExternalIP:  getExternalIP(svc),
		Ports:       formatPorts(svc.Spec.Ports),
		Selectors:   svc.Spec.Selector,
		Age:         formatAge(svc.CreationTimestamp),
		Labels:      svc.Labels,
		Annotations: svc.Annotations,
	}
}

func TransformServiceDetail(svc corev1.Service, endpoints *corev1.Endpoints) ServiceDetail {
	detail := ServiceDetail{
		Name:              svc.Name,
		Namespace:         svc.Namespace,
		UID:               string(svc.UID),
		ResourceVersion:   svc.ResourceVersion,
		CreationTimestamp: svc.CreationTimestamp.Format(time.RFC3339),
		Labels:            svc.Labels,
		Annotations:       svc.Annotations,
		
		Type:                     string(svc.Spec.Type),
		ClusterIP:                svc.Spec.ClusterIP,
		ClusterIPs:               svc.Spec.ClusterIPs,
		ExternalIPs:              svc.Spec.ExternalIPs,
		LoadBalancerIP:           svc.Spec.LoadBalancerIP,
		LoadBalancerSourceRanges: svc.Spec.LoadBalancerSourceRanges,
		ExternalName:             svc.Spec.ExternalName,
		ExternalTrafficPolicy:    string(svc.Spec.ExternalTrafficPolicy),
		HealthCheckNodePort:      svc.Spec.HealthCheckNodePort,
		PublishNotReadyAddresses: svc.Spec.PublishNotReadyAddresses,
		SessionAffinity:          string(svc.Spec.SessionAffinity),
		AllocateLoadBalancerNodePorts: svc.Spec.AllocateLoadBalancerNodePorts,
		LoadBalancerClass:        getPtrValue(svc.Spec.LoadBalancerClass),
		InternalTrafficPolicy:    string(getPtrValue(svc.Spec.InternalTrafficPolicy)),
		
		Selector: svc.Spec.Selector,
		Ports:    transformServicePorts(svc.Spec.Ports),
		
		Status: transformLoadBalancerStatus(&svc.Status.LoadBalancer),
	}
	
	if svc.Spec.SessionAffinityConfig != nil {
		detail.SessionAffinityConfig = transformSessionAffinityConfig(svc.Spec.SessionAffinityConfig)
	}
	
	if svc.Spec.IPFamilies != nil {
		detail.IPFamilies = make([]string, len(svc.Spec.IPFamilies))
		for i, family := range svc.Spec.IPFamilies {
			detail.IPFamilies[i] = string(family)
		}
	}
	
	if svc.Spec.IPFamilyPolicy != nil {
		detail.IPFamilyPolicy = string(*svc.Spec.IPFamilyPolicy)
	}
	
	if endpoints != nil {
		detail.Endpoints = transformEndpoints(endpoints)
	}
	
	return detail
}

func getExternalIP(svc corev1.Service) string {
	if len(svc.Spec.ExternalIPs) > 0 {
		return strings.Join(svc.Spec.ExternalIPs, ", ")
	}
	
	if svc.Spec.Type == corev1.ServiceTypeLoadBalancer && len(svc.Status.LoadBalancer.Ingress) > 0 {
		ingress := svc.Status.LoadBalancer.Ingress[0]
		if ingress.IP != "" {
			return ingress.IP
		}
		if ingress.Hostname != "" {
			return ingress.Hostname
		}
	}
	
	if svc.Spec.Type == corev1.ServiceTypeExternalName {
		return svc.Spec.ExternalName
	}
	
	return ""
}

func formatPorts(ports []corev1.ServicePort) []string {
	if len(ports) == 0 {
		return []string{}
	}
	
	result := make([]string, 0, len(ports))
	for _, port := range ports {
		portStr := fmt.Sprintf("%d", port.Port)
		if port.TargetPort.String() != "" && port.TargetPort.String() != fmt.Sprintf("%d", port.Port) {
			portStr = fmt.Sprintf("%d:%s", port.Port, port.TargetPort.String())
		}
		if port.NodePort != 0 {
			portStr = fmt.Sprintf("%s:%d", portStr, port.NodePort)
		}
		if port.Protocol != "" && port.Protocol != "TCP" {
			portStr = fmt.Sprintf("%s/%s", portStr, port.Protocol)
		}
		if port.Name != "" {
			portStr = fmt.Sprintf("%s (%s)", portStr, port.Name)
		}
		result = append(result, portStr)
	}
	return result
}

func formatAge(timestamp metav1.Time) string {
	if timestamp.IsZero() {
		return ""
	}
	
	duration := time.Since(timestamp.Time)
	
	if duration.Hours() >= 24*365 {
		years := int(duration.Hours() / (24 * 365))
		return fmt.Sprintf("%dy", years)
	} else if duration.Hours() >= 24*30 {
		months := int(duration.Hours() / (24 * 30))
		return fmt.Sprintf("%dmo", months)
	} else if duration.Hours() >= 24 {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	} else if duration.Hours() >= 1 {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	} else if duration.Minutes() >= 1 {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	}
	return fmt.Sprintf("%ds", int(duration.Seconds()))
}

func transformServicePorts(ports []corev1.ServicePort) []ServicePort {
	result := make([]ServicePort, 0, len(ports))
	for _, port := range ports {
		sp := ServicePort{
			Name:       port.Name,
			Protocol:   string(port.Protocol),
			Port:       port.Port,
			TargetPort: port.TargetPort,
			NodePort:   port.NodePort,
		}
		if port.AppProtocol != nil {
			sp.AppProtocol = *port.AppProtocol
		}
		result = append(result, sp)
	}
	return result
}

func transformSessionAffinityConfig(config *corev1.SessionAffinityConfig) *SessionAffinityConfig {
	if config == nil {
		return nil
	}
	
	result := &SessionAffinityConfig{}
	if config.ClientIP != nil {
		result.ClientIP = &ClientIPConfig{}
		if config.ClientIP.TimeoutSeconds != nil {
			result.ClientIP.TimeoutSeconds = *config.ClientIP.TimeoutSeconds
		}
	}
	return result
}

func transformLoadBalancerStatus(status *corev1.LoadBalancerStatus) LoadBalancerStatus {
	if status == nil {
		return LoadBalancerStatus{}
	}
	
	result := LoadBalancerStatus{
		Ingress: make([]LoadBalancerIngress, 0, len(status.Ingress)),
	}
	
	for _, ingress := range status.Ingress {
		lbi := LoadBalancerIngress{
			IP:       ingress.IP,
			Hostname: ingress.Hostname,
		}
		if ingress.Ports != nil {
			lbi.Ports = make([]PortStatus, 0, len(ingress.Ports))
			for _, port := range ingress.Ports {
				ps := PortStatus{
					Port:     port.Port,
					Protocol: string(port.Protocol),
				}
				if port.Error != nil {
					ps.Error = *port.Error
				}
				lbi.Ports = append(lbi.Ports, ps)
			}
		}
		result.Ingress = append(result.Ingress, lbi)
	}
	
	return result
}

func transformEndpoints(endpoints *corev1.Endpoints) []EndpointInfo {
	if endpoints == nil {
		return []EndpointInfo{}
	}
	
	result := make([]EndpointInfo, 0)
	for _, subset := range endpoints.Subsets {
		for _, addr := range subset.Addresses {
			info := EndpointInfo{
				IP:       addr.IP,
				NodeName: getPtrValue(addr.NodeName),
				Ready:    true,
			}
			if addr.TargetRef != nil && addr.TargetRef.Kind == "Pod" {
				info.PodName = addr.TargetRef.Name
			}
			result = append(result, info)
		}
		
		for _, addr := range subset.NotReadyAddresses {
			info := EndpointInfo{
				IP:       addr.IP,
				NodeName: getPtrValue(addr.NodeName),
				Ready:    false,
			}
			if addr.TargetRef != nil && addr.TargetRef.Kind == "Pod" {
				info.PodName = addr.TargetRef.Name
			}
			result = append(result, info)
		}
	}
	
	return result
}

func getPtrValue[T any](ptr *T) T {
	var zero T
	if ptr == nil {
		return zero
	}
	return *ptr
}