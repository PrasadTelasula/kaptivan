import { API_BASE_URL } from '@/config/constants'
import { apiUrls } from '@/utils/api-urls'

export interface PodInfo {
  name: string
  namespace: string
  status: string
  ready: string
  restarts: number
  age: string
  ip: string
  node: string
  labels?: Record<string, string>
  containers?: string[]
  cluster?: string
}

export interface PodDetail {
  name: string
  namespace: string
  uid: string
  resourceVersion: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  phase: string
  conditions: Array<{
    type: string
    status: string
    lastProbeTime?: string
    lastTransitionTime: string
    reason?: string
    message?: string
  }>
  hostIP: string
  podIP: string
  podIPs?: Array<{ ip: string }>
  startTime: string
  qosClass: string
  priority?: number
  nodeName: string
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
  containerStatuses?: Array<{
    name: string
    state: Record<string, any>
    lastState: Record<string, any>
    ready: boolean
    restartCount: number
    image: string
    imageID: string
    containerID?: string
    started?: boolean
  }>
  volumes?: Array<{
    name: string
    source: Record<string, any>
  }>
  yaml: string
}

export interface PodEvent {
  type: string
  reason: string
  message: string
  firstTimestamp: string
  lastTimestamp: string
  count: number
  source: {
    component: string
    host?: string
  }
}

export interface ExecResponse {
  stdout: string
  stderr: string
  error?: string
}

interface PodIdentifier {
  context: string
  namespace: string
  name: string
}

interface BatchGetRequest {
  pods: PodIdentifier[]
}

interface BatchGetResponse {
  pods: PodDetail[]
  errors?: Array<{
    context: string
    namespace: string
    name: string
    error: string
  }>
}

class PodsService {
  async getPod(context: string, namespace: string, name: string): Promise<PodDetail> {
    const response = await fetch(
      apiUrls.pods.get(context, namespace, name)
    )

    if (!response.ok) {
      throw new Error('Failed to fetch pod details')
    }

    return response.json()
  }

  async getBatchPods(pods: PodIdentifier[]): Promise<BatchGetResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/pods/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pods }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch pod details in batch')
    }

    return response.json()
  }

  async getPodEvents(context: string, namespace: string, name: string): Promise<PodEvent[]> {
    const response = await fetch(
      `${apiUrls.pods.get(context, namespace, name)}/events`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch pod events')
    }

    const data = await response.json()
    return data.events || []
  }

  async getPodLogs(
    context: string, 
    namespace: string, 
    name: string, 
    container?: string,
    tailLines?: number,
    follow?: boolean
  ): Promise<string> {
    let url = apiUrls.pods.logs(context, namespace, name, container)
    const params = new URLSearchParams()
    if (tailLines) params.append('tailLines', tailLines.toString())
    if (follow) params.append('follow', 'true')
    
    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString()
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to fetch pod logs')
    }

    return response.text()
  }

  async deletePod(context: string, namespace: string, name: string): Promise<void> {
    const response = await fetch(
      apiUrls.pods.delete(context, namespace, name),
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete pod')
    }
  }

  async execCommand(
    context: string,
    namespace: string,
    name: string,
    container: string,
    command: string[]
  ): Promise<ExecResponse> {
    const response = await fetch(
      apiUrls.pods.exec(context, namespace, name, container),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          container,
          command,
          stdin: false,
          stdout: true,
          stderr: true,
          tty: false,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Failed to execute command')
    }

    return response.json()
  }
}

export const podsService = new PodsService()