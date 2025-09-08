export interface Cluster {
  id: string
  name: string
  status: "connected" | "disconnected" | "error"
  endpoint: string
}

export interface ResourceQuota {
  cpu: { used: number; limit: number }
  memory: { used: number; limit: number }
  storage: { used: number; limit: number }
}

export interface ResourceCount {
  pods: number
  services: number
  deployments: number
  statefulSets: number
  daemonSets: number
  replicaSets: number
  jobs: number
  cronJobs: number
  configMaps: number
  secrets: number
  pvcs: number
  ingresses: number
  networkPolicies: number
  serviceAccounts: number
  roles: number
  roleBindings: number
}

export interface Namespace {
  name: string
  cluster: string
  clusterId: string
  status: "Active" | "Terminating" | "Error"
  createdAt: Date
  labels: Record<string, string>
  annotations: Record<string, string>
  resourceQuota?: ResourceQuota
  podCount: number
  serviceCount: number
  resources?: ResourceCount
}

export interface NamespaceWithResources extends Namespace {
  resources: ResourceCount
  totalResources: number
}

export interface FilterState {
  clusters: string[]
  search: string
  status: "all" | "active" | "terminating" | "error"
  labels: Record<string, string>
}