// DaemonSet specific types
export interface DaemonSetInfo {
  name: string;
  desiredNumberScheduled: number;
  currentNumberScheduled: number;
  numberReady: number;
  numberAvailable?: number;
  numberMisscheduled?: number;
  updatedNumberScheduled?: number;
  status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
  labels?: Record<string, string>;
  updateStrategy?: string;
  nodeSelector?: Record<string, string>;
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
  creationTimestamp?: string;
}

export interface DaemonSetTopology {
  namespace: string;
  daemonset: DaemonSetInfo;
  pods?: PodRef[];
  services?: ServiceRef[];
  endpoints?: EndpointsRef[];
  secrets?: SecretRef[];
  configmaps?: ConfigMapRef[];
  serviceAccount?: ServiceAccountRef;
  roles?: RoleRef[];
  roleBindings?: RoleBindingRef[];
  clusterRoles?: RoleRef[];
  clusterRoleBindings?: RoleBindingRef[];
}

export interface DaemonSetSummary {
  name: string;
  namespace: string;
  desiredNumberScheduled: number;
  numberReady: number;
}

// Import shared types from main index
import type {
  PodRef,
  ServiceRef,
  EndpointsRef,
  SecretRef,
  ConfigMapRef,
  ServiceAccountRef,
  RoleRef,
  RoleBindingRef
} from './index';