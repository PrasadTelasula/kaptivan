// Core data structures for namespace comparison

export interface NamespaceSnapshot {
  namespace: string
  cluster: string
  timestamp: Date
  capacity: {
    cpu: {
      requests: number
      usage?: number
      headroom?: number
      limits: number
    }
    memory: {
      requests: number
      usage?: number
      headroom?: number
      limits: number
    }
  }
  stability: {
    crashLoops24h: number
    restarts24h: number
    pendingOver5m: number
  }
  exposure: {
    services: {
      loadBalancer: number
      nodePort: number
      clusterIP: number
    }
    ingressHosts: number
    hasNetworkPolicy: boolean
    totalServicePorts: number
    externalEndpoints: number
  }
  quota: {
    hasResourceQuota: boolean
    topUsage: Array<{
      resource: string
      used: string
      hard: string
      percentage: number
    }>
    hasLimitRange: boolean
  }
  storage: {
    pvcCount: number
    requestedGi: number
    unboundPVCs: number
    orphanedPVCs: number
    storageClasses: string[]
  }
  rbac: {
    adminBindings: number
    wildcardRules: number
    serviceAccounts: number
  }
  workloads: {
    deployments: number
    statefulSets: number
    daemonSets: number
    jobs: number
    cronJobs: number
    replicaSets: number
    totalPods: number
    totalContainers: number
    uniqueImages: number
    mostUsedImage: string
    initContainers: number
    topImages?: Array<{ name: string; count: number; simplified: string }>
  }
  configuration: {
    configMaps: number
    secrets: number
    totalConfigSize: number
  }
  podDetails: {
    qosClasses: {
      guaranteed: number
      burstable: number
      bestEffort: number
    }
    withNodeSelector: number
    withAffinity: number
    withTolerations: number
    restartPolicies: {
      always: number
      onFailure: number
      never: number
    }
  }
}

export interface CompareRow {
  section?: string
  metric: string
  valueA: string | number
  valueB: string | number
  delta?: string | number
  severityA?: 'ok' | 'warn' | 'crit'
  severityB?: 'ok' | 'warn' | 'crit'
  tooltip?: string
}

export type Severity = 'ok' | 'warn' | 'crit'

export interface SeverityThresholds {
  capacity: {
    headroom: {
      warn: number  // <10%
      crit: number  // <5%
    }
  }
  stability: {
    crashLoops: {
      warn: number  // >0
      crit: number  // >10
    }
    restarts: {
      warn: number  // >50
      crit: number  // >200
    }
    pending: {
      warn: number  // >0
      crit: number  // >5
    }
  }
  exposure: {
    nodePortWithoutNetPol: boolean  // warn
    loadBalancerWithoutNetPol: boolean  // warn
    bothWithoutNetPol: boolean  // crit
  }
  quota: {
    usage: {
      warn: number  // >=80%
      crit: number  // >=95%
    }
  }
  storage: {
    unbound: {
      warn: number  // >0
      crit: number  // >=5
    }
    orphaned: {
      warn: number  // >0
      crit: number  // >=5
    }
  }
  rbac: {
    adminBindings: boolean  // warn if >0
    wildcardRules: boolean  // warn if >0
    both: boolean  // crit if both present
  }
}

// Kubernetes API types (simplified)
export interface K8sPod {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  status: {
    phase: string
    startTime?: string
    containerStatuses?: Array<{
      name: string
      restartCount: number
      state?: {
        waiting?: {
          reason: string
        }
        running?: {
          startedAt: string
        }
        terminated?: {
          reason: string
        }
      }
      lastState?: {
        terminated?: {
          reason: string
        }
      }
    }>
  }
  spec: {
    containers?: Array<{
      name: string
      image?: string
      resources?: {
        requests?: {
          cpu?: string
          memory?: string
        }
        limits?: {
          cpu?: string
          memory?: string
        }
      }
    }>
    initContainers?: Array<{
      name: string
      image?: string
      resources?: {
        requests?: {
          cpu?: string
          memory?: string
        }
        limits?: {
          cpu?: string
          memory?: string
        }
      }
    }>
    volumes?: Array<{
      name: string
      persistentVolumeClaim?: {
        claimName: string
      }
    }>
    nodeSelector?: Record<string, string>
    affinity?: any
    tolerations?: Array<{
      key?: string
      operator?: string
      value?: string
      effect?: string
    }>
    restartPolicy?: string
  }
}

export interface K8sService {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
  spec: {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    ports?: Array<{
      name?: string
      port: number
      targetPort?: number | string
      protocol?: string
    }>
    selector?: Record<string, string>
  }
}

export interface K8sIngress {
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    rules?: Array<{
      host?: string
    }>
  }
}

export interface K8sNetworkPolicy {
  metadata: {
    name: string
    namespace: string
  }
}

export interface K8sResourceQuota {
  metadata: {
    name: string
    namespace: string
  }
  status?: {
    hard?: Record<string, string>
    used?: Record<string, string>
  }
}

export interface K8sLimitRange {
  metadata: {
    name: string
    namespace: string
  }
}

export interface K8sPVC {
  metadata: {
    name: string
    namespace: string
  }
  status?: {
    phase: string
  }
  spec: {
    resources?: {
      requests?: {
        storage?: string
      }
    }
  }
}

export interface K8sRoleBinding {
  metadata: {
    name: string
    namespace: string
  }
  roleRef: {
    kind: string
    name: string
  }
}

export interface K8sRole {
  metadata: {
    name: string
    namespace: string
  }
  rules?: Array<{
    resources?: string[]
    verbs?: string[]
  }>
}

export interface K8sEvent {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  involvedObject: {
    kind: string
    name: string
  }
  reason?: string
  message?: string
  type?: string
}

// Additional Kubernetes types
export interface K8sDeployment {
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    replicas?: number
    strategy?: {
      type?: string
      rollingUpdate?: {
        maxUnavailable?: string | number
        maxSurge?: string | number
      }
    }
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
  }
}

export interface K8sStatefulSet {
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    replicas?: number
  }
}

export interface K8sDaemonSet {
  metadata: {
    name: string
    namespace: string
  }
}

export interface K8sJob {
  metadata: {
    name: string
    namespace: string
  }
  status?: {
    succeeded?: number
    failed?: number
  }
}

export interface K8sCronJob {
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    schedule?: string
  }
}

export interface K8sConfigMap {
  metadata: {
    name: string
    namespace: string
  }
  data?: Record<string, string>
  binaryData?: Record<string, string>
}

export interface K8sSecret {
  metadata: {
    name: string
    namespace: string
  }
  type?: string
  data?: Record<string, string>
}

export interface K8sServiceAccount {
  metadata: {
    name: string
    namespace: string
  }
}

export interface K8sReplicaSet {
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    replicas?: number
  }
}

// Raw K8s data collection
export interface RawK8sData {
  pods: K8sPod[]
  services: K8sService[]
  ingresses: K8sIngress[]
  networkPolicies: K8sNetworkPolicy[]
  resourceQuotas: K8sResourceQuota[]
  limitRanges: K8sLimitRange[]
  pvcs: K8sPVC[]
  roleBindings: K8sRoleBinding[]
  roles: K8sRole[]
  events?: K8sEvent[]
  deployments?: K8sDeployment[]
  statefulSets?: K8sStatefulSet[]
  daemonSets?: K8sDaemonSet[]
  jobs?: K8sJob[]
  cronJobs?: K8sCronJob[]
  configMaps?: K8sConfigMap[]
  secrets?: K8sSecret[]
  serviceAccounts?: K8sServiceAccount[]
  replicaSets?: K8sReplicaSet[]
}