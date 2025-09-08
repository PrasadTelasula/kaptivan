import type { NamespaceSnapshot, RawK8sData } from '../types/index'
import { toSnapshot } from '../utils/compute'
import api from '@/services/api'

// Interface for K8s reader
export interface K8sReader {
  getAllNamespaces(cluster: string): Promise<string[]>
  getNamespaceSnapshot(cluster: string, namespace: string): Promise<NamespaceSnapshot>
}

// Default implementation using backend API
export class DefaultK8sReader implements K8sReader {
  async getAllNamespaces(cluster: string): Promise<string[]> {
    try {
      // Use the new namespace list endpoint
      const response = await fetch(`http://localhost:8080/api/v1/namespaces/list?cluster=${encodeURIComponent(cluster)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch namespaces: ${response.statusText}`)
      }
      const data = await response.json()
      return data.namespaces || []
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
      throw error
    }
  }

  async getNamespaceSnapshot(cluster: string, namespace: string): Promise<NamespaceSnapshot> {
    try {
      // Use the new namespace snapshot endpoint
      const response = await fetch(`http://localhost:8080/api/v1/namespaces/snapshot?cluster=${encodeURIComponent(cluster)}&namespace=${encodeURIComponent(namespace)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch namespace snapshot: ${response.statusText}`)
      }
      const data = await response.json()
      
      // If we get the snapshot directly from the new endpoint
      if (data.snapshot) {
        return data.snapshot
      }
      
      // Fallback to fetching individual resources if needed
      const [
        podsRes,
        servicesRes,
        ingressesRes,
        networkPoliciesRes,
        resourceQuotasRes,
        limitRangesRes,
        pvcsRes,
        roleBindingsRes,
        rolesRes,
        eventsRes
      ] = await Promise.all([
        this.fetchPods(cluster, namespace),
        this.fetchServices(cluster, namespace),
        this.fetchIngresses(cluster, namespace),
        this.fetchNetworkPolicies(cluster, namespace),
        this.fetchResourceQuotas(cluster, namespace),
        this.fetchLimitRanges(cluster, namespace),
        this.fetchPVCs(cluster, namespace),
        this.fetchRoleBindings(cluster, namespace),
        this.fetchRoles(cluster, namespace),
        this.fetchEvents(cluster, namespace).catch(() => [])  // Events are optional
      ])

      const rawData: RawK8sData = {
        pods: podsRes,
        services: servicesRes,
        ingresses: ingressesRes,
        networkPolicies: networkPoliciesRes,
        resourceQuotas: resourceQuotasRes,
        limitRanges: limitRangesRes,
        pvcs: pvcsRes,
        roleBindings: roleBindingsRes,
        roles: rolesRes,
        events: eventsRes
      }

      return toSnapshot(namespace, cluster, rawData)
    } catch (error) {
      console.error('Failed to fetch namespace snapshot:', error)
      throw error
    }
  }

  private async fetchPods(cluster: string, namespace: string) {
    const response = await api.k8s.listPods(cluster, namespace)
    return response.items || []
  }

  private async fetchServices(cluster: string, namespace: string) {
    const response = await api.k8s.listServices(cluster, namespace)
    return response.items || []
  }

  private async fetchIngresses(cluster: string, namespace: string) {
    const response = await api.k8s.listIngresses(cluster, namespace)
    return response.items || []
  }

  private async fetchNetworkPolicies(cluster: string, namespace: string) {
    const response = await api.k8s.listNetworkPolicies(cluster, namespace)
    return response.items || []
  }

  private async fetchResourceQuotas(cluster: string, namespace: string) {
    const response = await api.k8s.listResourceQuotas(cluster, namespace)
    return response.items || []
  }

  private async fetchLimitRanges(cluster: string, namespace: string) {
    const response = await api.k8s.listLimitRanges(cluster, namespace)
    return response.items || []
  }

  private async fetchPVCs(cluster: string, namespace: string) {
    const response = await api.k8s.listPVCs(cluster, namespace)
    return response.items || []
  }

  private async fetchRoleBindings(cluster: string, namespace: string) {
    const response = await api.k8s.listRoleBindings(cluster, namespace)
    return response.items || []
  }

  private async fetchRoles(cluster: string, namespace: string) {
    const response = await api.k8s.listRoles(cluster, namespace)
    return response.items || []
  }

  private async fetchEvents(cluster: string, namespace: string) {
    const response = await api.k8s.listEvents(cluster, namespace)
    return response.items || []
  }
}

// Mock implementation for development/demo
export class MockK8sReader implements K8sReader {
  async getAllNamespaces(cluster: string): Promise<string[]> {
    return ['team-a', 'team-b', 'production', 'staging', 'development']
  }

  async getNamespaceSnapshot(cluster: string, namespace: string): Promise<NamespaceSnapshot> {
    // Return mock data based on namespace
    const mockSnapshots: Record<string, NamespaceSnapshot> = {
      'team-a': {
        namespace: 'team-a',
        cluster,
        timestamp: new Date(),
        capacity: {
          cpu: { requests: 4, usage: 3.2, headroom: 20 },
          memory: { requests: 8589934592, usage: 7516192768, headroom: 12.5 }  // 8Gi, 7Gi used
        },
        stability: {
          crashLoops24h: 2,
          restarts24h: 45,
          pendingOver5m: 1
        },
        exposure: {
          services: { loadBalancer: 2, nodePort: 1, clusterIP: 5 },
          ingressHosts: 3,
          hasNetworkPolicy: false
        },
        quota: {
          hasResourceQuota: true,
          topUsage: [
            { resource: 'requests.cpu', used: '3.2', hard: '4', percentage: 80 },
            { resource: 'requests.memory', used: '7Gi', hard: '8Gi', percentage: 87.5 }
          ],
          hasLimitRange: true
        },
        storage: {
          pvcCount: 5,
          requestedGi: 100,
          unboundPVCs: 1,
          orphanedPVCs: 2
        },
        rbac: {
          adminBindings: 1,
          wildcardRules: 0
        }
      },
      'team-b': {
        namespace: 'team-b',
        cluster,
        timestamp: new Date(),
        capacity: {
          cpu: { requests: 8, usage: 2.4, headroom: 70 },
          memory: { requests: 17179869184, usage: 6442450944, headroom: 62.5 }  // 16Gi, 6Gi used
        },
        stability: {
          crashLoops24h: 0,
          restarts24h: 12,
          pendingOver5m: 0
        },
        exposure: {
          services: { loadBalancer: 0, nodePort: 0, clusterIP: 8 },
          ingressHosts: 1,
          hasNetworkPolicy: true
        },
        quota: {
          hasResourceQuota: true,
          topUsage: [
            { resource: 'requests.cpu', used: '2.4', hard: '8', percentage: 30 },
            { resource: 'requests.memory', used: '6Gi', hard: '16Gi', percentage: 37.5 }
          ],
          hasLimitRange: false
        },
        storage: {
          pvcCount: 3,
          requestedGi: 50,
          unboundPVCs: 0,
          orphanedPVCs: 0
        },
        rbac: {
          adminBindings: 0,
          wildcardRules: 1
        }
      },
      'production': {
        namespace: 'production',
        cluster,
        timestamp: new Date(),
        capacity: {
          cpu: { requests: 16, usage: 14.8, headroom: 7.5 },
          memory: { requests: 34359738368, usage: 32212254720, headroom: 6.25 }  // 32Gi, 30Gi used
        },
        stability: {
          crashLoops24h: 0,
          restarts24h: 8,
          pendingOver5m: 0
        },
        exposure: {
          services: { loadBalancer: 3, nodePort: 2, clusterIP: 12 },
          ingressHosts: 5,
          hasNetworkPolicy: true
        },
        quota: {
          hasResourceQuota: true,
          topUsage: [
            { resource: 'requests.cpu', used: '14.8', hard: '16', percentage: 92.5 },
            { resource: 'requests.memory', used: '30Gi', hard: '32Gi', percentage: 93.75 },
            { resource: 'persistentvolumeclaims', used: '18', hard: '20', percentage: 90 }
          ],
          hasLimitRange: true
        },
        storage: {
          pvcCount: 18,
          requestedGi: 500,
          unboundPVCs: 0,
          orphanedPVCs: 1
        },
        rbac: {
          adminBindings: 0,
          wildcardRules: 0
        }
      }
    }

    // Return mock data or generate default
    return mockSnapshots[namespace] || {
      namespace,
      cluster,
      timestamp: new Date(),
      capacity: {
        cpu: { requests: 2, usage: 1, headroom: 50 },
        memory: { requests: 4294967296, usage: 2147483648, headroom: 50 }  // 4Gi, 2Gi used
      },
      stability: {
        crashLoops24h: 0,
        restarts24h: 5,
        pendingOver5m: 0
      },
      exposure: {
        services: { loadBalancer: 0, nodePort: 0, clusterIP: 3 },
        ingressHosts: 0,
        hasNetworkPolicy: false
      },
      quota: {
        hasResourceQuota: false,
        topUsage: [],
        hasLimitRange: false
      },
      storage: {
        pvcCount: 1,
        requestedGi: 10,
        unboundPVCs: 0,
        orphanedPVCs: 0
      },
      rbac: {
        adminBindings: 0,
        wildcardRules: 0
      }
    }
  }
}

// Export the default reader instance
export const k8sReader = new DefaultK8sReader()

// Export mock reader for development
export const mockK8sReader = new MockK8sReader()