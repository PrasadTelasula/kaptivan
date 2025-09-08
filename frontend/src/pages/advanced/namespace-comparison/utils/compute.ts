import type {
  NamespaceSnapshot,
  CompareRow,
  RawK8sData,
  K8sPod,
  K8sService,
  K8sIngress,
  K8sResourceQuota,
  K8sPVC,
  K8sRoleBinding,
  K8sRole,
  Severity
} from '../types/index'
import { SEVERITY_THRESHOLDS, ADMIN_CLUSTER_ROLES } from '../types/constants'

// Calculate headroom percentage
export function calcHeadroom(requests: number, usage?: number): number | undefined {
  if (usage === undefined || requests === 0) return undefined
  const headroom = Math.max(requests - usage, 0)
  return (headroom / requests) * 100
}

// Count CrashLoopBackOff pods in last 24h
export function countCrashLoops(pods: K8sPod[], events?: any[]): number {
  if (!pods || !Array.isArray(pods)) {
    return 0
  }
  
  const now = Date.now()
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000
  
  let count = 0
  for (const pod of pods) {
    if (!pod?.status?.containerStatuses) continue
    
    for (const container of pod.status.containerStatuses) {
      // Check current state
      if (container.state?.waiting?.reason === 'CrashLoopBackOff') {
        count++
        continue
      }
      
      // Check last state if available
      if (container.lastState?.terminated?.reason === 'CrashLoopBackOff') {
        const terminated = container.lastState.terminated as any
        if (terminated.finishedAt) {
          const finishedTime = new Date(terminated.finishedAt).getTime()
          if (finishedTime >= twentyFourHoursAgo) {
            count++
          }
        }
      }
    }
  }
  
  return count
}

// Count total restarts in last 24h
export function countRestarts24h(pods: K8sPod[]): number {
  if (!pods || !Array.isArray(pods)) {
    return 0
  }
  
  // Note: Without historical data, we can only get current restart count
  // In a real implementation, you'd track restart count changes over time
  let totalRestarts = 0
  
  for (const pod of pods) {
    if (!pod?.status?.containerStatuses) continue
    
    for (const container of pod.status.containerStatuses) {
      totalRestarts += container.restartCount || 0
    }
  }
  
  return totalRestarts
}

// Count pods pending for more than 5 minutes
export function countPendingOver5m(pods: K8sPod[]): number {
  if (!pods || !Array.isArray(pods)) {
    return 0
  }
  
  const now = Date.now()
  const fiveMinutesAgo = now - 5 * 60 * 1000
  
  return pods.filter(pod => {
    if (pod.status.phase !== 'Pending') return false
    
    const startTime = pod.status.startTime || pod.metadata.creationTimestamp
    const podStartTime = new Date(startTime).getTime()
    
    return podStartTime < fiveMinutesAgo
  }).length
}

// Count service types
export function countServiceTypes(services: K8sService[]): {
  loadBalancer: number
  nodePort: number
  clusterIP: number
} {
  const counts = {
    loadBalancer: 0,
    nodePort: 0,
    clusterIP: 0
  }
  
  if (!services || !Array.isArray(services)) {
    return counts
  }
  
  for (const service of services) {
    if (!service?.spec?.type) continue
    
    switch (service.spec.type) {
      case 'LoadBalancer':
        counts.loadBalancer++
        break
      case 'NodePort':
        counts.nodePort++
        break
      case 'ClusterIP':
        counts.clusterIP++
        break
    }
  }
  
  return counts
}

// Count unique ingress hosts
export function countIngressHosts(ingresses: K8sIngress[]): number {
  const hosts = new Set<string>()
  
  if (!ingresses || !Array.isArray(ingresses)) {
    return 0
  }
  
  for (const ingress of ingresses) {
    if (ingress?.spec?.rules) {
      for (const rule of ingress.spec.rules) {
        if (rule?.host) {
          hosts.add(rule.host)
        }
      }
    }
  }
  
  return hosts.size
}

// Check if namespace has any NetworkPolicy
export function hasNetPol(networkPolicies: any[]): boolean {
  return Array.isArray(networkPolicies) && networkPolicies.length > 0
}

// Get top resource quota usage
export function quotaTopUsage(quotas: K8sResourceQuota[]): Array<{
  resource: string
  used: string
  hard: string
  percentage: number
}> {
  const usages: Array<{
    resource: string
    used: string
    hard: string
    percentage: number
  }> = []
  
  if (!quotas || !Array.isArray(quotas)) {
    return usages
  }
  
  for (const quota of quotas) {
    if (!quota?.status?.used || !quota?.status?.hard) continue
    
    for (const resource of Object.keys(quota.status.hard)) {
      // Focus on CPU and memory resources
      if (!resource.includes('cpu') && !resource.includes('memory')) continue
      
      const hard = quota.status.hard[resource]
      const used = quota.status.used[resource] || '0'
      
      // Parse values (simplified - real implementation would handle units)
      const hardNum = parseFloat(hard)
      const usedNum = parseFloat(used)
      
      if (hardNum > 0) {
        const percentage = (usedNum / hardNum) * 100
        usages.push({
          resource,
          used,
          hard,
          percentage
        })
      }
    }
  }
  
  // Sort by percentage and return top 3
  return usages
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
}

// Find orphaned PVCs (not mounted by any pod)
export function findOrphanedPVCs(pvcs: K8sPVC[], pods: K8sPod[]): number {
  if (!pvcs || !Array.isArray(pvcs)) {
    return 0
  }
  
  const mountedPVCs = new Set<string>()
  
  if (pods && Array.isArray(pods)) {
    for (const pod of pods) {
      if (pod?.spec?.volumes) {
        for (const volume of pod.spec.volumes) {
          if (volume?.persistentVolumeClaim?.claimName) {
            mountedPVCs.add(volume.persistentVolumeClaim.claimName)
          }
        }
      }
    }
  }
  
  return pvcs.filter(pvc => pvc?.metadata?.name && !mountedPVCs.has(pvc.metadata.name)).length
}

// Count unbound PVCs
export function countUnboundPVCs(pvcs: K8sPVC[]): number {
  if (!pvcs || !Array.isArray(pvcs)) {
    return 0
  }
  return pvcs.filter(pvc => pvc?.status?.phase !== 'Bound').length
}

// Count admin role bindings
export function countAdminBindings(roleBindings: K8sRoleBinding[]): number {
  if (!roleBindings || !Array.isArray(roleBindings)) {
    return 0
  }
  return roleBindings.filter(rb => 
    rb?.roleRef?.kind === 'ClusterRole' &&
    rb?.roleRef?.name &&
    ADMIN_CLUSTER_ROLES.includes(rb.roleRef.name as any)
  ).length
}

// Count wildcard rules in roles
export function countWildcardRules(roles: K8sRole[]): number {
  if (!roles || !Array.isArray(roles)) {
    return 0
  }
  
  let count = 0
  
  for (const role of roles) {
    if (!role?.rules) continue
    
    for (const rule of role.rules) {
      const hasWildcardResource = rule.resources?.includes('*')
      const hasWildcardVerb = rule.verbs?.includes('*')
      
      if (hasWildcardResource || hasWildcardVerb) {
        count++
      }
    }
  }
  
  return count
}

// Parse storage size to Gi
export function parseStorageToGi(storage: string): number {
  // Simplified parsing - real implementation would handle all units
  const match = storage.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/)
  if (!match) return 0
  
  const value = parseFloat(match[1])
  const unit = match[2]?.toLowerCase() || ''
  
  switch (unit) {
    case 'gi':
      return value
    case 'g':
      return value * 0.931  // G to Gi
    case 'mi':
      return value / 1024
    case 'm':
      return value / 1073.74  // M to Gi
    case 'ki':
      return value / (1024 * 1024)
    case 'k':
      return value / (1073.74 * 1024)
    default:
      return value / (1024 * 1024 * 1024)  // assume bytes
  }
}

// Get total requested storage in Gi
export function getTotalRequestedStorage(pvcs: K8sPVC[]): number {
  if (!pvcs || !Array.isArray(pvcs)) {
    return 0
  }
  
  let total = 0
  
  for (const pvc of pvcs) {
    const storage = pvc.spec.resources?.requests?.storage
    if (storage) {
      total += parseStorageToGi(storage)
    }
  }
  
  return total
}

// Determine severity level for capacity headroom
export function getCapacitySeverity(headroom?: number): Severity {
  if (headroom === undefined) return 'ok'
  
  if (headroom < SEVERITY_THRESHOLDS.capacity.headroom.crit) return 'crit'
  if (headroom < SEVERITY_THRESHOLDS.capacity.headroom.warn) return 'warn'
  return 'ok'
}

// Determine severity level for stability metrics
export function getStabilitySeverity(
  metric: 'crashLoops' | 'restarts' | 'pending',
  value: number
): Severity {
  const thresholds = SEVERITY_THRESHOLDS.stability[metric]
  
  if (value >= thresholds.crit) return 'crit'
  if (value >= thresholds.warn) return 'warn'
  return 'ok'
}

// Determine severity level for exposure
export function getExposureSeverity(
  services: { loadBalancer: number; nodePort: number },
  hasNetPol: boolean
): Severity {
  if (!hasNetPol) {
    if (services.loadBalancer > 0 && services.nodePort > 0) {
      return 'crit'  // Both exposed without NetPol
    }
    if (services.loadBalancer > 0 || services.nodePort > 0) {
      return 'warn'  // One exposed without NetPol
    }
  }
  return 'ok'
}

// Determine severity level for quota usage
export function getQuotaSeverity(topUsage: Array<{ percentage: number }>): Severity {
  if (topUsage.length === 0) return 'ok'
  
  const maxUsage = Math.max(...topUsage.map(u => u.percentage))
  
  if (maxUsage >= SEVERITY_THRESHOLDS.quota.usage.crit) return 'crit'
  if (maxUsage >= SEVERITY_THRESHOLDS.quota.usage.warn) return 'warn'
  return 'ok'
}

// Determine severity level for storage
export function getStorageSeverity(unbound: number, orphaned: number): Severity {
  if (orphaned >= SEVERITY_THRESHOLDS.storage.orphaned.crit ||
      unbound >= SEVERITY_THRESHOLDS.storage.unbound.crit) {
    return 'crit'
  }
  if (orphaned >= SEVERITY_THRESHOLDS.storage.orphaned.warn ||
      unbound >= SEVERITY_THRESHOLDS.storage.unbound.warn) {
    return 'warn'
  }
  return 'ok'
}

// Determine severity level for RBAC
export function getRBACSeverity(adminBindings: number, wildcardRules: number): Severity {
  if (adminBindings > 0 && wildcardRules > 0) return 'crit'
  if (adminBindings > 0 || wildcardRules > 0) return 'warn'
  return 'ok'
}

// Extract unique container images from pods
export function getUniqueImages(pods: K8sPod[]): { 
  unique: number; 
  mostUsed: string;
  allImages: Array<{ name: string; count: number; simplified: string }>
} {
  if (!pods || !Array.isArray(pods)) {
    return { unique: 0, mostUsed: 'N/A', allImages: [] }
  }
  
  const imageCount = new Map<string, number>()
  
  for (const pod of pods) {
    if (!pod?.spec?.containers) continue
    
    for (const container of pod.spec.containers) {
      if (container?.image) {
        const count = imageCount.get(container.image) || 0
        imageCount.set(container.image, count + 1)
      }
    }
    
    // Also check init containers
    if (pod.spec.initContainers) {
      for (const container of pod.spec.initContainers) {
        if (container?.image) {
          const count = imageCount.get(container.image) || 0
          imageCount.set(container.image, count + 1)
        }
      }
    }
  }
  
  if (imageCount.size === 0) {
    return { unique: 0, mostUsed: 'N/A', allImages: [] }
  }
  
  // Create sorted list of all images
  const allImages = Array.from(imageCount.entries())
    .map(([image, count]) => ({
      name: image,
      count,
      simplified: image.split('/').pop()?.split(':')[0] || image
    }))
    .sort((a, b) => b.count - a.count)
  
  // Find most used image
  const mostUsedFull = allImages[0]
  
  return { 
    unique: imageCount.size, 
    mostUsed: mostUsedFull.simplified,
    allImages: allImages.slice(0, 5) // Return top 5 images
  }
}

// Count total containers and init containers
export function countContainers(pods: K8sPod[]): { total: number; initContainers: number } {
  if (!pods || !Array.isArray(pods)) {
    return { total: 0, initContainers: 0 }
  }
  
  let total = 0
  let initContainers = 0
  
  for (const pod of pods) {
    if (pod?.spec?.containers) {
      total += pod.spec.containers.length
    }
    if (pod?.spec?.initContainers) {
      initContainers += pod.spec.initContainers.length
      total += pod.spec.initContainers.length
    }
  }
  
  return { total, initContainers }
}

// Analyze pod QoS classes
export function analyzePodQoS(pods: K8sPod[]): { guaranteed: number; burstable: number; bestEffort: number } {
  if (!pods || !Array.isArray(pods)) {
    return { guaranteed: 0, burstable: 0, bestEffort: 0 }
  }
  
  const qosClasses = { guaranteed: 0, burstable: 0, bestEffort: 0 }
  
  for (const pod of pods) {
    if (!pod?.spec?.containers) continue
    
    // Determine QoS class based on resource requests/limits
    let hasLimits = true
    let hasRequests = false
    let requestsEqualLimits = true
    
    for (const container of pod.spec.containers) {
      const resources = container.resources || {}
      
      if (!resources.limits?.cpu || !resources.limits?.memory) {
        hasLimits = false
      }
      if (resources.requests?.cpu || resources.requests?.memory) {
        hasRequests = true
      }
      if (resources.requests?.cpu !== resources.limits?.cpu || 
          resources.requests?.memory !== resources.limits?.memory) {
        requestsEqualLimits = false
      }
    }
    
    // Determine QoS class
    if (hasLimits && requestsEqualLimits) {
      qosClasses.guaranteed++
    } else if (hasRequests || hasLimits) {
      qosClasses.burstable++
    } else {
      qosClasses.bestEffort++
    }
  }
  
  return qosClasses
}

// Count pods with scheduling constraints
export function countSchedulingConstraints(pods: K8sPod[]): {
  withNodeSelector: number
  withAffinity: number
  withTolerations: number
} {
  if (!pods || !Array.isArray(pods)) {
    return { withNodeSelector: 0, withAffinity: 0, withTolerations: 0 }
  }
  
  let withNodeSelector = 0
  let withAffinity = 0
  let withTolerations = 0
  
  for (const pod of pods) {
    if (!pod?.spec) continue
    
    if (pod.spec.nodeSelector && Object.keys(pod.spec.nodeSelector).length > 0) {
      withNodeSelector++
    }
    if (pod.spec.affinity) {
      withAffinity++
    }
    if (pod.spec.tolerations && pod.spec.tolerations.length > 0) {
      withTolerations++
    }
  }
  
  return { withNodeSelector, withAffinity, withTolerations }
}

// Analyze pod restart policies
export function analyzePodRestartPolicies(pods: K8sPod[]): {
  always: number
  onFailure: number
  never: number
} {
  if (!pods || !Array.isArray(pods)) {
    return { always: 0, onFailure: 0, never: 0 }
  }
  
  const policies = { always: 0, onFailure: 0, never: 0 }
  
  for (const pod of pods) {
    const policy = pod?.spec?.restartPolicy || 'Always'
    
    switch (policy) {
      case 'Always':
        policies.always++
        break
      case 'OnFailure':
        policies.onFailure++
        break
      case 'Never':
        policies.never++
        break
    }
  }
  
  return policies
}

// Count workload types
export function countWorkloads(raw: RawK8sData): {
  deployments: number
  statefulSets: number
  daemonSets: number
  jobs: number
  cronJobs: number
  replicaSets: number
} {
  return {
    deployments: raw.deployments?.length || 0,
    statefulSets: raw.statefulSets?.length || 0,
    daemonSets: raw.daemonSets?.length || 0,
    jobs: raw.jobs?.length || 0,
    cronJobs: raw.cronJobs?.length || 0,
    replicaSets: raw.replicaSets?.length || 0
  }
}

// Count configuration resources
export function countConfiguration(raw: RawK8sData): {
  configMaps: number
  secrets: number
  totalConfigSize: number
} {
  let totalSize = 0
  
  // Estimate size from ConfigMaps
  if (raw.configMaps) {
    for (const cm of raw.configMaps) {
      if (cm?.data) {
        for (const value of Object.values(cm.data)) {
          totalSize += value.length
        }
      }
      if (cm?.binaryData) {
        for (const value of Object.values(cm.binaryData)) {
          // Base64 encoded, so actual size is ~3/4
          totalSize += Math.floor(value.length * 0.75)
        }
      }
    }
  }
  
  // Estimate size from Secrets
  if (raw.secrets) {
    for (const secret of raw.secrets) {
      if (secret?.data) {
        for (const value of Object.values(secret.data)) {
          // Base64 encoded
          totalSize += Math.floor(value.length * 0.75)
        }
      }
    }
  }
  
  return {
    configMaps: raw.configMaps?.length || 0,
    secrets: raw.secrets?.length || 0,
    totalConfigSize: Math.round(totalSize / 1024) // Convert to KB
  }
}

// Get service accounts count
export function countServiceAccounts(raw: RawK8sData): number {
  return raw.serviceAccounts?.length || 0
}

// Get total service ports and external endpoints
export function getServiceMetrics(services: K8sService[]): {
  totalServicePorts: number
  externalEndpoints: number
} {
  if (!services || !Array.isArray(services)) {
    return { totalServicePorts: 0, externalEndpoints: 0 }
  }
  
  let totalPorts = 0
  let externalEndpoints = 0
  
  for (const service of services) {
    if (!service?.spec) continue
    
    // Count ports
    if (service.spec.ports) {
      totalPorts += service.spec.ports.length
    }
    
    // Count external endpoints (LoadBalancer and NodePort)
    if (service.spec.type === 'LoadBalancer' || service.spec.type === 'NodePort') {
      externalEndpoints++
    }
  }
  
  return { totalServicePorts: totalPorts, externalEndpoints }
}

// Parse resource values with units
export function parseResourceValue(value: string): number {
  if (!value) return 0
  
  const match = value.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)?$/)
  if (!match) return 0
  
  const num = parseFloat(match[1])
  const unit = match[2]?.toLowerCase() || ''
  
  // CPU units
  if (value.includes('m')) {
    return num / 1000 // millicores to cores
  }
  
  // Memory units
  switch (unit) {
    case 'ki':
      return num / (1024 * 1024) // KiB to GiB
    case 'mi':
      return num / 1024 // MiB to GiB
    case 'gi':
      return num
    case 'k':
      return num / (1000 * 1000 * 1000) // KB to GB (then approximate to GiB)
    case 'm':
      return num / (1000 * 1000) // MB to GB
    case 'g':
      return num * 0.931 // GB to GiB
    default:
      return num
  }
}

// Calculate resource requests and limits from pods
export function calculatePodResources(pods: K8sPod[]): {
  cpu: { requests: number; limits: number }
  memory: { requests: number; limits: number }
} {
  if (!pods || !Array.isArray(pods)) {
    return {
      cpu: { requests: 0, limits: 0 },
      memory: { requests: 0, limits: 0 }
    }
  }
  
  let cpuRequests = 0
  let cpuLimits = 0
  let memoryRequests = 0
  let memoryLimits = 0
  
  for (const pod of pods) {
    if (!pod?.spec?.containers) continue
    
    for (const container of pod.spec.containers) {
      const resources = container.resources || {}
      
      if (resources.requests?.cpu) {
        cpuRequests += parseResourceValue(resources.requests.cpu)
      }
      if (resources.limits?.cpu) {
        cpuLimits += parseResourceValue(resources.limits.cpu)
      }
      if (resources.requests?.memory) {
        memoryRequests += parseResourceValue(resources.requests.memory)
      }
      if (resources.limits?.memory) {
        memoryLimits += parseResourceValue(resources.limits.memory)
      }
    }
  }
  
  return {
    cpu: { requests: cpuRequests, limits: cpuLimits },
    memory: { requests: memoryRequests, limits: memoryLimits }
  }
}

// Convert raw K8s data to NamespaceSnapshot
export function toSnapshot(
  namespace: string,
  cluster: string,
  raw: RawK8sData
): NamespaceSnapshot {
  const services = countServiceTypes(raw.services)
  const topUsage = quotaTopUsage(raw.resourceQuotas)
  const imageInfo = getUniqueImages(raw.pods)
  const containerInfo = countContainers(raw.pods)
  const qosClasses = analyzePodQoS(raw.pods)
  const schedulingConstraints = countSchedulingConstraints(raw.pods)
  const restartPolicies = analyzePodRestartPolicies(raw.pods)
  const workloads = countWorkloads(raw)
  const configuration = countConfiguration(raw)
  const serviceMetrics = getServiceMetrics(raw.services)
  const podResources = calculatePodResources(raw.pods)
  
  const snapshot: NamespaceSnapshot = {
    namespace,
    cluster,
    timestamp: new Date(),
    capacity: {
      cpu: {
        requests: podResources.cpu.requests,
        limits: podResources.cpu.limits,
        usage: undefined,  // Would come from metrics API
        headroom: undefined
      },
      memory: {
        requests: podResources.memory.requests,
        limits: podResources.memory.limits,
        usage: undefined,  // Would come from metrics API
        headroom: undefined
      }
    },
    stability: {
      crashLoops24h: countCrashLoops(raw.pods, raw.events),
      restarts24h: countRestarts24h(raw.pods),
      pendingOver5m: countPendingOver5m(raw.pods)
    },
    exposure: {
      services,
      ingressHosts: countIngressHosts(raw.ingresses),
      hasNetworkPolicy: hasNetPol(raw.networkPolicies),
      totalServicePorts: serviceMetrics.totalServicePorts,
      externalEndpoints: serviceMetrics.externalEndpoints
    },
    quota: {
      hasResourceQuota: raw.resourceQuotas.length > 0,
      topUsage,
      hasLimitRange: raw.limitRanges.length > 0
    },
    storage: {
      pvcCount: raw.pvcs.length,
      requestedGi: getTotalRequestedStorage(raw.pvcs),
      unboundPVCs: countUnboundPVCs(raw.pvcs),
      orphanedPVCs: findOrphanedPVCs(raw.pvcs, raw.pods),
      storageClasses: [] // Would need to fetch from cluster
    },
    rbac: {
      adminBindings: countAdminBindings(raw.roleBindings),
      wildcardRules: countWildcardRules(raw.roles),
      serviceAccounts: countServiceAccounts(raw)
    },
    workloads: {
      ...workloads,
      totalPods: raw.pods?.length || 0,
      totalContainers: containerInfo.total,
      uniqueImages: imageInfo.unique,
      mostUsedImage: imageInfo.mostUsed,
      initContainers: containerInfo.initContainers,
      topImages: imageInfo.allImages
    },
    configuration,
    podDetails: {
      qosClasses,
      ...schedulingConstraints,
      restartPolicies
    }
  }
  
  // Calculate headroom if usage is available
  if (snapshot.capacity.cpu.usage !== undefined) {
    snapshot.capacity.cpu.headroom = calcHeadroom(
      snapshot.capacity.cpu.requests,
      snapshot.capacity.cpu.usage
    )
  }
  if (snapshot.capacity.memory.usage !== undefined) {
    snapshot.capacity.memory.headroom = calcHeadroom(
      snapshot.capacity.memory.requests,
      snapshot.capacity.memory.usage
    )
  }
  
  return snapshot
}