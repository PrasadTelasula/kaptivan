export interface RBACRole {
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  rules: PolicyRule[];
}

export interface PolicyRule {
  verbs: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export interface RBACSubject {
  kind: 'User' | 'Group' | 'ServiceAccount';
  name: string;
  namespace?: string;
  apiGroup?: string;
}

export interface RBACRoleBinding {
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  subjects: RBACSubject[];
  roleRef: {
    apiGroup: string;
    kind: 'Role' | 'ClusterRole';
    name: string;
  };
}

export interface ServiceAccount {
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  secrets?: Array<{
    name: string;
  }>;
  imagePullSecrets?: Array<{
    name: string;
  }>;
}

export interface Pod {
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    serviceAccountName?: string;
    serviceAccount?: string;
    nodeName?: string;
    containers: Array<{
      name: string;
      image: string;
      ready?: boolean;
      restartCount?: number;
      state?: string;
      resources?: {
        requests?: {
          cpu?: string;
          memory?: string;
        };
        limits?: {
          cpu?: string;
          memory?: string;
        };
      };
    }>;
  };
  status: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown' | 'Terminating' | 'CrashLoopBackOff';
    conditions?: Array<{
      type: string;
      status: string;
    }>;
    podIP?: string;
    hostIP?: string;
    startTime?: string;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state?: {
        running?: { startedAt: string };
        waiting?: { reason: string };
        terminated?: { reason: string };
      };
    }>;
  };
}

export interface RBACResources {
  roles: RBACRole[];
  clusterRoles: RBACRole[];
  roleBindings: RBACRoleBinding[];
  clusterRoleBindings: RBACRoleBinding[];
  serviceAccounts: ServiceAccount[];
  pods?: Pod[];
  context?: string;
}

export interface RBACGraphNode {
  id: string;
  type: 'role' | 'clusterRole' | 'user' | 'group' | 'serviceaccount';
  label: string;
  data: {
    rules?: number;
    namespace?: string;
    kind?: string;
    [key: string]: any;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface RBACGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'roleBinding' | 'clusterRoleBinding';
  label: string;
}

export interface RBACGraph {
  nodes: RBACGraphNode[];
  edges: RBACGraphEdge[];
}

export interface Permission {
  subject: string;
  namespace: string;
  role: string;
  verbs: string[];
  resources: string[];
}

export interface PermissionMatrix {
  permissions: Permission[];
}

export interface RoleDetails {
  role: RBACRole;
  bindings: RBACRoleBinding[];
}

export interface SubjectPermission {
  role: string;
  roleType: 'Role' | 'ClusterRole';
  namespace: string;
  rules: PolicyRule[];
  binding: {
    name: string;
    type: 'RoleBinding' | 'ClusterRoleBinding';
  };
}

export interface SubjectPermissions {
  subject: string;
  kind: string;
  permissions: SubjectPermission[];
}

export type ViewMode = 'graph' | 'list' | 'hierarchy';

export interface FilterOptions {
  namespace?: string;
  filterType?: 'serviceAccount' | 'role' | 'clusterRole';
  filterValue?: string;
  showSystemRoles?: boolean;
  showServiceAccounts?: boolean;
  showUsers?: boolean;
  showGroups?: boolean;
  showBindings?: boolean;
  showPods?: boolean;
  searchTerm?: string;
}