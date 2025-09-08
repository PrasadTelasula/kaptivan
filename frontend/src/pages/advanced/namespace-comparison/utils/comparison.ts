import type { NamespaceSnapshot, CompareRow } from '../types/index'
import {
  getCapacitySeverity,
  getStabilitySeverity,
  getExposureSeverity,
  getQuotaSeverity,
  getStorageSeverity,
  getRBACSeverity
} from './compute'

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'Ki', 'Mi', 'Gi', 'Ti']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Format number with suffix
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// Format percentage
function formatPercentage(value?: number): string {
  if (value === undefined) return '–'
  return `${value.toFixed(1)}%`
}

// Calculate delta between two values
function calculateDelta(
  valueA: string | number,
  valueB: string | number
): string | number | undefined {
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    const delta = valueB - valueA
    if (delta === 0) return undefined
    return delta > 0 ? `+${delta}` : delta.toString()
  }
  
  if (valueA === valueB) return undefined
  
  // For boolean-like values
  if (valueA === 'Yes' && valueB === 'No') return '↓'
  if (valueA === 'No' && valueB === 'Yes') return '↑'
  
  return undefined
}

// Compare two namespace snapshots
export function compareSnapshots(
  snapshotA: NamespaceSnapshot,
  snapshotB: NamespaceSnapshot
): CompareRow[] {
  const rows: CompareRow[] = []
  
  // Section: Capacity at a Glance
  rows.push({ section: 'Capacity at a Glance', metric: '', valueA: '', valueB: '' })
  
  // CPU
  rows.push({
    metric: 'CPU Requests',
    valueA: formatNumber(snapshotA.capacity.cpu.requests),
    valueB: formatNumber(snapshotB.capacity.cpu.requests),
    delta: calculateDelta(snapshotA.capacity.cpu.requests, snapshotB.capacity.cpu.requests),
    tooltip: 'Total CPU cores requested by all pods'
  })
  
  rows.push({
    metric: 'CPU Usage',
    valueA: snapshotA.capacity.cpu.usage !== undefined 
      ? formatNumber(snapshotA.capacity.cpu.usage) 
      : '–',
    valueB: snapshotB.capacity.cpu.usage !== undefined 
      ? formatNumber(snapshotB.capacity.cpu.usage) 
      : '–',
    delta: snapshotA.capacity.cpu.usage !== undefined && snapshotB.capacity.cpu.usage !== undefined
      ? calculateDelta(snapshotA.capacity.cpu.usage, snapshotB.capacity.cpu.usage)
      : undefined,
    tooltip: 'Actual CPU usage from metrics'
  })
  
  rows.push({
    metric: 'CPU Headroom',
    valueA: formatPercentage(snapshotA.capacity.cpu.headroom),
    valueB: formatPercentage(snapshotB.capacity.cpu.headroom),
    severityA: getCapacitySeverity(snapshotA.capacity.cpu.headroom),
    severityB: getCapacitySeverity(snapshotB.capacity.cpu.headroom),
    tooltip: 'Available CPU capacity (requests - usage) / requests'
  })
  
  // Memory
  rows.push({
    metric: 'Memory Requests',
    valueA: formatBytes(snapshotA.capacity.memory.requests),
    valueB: formatBytes(snapshotB.capacity.memory.requests),
    delta: calculateDelta(snapshotA.capacity.memory.requests, snapshotB.capacity.memory.requests),
    tooltip: 'Total memory requested by all pods'
  })
  
  rows.push({
    metric: 'Memory Usage',
    valueA: snapshotA.capacity.memory.usage !== undefined 
      ? formatBytes(snapshotA.capacity.memory.usage) 
      : '–',
    valueB: snapshotB.capacity.memory.usage !== undefined 
      ? formatBytes(snapshotB.capacity.memory.usage) 
      : '–',
    delta: snapshotA.capacity.memory.usage !== undefined && snapshotB.capacity.memory.usage !== undefined
      ? calculateDelta(snapshotA.capacity.memory.usage, snapshotB.capacity.memory.usage)
      : undefined,
    tooltip: 'Actual memory usage from metrics'
  })
  
  rows.push({
    metric: 'Memory Headroom',
    valueA: formatPercentage(snapshotA.capacity.memory.headroom),
    valueB: formatPercentage(snapshotB.capacity.memory.headroom),
    severityA: getCapacitySeverity(snapshotA.capacity.memory.headroom),
    severityB: getCapacitySeverity(snapshotB.capacity.memory.headroom),
    tooltip: 'Available memory capacity (requests - usage) / requests'
  })
  
  // Section: Pod Stability
  rows.push({ section: 'Pod Stability', metric: '', valueA: '', valueB: '' })
  
  rows.push({
    metric: 'CrashLoops (24h)',
    valueA: snapshotA.stability.crashLoops24h,
    valueB: snapshotB.stability.crashLoops24h,
    delta: calculateDelta(snapshotA.stability.crashLoops24h, snapshotB.stability.crashLoops24h),
    severityA: getStabilitySeverity('crashLoops', snapshotA.stability.crashLoops24h),
    severityB: getStabilitySeverity('crashLoops', snapshotB.stability.crashLoops24h),
    tooltip: 'Pods in CrashLoopBackOff state in the last 24 hours'
  })
  
  rows.push({
    metric: 'Restarts (24h)',
    valueA: snapshotA.stability.restarts24h,
    valueB: snapshotB.stability.restarts24h,
    delta: calculateDelta(snapshotA.stability.restarts24h, snapshotB.stability.restarts24h),
    severityA: getStabilitySeverity('restarts', snapshotA.stability.restarts24h),
    severityB: getStabilitySeverity('restarts', snapshotB.stability.restarts24h),
    tooltip: 'Total container restarts in the last 24 hours'
  })
  
  rows.push({
    metric: 'Pending >5m',
    valueA: snapshotA.stability.pendingOver5m,
    valueB: snapshotB.stability.pendingOver5m,
    delta: calculateDelta(snapshotA.stability.pendingOver5m, snapshotB.stability.pendingOver5m),
    severityA: getStabilitySeverity('pending', snapshotA.stability.pendingOver5m),
    severityB: getStabilitySeverity('pending', snapshotB.stability.pendingOver5m),
    tooltip: 'Pods stuck in Pending state for more than 5 minutes'
  })
  
  // Section: Exposure Surface
  rows.push({ section: 'Exposure Surface', metric: '', valueA: '', valueB: '' })
  
  rows.push({
    metric: 'LoadBalancer Services',
    valueA: snapshotA.exposure.services.loadBalancer,
    valueB: snapshotB.exposure.services.loadBalancer,
    delta: calculateDelta(
      snapshotA.exposure.services.loadBalancer,
      snapshotB.exposure.services.loadBalancer
    ),
    tooltip: 'Services exposed via LoadBalancer'
  })
  
  rows.push({
    metric: 'NodePort Services',
    valueA: snapshotA.exposure.services.nodePort,
    valueB: snapshotB.exposure.services.nodePort,
    delta: calculateDelta(
      snapshotA.exposure.services.nodePort,
      snapshotB.exposure.services.nodePort
    ),
    tooltip: 'Services exposed via NodePort'
  })
  
  rows.push({
    metric: 'ClusterIP Services',
    valueA: snapshotA.exposure.services.clusterIP,
    valueB: snapshotB.exposure.services.clusterIP,
    delta: calculateDelta(
      snapshotA.exposure.services.clusterIP,
      snapshotB.exposure.services.clusterIP
    ),
    tooltip: 'Internal ClusterIP services'
  })
  
  rows.push({
    metric: 'Ingress Hosts',
    valueA: snapshotA.exposure.ingressHosts,
    valueB: snapshotB.exposure.ingressHosts,
    delta: calculateDelta(snapshotA.exposure.ingressHosts, snapshotB.exposure.ingressHosts),
    tooltip: 'Unique hostnames in Ingress rules'
  })
  
  rows.push({
    metric: 'NetworkPolicy Present',
    valueA: snapshotA.exposure.hasNetworkPolicy ? 'Yes' : 'No',
    valueB: snapshotB.exposure.hasNetworkPolicy ? 'Yes' : 'No',
    delta: calculateDelta(
      snapshotA.exposure.hasNetworkPolicy ? 'Yes' : 'No',
      snapshotB.exposure.hasNetworkPolicy ? 'Yes' : 'No'
    ),
    severityA: getExposureSeverity(snapshotA.exposure.services, snapshotA.exposure.hasNetworkPolicy),
    severityB: getExposureSeverity(snapshotB.exposure.services, snapshotB.exposure.hasNetworkPolicy),
    tooltip: 'Whether any NetworkPolicy is defined'
  })
  
  // Section: Quota & Defaults Hygiene
  rows.push({ section: 'Quota & Defaults Hygiene', metric: '', valueA: '', valueB: '' })
  
  rows.push({
    metric: 'ResourceQuota Present',
    valueA: snapshotA.quota.hasResourceQuota ? 'Yes' : 'No',
    valueB: snapshotB.quota.hasResourceQuota ? 'Yes' : 'No',
    delta: calculateDelta(
      snapshotA.quota.hasResourceQuota ? 'Yes' : 'No',
      snapshotB.quota.hasResourceQuota ? 'Yes' : 'No'
    ),
    tooltip: 'Whether ResourceQuota is defined'
  })
  
  // Top quota usage
  if (snapshotA.quota.topUsage.length > 0 || snapshotB.quota.topUsage.length > 0) {
    const maxItems = Math.max(snapshotA.quota.topUsage.length, snapshotB.quota.topUsage.length)
    
    for (let i = 0; i < Math.min(maxItems, 3); i++) {
      const usageA = snapshotA.quota.topUsage[i]
      const usageB = snapshotB.quota.topUsage[i]
      
      rows.push({
        metric: `  Top Usage ${i + 1}`,
        valueA: usageA 
          ? `${usageA.resource}: ${usageA.used}/${usageA.hard} (${usageA.percentage.toFixed(0)}%)`
          : '–',
        valueB: usageB 
          ? `${usageB.resource}: ${usageB.used}/${usageB.hard} (${usageB.percentage.toFixed(0)}%)`
          : '–',
        severityA: usageA ? (usageA.percentage >= 95 ? 'crit' : usageA.percentage >= 80 ? 'warn' : 'ok') : 'ok',
        severityB: usageB ? (usageB.percentage >= 95 ? 'crit' : usageB.percentage >= 80 ? 'warn' : 'ok') : 'ok',
        tooltip: 'Resource quota usage by percentage'
      })
    }
  }
  
  rows.push({
    metric: 'LimitRange Present',
    valueA: snapshotA.quota.hasLimitRange ? 'Yes' : 'No',
    valueB: snapshotB.quota.hasLimitRange ? 'Yes' : 'No',
    delta: calculateDelta(
      snapshotA.quota.hasLimitRange ? 'Yes' : 'No',
      snapshotB.quota.hasLimitRange ? 'Yes' : 'No'
    ),
    tooltip: 'Whether LimitRange is defined'
  })
  
  // Section: Storage Basics
  rows.push({ section: 'Storage Basics', metric: '', valueA: '', valueB: '' })
  
  rows.push({
    metric: 'PVC Count',
    valueA: snapshotA.storage.pvcCount,
    valueB: snapshotB.storage.pvcCount,
    delta: calculateDelta(snapshotA.storage.pvcCount, snapshotB.storage.pvcCount),
    tooltip: 'Total number of PersistentVolumeClaims'
  })
  
  rows.push({
    metric: 'Requested Storage',
    valueA: `${snapshotA.storage.requestedGi.toFixed(1)} Gi`,
    valueB: `${snapshotB.storage.requestedGi.toFixed(1)} Gi`,
    delta: calculateDelta(snapshotA.storage.requestedGi, snapshotB.storage.requestedGi),
    tooltip: 'Total storage requested in GiB'
  })
  
  rows.push({
    metric: 'Unbound PVCs',
    valueA: snapshotA.storage.unboundPVCs,
    valueB: snapshotB.storage.unboundPVCs,
    delta: calculateDelta(snapshotA.storage.unboundPVCs, snapshotB.storage.unboundPVCs),
    severityA: getStorageSeverity(snapshotA.storage.unboundPVCs, snapshotA.storage.orphanedPVCs),
    severityB: getStorageSeverity(snapshotB.storage.unboundPVCs, snapshotB.storage.orphanedPVCs),
    tooltip: 'PVCs not bound to a PersistentVolume'
  })
  
  rows.push({
    metric: 'Orphaned PVCs',
    valueA: snapshotA.storage.orphanedPVCs,
    valueB: snapshotB.storage.orphanedPVCs,
    delta: calculateDelta(snapshotA.storage.orphanedPVCs, snapshotB.storage.orphanedPVCs),
    severityA: getStorageSeverity(snapshotA.storage.unboundPVCs, snapshotA.storage.orphanedPVCs),
    severityB: getStorageSeverity(snapshotB.storage.unboundPVCs, snapshotB.storage.orphanedPVCs),
    tooltip: 'PVCs not mounted by any pod'
  })
  
  // Section: RBAC Risk Snapshot
  rows.push({ section: 'RBAC Risk Snapshot', metric: '', valueA: '', valueB: '' })
  
  rows.push({
    metric: 'Admin Bindings',
    valueA: snapshotA.rbac.adminBindings,
    valueB: snapshotB.rbac.adminBindings,
    delta: calculateDelta(snapshotA.rbac.adminBindings, snapshotB.rbac.adminBindings),
    severityA: getRBACSeverity(snapshotA.rbac.adminBindings, snapshotA.rbac.wildcardRules),
    severityB: getRBACSeverity(snapshotB.rbac.adminBindings, snapshotB.rbac.wildcardRules),
    tooltip: 'RoleBindings to cluster-admin, admin, or edit ClusterRoles'
  })
  
  rows.push({
    metric: 'Wildcard Rules',
    valueA: snapshotA.rbac.wildcardRules,
    valueB: snapshotB.rbac.wildcardRules,
    delta: calculateDelta(snapshotA.rbac.wildcardRules, snapshotB.rbac.wildcardRules),
    severityA: getRBACSeverity(snapshotA.rbac.adminBindings, snapshotA.rbac.wildcardRules),
    severityB: getRBACSeverity(snapshotB.rbac.adminBindings, snapshotB.rbac.wildcardRules),
    tooltip: 'Rules with * in resources or verbs'
  })
  
  return rows
}