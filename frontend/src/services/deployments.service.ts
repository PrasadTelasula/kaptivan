import { API_BASE_URL } from '@/config/constants'

export interface DeploymentInfo {
  name: string
  namespace: string
  replicas: string  // "2/3" format
  updatedReplicas: number
  availableReplicas: number
  age: string
  labels: Record<string, string>
  selector: Record<string, string>
  strategy: string
  images: string[]
  conditions: string[]
}

export interface DeploymentDetail {
  name: string
  namespace: string
  uid: string
  resourceVersion: string
  generation: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  
  // Spec
  replicas?: number
  selector: Record<string, string>
  strategy: {
    type: string
    rollingUpdate?: {
      maxUnavailable?: string
      maxSurge?: string
    }
  }
  minReadySeconds: number
  revisionHistoryLimit?: number
  paused: boolean
  progressDeadlineSeconds?: number
  
  // Status
  observedGeneration: number
  statusReplicas: number
  updatedReplicas: number
  readyReplicas: number
  availableReplicas: number
  unavailableReplicas: number
  conditions: Array<{
    type: string
    status: string
    lastUpdateTime: string
    lastTransitionTime: string
    reason?: string
    message?: string
  }>
  collisionCount?: number
  
  // Template
  podTemplate: {
    labels: Record<string, string>
    annotations: Record<string, string>
    containers: Array<{
      name: string
      image: string
      imagePullPolicy: string
      command?: string[]
      args?: string[]
      ports?: Array<{
        name?: string
        containerPort: number
        protocol?: string
      }>
      env?: Array<{
        name: string
        value?: string
      }>
      resources: {
        limits?: Record<string, string>
        requests?: Record<string, string>
      }
      volumeMounts?: Array<{
        name: string
        mountPath: string
        readOnly?: boolean
      }>
    }>
    volumes?: Array<{
      name: string
      source: Record<string, any>
    }>
    nodeSelector?: Record<string, string>
    affinity?: any
    tolerations?: Array<{
      key?: string
      operator?: string
      value?: string
      effect?: string
    }>
  }
  
  // YAML
  yaml: string
}

class DeploymentsService {
  async listDeployments(contexts: string[], namespaces?: string[]): Promise<DeploymentInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/deployments/list`, {
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
      throw new Error('Failed to fetch deployments')
    }

    const data = await response.json()
    return data.deployments || []
  }

  async getDeployment(context: string, namespace: string, name: string): Promise<DeploymentDetail> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/deployments/${context}/${namespace}/${name}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch deployment details')
    }

    return response.json()
  }

  async scaleDeployment(
    context: string,
    namespace: string,
    name: string,
    replicas: number
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/deployments/${context}/${namespace}/${name}/scale`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replicas }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to scale deployment')
    }
  }

  async restartDeployment(
    context: string,
    namespace: string,
    name: string
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/deployments/${context}/${namespace}/${name}/restart`,
      {
        method: 'POST',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to restart deployment')
    }
  }

  async deleteDeployment(
    context: string,
    namespace: string,
    name: string
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/deployments/${context}/${namespace}/${name}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete deployment')
    }
  }
}

export const deploymentsService = new DeploymentsService()