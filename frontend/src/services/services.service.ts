import { API_BASE_URL } from '@/config/constants'

export interface ServiceInfo {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP?: string
  ports: string[]
  selectors: Record<string, string>
  age: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  cluster?: string // Added for multi-cluster support
}

export interface ServiceDetail {
  name: string
  namespace: string
  uid: string
  resourceVersion: string
  creationTimestamp: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  
  type: string
  clusterIP?: string
  clusterIPs?: string[]
  externalIPs?: string[]
  loadBalancerIP?: string
  loadBalancerSourceRanges?: string[]
  externalName?: string
  externalTrafficPolicy?: string
  healthCheckNodePort?: number
  publishNotReadyAddresses: boolean
  sessionAffinity?: string
  sessionAffinityConfig?: SessionAffinityConfig
  ipFamilies?: string[]
  ipFamilyPolicy?: string
  allocateLoadBalancerNodePorts?: boolean
  loadBalancerClass?: string
  internalTrafficPolicy?: string
  
  selector?: Record<string, string>
  ports?: ServicePort[]
  
  status?: LoadBalancerStatus
  
  yaml: string
  
  endpoints?: EndpointInfo[]
}

export interface ServicePort {
  name?: string
  protocol?: string
  appProtocol?: string
  port: number
  targetPort?: string | number
  nodePort?: number
}

export interface SessionAffinityConfig {
  clientIP?: {
    timeoutSeconds?: number
  }
}

export interface LoadBalancerStatus {
  ingress?: LoadBalancerIngress[]
}

export interface LoadBalancerIngress {
  ip?: string
  hostname?: string
  ports?: PortStatus[]
}

export interface PortStatus {
  port: number
  protocol: string
  error?: string
}

export interface EndpointInfo {
  ip: string
  nodeName?: string
  podName?: string
  ready: boolean
}

class ServicesService {
  async listServices(contexts: string[], namespaces?: string[]): Promise<ServiceInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contexts,
        namespaces,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch services')
    }

    const data = await response.json()
    return data.services || []
  }

  async getService(context: string, namespace: string, name: string): Promise<ServiceDetail> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/services/${context}/${namespace}/${name}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch service details')
    }

    return response.json()
  }

  async getServiceEndpoints(context: string, namespace: string, name: string): Promise<EndpointInfo[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/services/${context}/${namespace}/${name}/endpoints`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch service endpoints')
    }

    const data = await response.json()
    return data.endpoints || []
  }

  async updateService(
    context: string,
    namespace: string,
    name: string,
    updates: {
      selector?: Record<string, string>
      ports?: ServicePort[]
    }
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/services/${context}/${namespace}/${name}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to update service')
    }
  }

  async deleteService(
    context: string,
    namespace: string,
    name: string
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/services/${context}/${namespace}/${name}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete service')
    }
  }
}

export const servicesService = new ServicesService()