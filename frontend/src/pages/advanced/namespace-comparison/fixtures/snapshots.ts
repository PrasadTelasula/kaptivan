import type { NamespaceSnapshot } from '../types/index'

export const mockSnapshotTeamA: NamespaceSnapshot = {
  namespace: 'team-a',
  cluster: 'production',
  timestamp: new Date(),
  capacity: {
    cpu: {
      requests: 4,
      usage: 3.2,
      headroom: 20
    },
    memory: {
      requests: 8589934592, // 8Gi
      usage: 7516192768,    // 7Gi
      headroom: 12.5
    }
  },
  stability: {
    crashLoops24h: 2,
    restarts24h: 45,
    pendingOver5m: 1
  },
  exposure: {
    services: {
      loadBalancer: 2,
      nodePort: 1,
      clusterIP: 5
    },
    ingressHosts: 3,
    hasNetworkPolicy: false
  },
  quota: {
    hasResourceQuota: true,
    topUsage: [
      {
        resource: 'requests.cpu',
        used: '3.2',
        hard: '4',
        percentage: 80
      },
      {
        resource: 'requests.memory',
        used: '7Gi',
        hard: '8Gi',
        percentage: 87.5
      },
      {
        resource: 'persistentvolumeclaims',
        used: '8',
        hard: '10',
        percentage: 80
      }
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
}

export const mockSnapshotTeamB: NamespaceSnapshot = {
  namespace: 'team-b',
  cluster: 'production',
  timestamp: new Date(),
  capacity: {
    cpu: {
      requests: 8,
      usage: 2.4,
      headroom: 70
    },
    memory: {
      requests: 17179869184, // 16Gi
      usage: 6442450944,     // 6Gi
      headroom: 62.5
    }
  },
  stability: {
    crashLoops24h: 0,
    restarts24h: 12,
    pendingOver5m: 0
  },
  exposure: {
    services: {
      loadBalancer: 0,
      nodePort: 0,
      clusterIP: 8
    },
    ingressHosts: 1,
    hasNetworkPolicy: true
  },
  quota: {
    hasResourceQuota: true,
    topUsage: [
      {
        resource: 'requests.cpu',
        used: '2.4',
        hard: '8',
        percentage: 30
      },
      {
        resource: 'requests.memory',
        used: '6Gi',
        hard: '16Gi',
        percentage: 37.5
      }
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
}