import { API_BASE_URL } from '@/config/constants'
import { apiUrls } from '@/utils/api-urls'

export type PodInfo = {
  name: string
  namespace: string
  status: string
  ready: string
  restarts: number
  age: string
  ip: string
  node: string
  labels: Record<string, string>
  containers: string[]
  cluster?: string  // Optional cluster field for multi-cluster view
}

export type DeploymentInfo = {
  name: string
  namespace: string
  ready: string
  upToDate: number
  available: number
  age: string
  labels: Record<string, string>
  selector: Record<string, string>
}

export type ServiceInfo = {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP: string
  ports: string[]
  age: string
  labels: Record<string, string>
  selector: Record<string, string>
}

export type NamespaceInfo = {
  name: string
  status: string
  age: string
  labels: Record<string, string>
}

export type NodeInfo = {
  name: string
  status: string
  roles: string
  age: string
  version: string
  internalIP: string
  os: string
  kernelVersion: string
  containerRuntime: string
  labels: Record<string, string>
}

export type ResourceListRequest = {
  context: string
  namespace?: string
}

export type ResourceListResponse<T> = {
  items: T[]
  total: number
}

class ResourcesService {
  private async fetchResource<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<ResourceListResponse<T>> {
    const token = localStorage.getItem('auth_token')
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch resources')
    }

    return response.json()
  }

  private async fetchSingleResource<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const token = localStorage.getItem('auth_token')
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch resource')
    }

    return response.json()
  }

  async listPods(request: ResourceListRequest): Promise<ResourceListResponse<PodInfo>> {
    const body = {
      context: request.context,
      ...(request.namespace ? { namespace: request.namespace } : {})
    }
    return this.fetchResource<PodInfo>('/api/v1/resources/pods', 'POST', body)
  }

  async listDeployments(request: ResourceListRequest): Promise<ResourceListResponse<DeploymentInfo>> {
    return this.fetchResource<DeploymentInfo>('/api/v1/resources/deployments', 'POST', request)
  }

  async listServices(request: ResourceListRequest): Promise<ResourceListResponse<ServiceInfo>> {
    return this.fetchResource<ServiceInfo>('/api/v1/resources/services', 'POST', request)
  }

  async listNamespaces(context: string): Promise<ResourceListResponse<NamespaceInfo>> {
    const params = new URLSearchParams({ context })
    return this.fetchResource<NamespaceInfo>(`/api/v1/resources/namespaces?${params}`, 'GET')
  }

  async listNodes(context: string): Promise<ResourceListResponse<NodeInfo>> {
    const params = new URLSearchParams({ context })
    return this.fetchResource<NodeInfo>(`/api/v1/resources/nodes?${params}`, 'GET')
  }

  async getPod(context: string, namespace: string, name: string): Promise<any> {
    const url = apiUrls.pods.get(context, namespace, name).replace(API_BASE_URL, '')
    return this.fetchSingleResource<any>(url, 'GET')
  }

  async getPodLogs(context: string, namespace: string, name: string, container?: string, lines?: number): Promise<any> {
    let url = apiUrls.pods.logs(context, namespace, name, container).replace(API_BASE_URL, '')
    const params = new URLSearchParams()
    if (lines) params.append('lines', lines.toString())
    
    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString()
    }
    
    return this.fetchSingleResource<any>(url, 'GET')
  }

  async getPodEvents(context: string, namespace: string, name: string): Promise<any> {
    const url = `${apiUrls.pods.get(context, namespace, name)}/events`.replace(API_BASE_URL, '')
    return this.fetchSingleResource<any>(url, 'GET')
  }
}

export const resourcesService = new ResourcesService()