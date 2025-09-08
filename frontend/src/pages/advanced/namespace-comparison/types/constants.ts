import type { SeverityThresholds } from './index'

export const SEVERITY_THRESHOLDS: SeverityThresholds = {
  capacity: {
    headroom: {
      warn: 10,  // <10% headroom
      crit: 5    // <5% headroom
    }
  },
  stability: {
    crashLoops: {
      warn: 1,   // >0 crashes
      crit: 10   // >10 crashes
    },
    restarts: {
      warn: 50,  // >50 restarts
      crit: 200  // >200 restarts
    },
    pending: {
      warn: 1,   // >0 pending
      crit: 5    // >5 pending
    }
  },
  exposure: {
    nodePortWithoutNetPol: true,
    loadBalancerWithoutNetPol: true,
    bothWithoutNetPol: true
  },
  quota: {
    usage: {
      warn: 80,  // >=80% usage
      crit: 95   // >=95% usage
    }
  },
  storage: {
    unbound: {
      warn: 1,   // >0 unbound
      crit: 5    // >=5 unbound
    },
    orphaned: {
      warn: 1,   // >0 orphaned
      crit: 5    // >=5 orphaned
    }
  },
  rbac: {
    adminBindings: true,
    wildcardRules: true,
    both: true
  }
}

export const ADMIN_CLUSTER_ROLES = ['cluster-admin', 'admin', 'edit'] as const