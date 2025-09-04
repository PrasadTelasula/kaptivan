import type { Node, Edge, MarkerType } from 'reactflow';

export type K8sStatus = "Healthy" | "Warning" | "Error" | "Unknown";

export type PodPhase = "Running" | "Pending" | "Failed" | "Succeeded" | "Unknown" | "Terminating" | "CrashLoopBackOff";

// Resource-specific status types
export type DeploymentStatus = "Available" | "Progressing" | "Failed" | "Unknown";
export type DaemonSetStatus = "Available" | "Unavailable" | "Updating" | "Unknown";
export type JobStatus = "Succeeded" | "Running" | "Failed" | "Pending" | "Unknown";
export type CronJobStatus = "Active" | "Suspended" | "Scheduled" | "Succeeded" | "Failed" | "Unknown";

// Union type for all possible statuses
export type ResourceStatus = K8sStatus | DeploymentStatus | DaemonSetStatus | JobStatus | CronJobStatus | PodPhase | "all";

export interface ContainerRef {
  name: string;
  image: string;
  ready: boolean;
  restartCount?: number;
  state?: "running" | "waiting" | "terminated";
  reason?: string;
}

export interface PodRef {
  name: string;
  phase: PodPhase;
  containers: ContainerRef[];
  nodeName?: string;
  hostIP?: string;
  podIP?: string;
  qosClass?: "Guaranteed" | "Burstable" | "BestEffort";
  startTime?: string;
}

export interface ReplicaSetRef {
  name: string;
  desired: number;
  ready: number;
  available?: number;
  pods: PodRef[];
  generation?: number;
}

export interface ServiceRef {
  name: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  clusterIP?: string;
  externalIPs?: string[];
  ports: {
    name?: string;
    port: number;
    targetPort: number | string;
    protocol: "TCP" | "UDP" | "SCTP";
    nodePort?: number;
  }[];
  selector?: Record<string, string>;
}

export interface SecretRef {
  name: string;
  type?: string;
  mountedAt?: string[];
  data?: Record<string, string>;
  immutable?: boolean;
  createdAt?: string;
  creationTimestamp?: string;
}

export interface ConfigMapRef {
  name: string;
  mountedAt?: string[];
  data?: Record<string, string>;
  immutable?: boolean;
  createdAt?: string;
  creationTimestamp?: string;
}

export interface ServiceAccountRef {
  name: string;
  automountServiceAccountToken?: boolean;
  secrets?: string[];
}

export interface EndpointsRef {
  name: string;
  creationTimestamp?: string;
  addresses: {
    ip: string;
    nodeName?: string;
    targetRef?: {
      kind: string;
      name: string;
      namespace: string;
    };
  }[];
  ports: {
    name?: string;
    port: number;
    protocol: string;
  }[];
}

export interface RoleRef {
  name: string;
  namespace?: string; // undefined for ClusterRole
  rules: {
    apiGroups?: string[];
    resources?: string[];
    verbs: string[];
    resourceNames?: string[];
  }[];
}

export interface RoleBindingRef {
  name: string;
  namespace?: string; // undefined for ClusterRoleBinding
  roleRef: {
    apiGroup: string;
    kind: string;
    name: string;
  };
  subjects: {
    kind: string;
    name: string;
    namespace?: string;
  }[];
}

export interface DeploymentTopology {
  namespace: string;
  deployment: {
    name: string;
    replicas: number;
    available: number;
    ready?: number;
    updated?: number;
    revision?: number;
    status: K8sStatus;
    labels?: Record<string, string>;
    strategy?: "RollingUpdate" | "Recreate";
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
  services: ServiceRef[];
  endpoints: EndpointsRef[];
  replicasets: ReplicaSetRef[];
  secrets: SecretRef[];
  configmaps: ConfigMapRef[];
  serviceAccount?: ServiceAccountRef;
  roles?: RoleRef[];
  roleBindings?: RoleBindingRef[];
  clusterRoles?: RoleRef[];
  clusterRoleBindings?: RoleBindingRef[];
}

export type NodeType = 
  | "deployment"
  | "service"
  | "endpoints"
  | "replicaset"
  | "pod"
  | "container"
  | "secret"
  | "configmap"
  | "serviceaccount"
  | "role"
  | "rolebinding"
  | "clusterrole"
  | "clusterrolebinding";

export interface TopologyNode extends Node {
  type: NodeType;
  data: {
    label: string;
    status?: K8sStatus;
    phase?: PodPhase;
    resource: any;
    namespace?: string;
    details?: Record<string, any>;
  };
}

export interface TopologyEdge extends Edge {
  type?: string;
  animated?: boolean;
  markerEnd?: {
    type: MarkerType;
    color?: string;
  };
  style?: React.CSSProperties;
  label?: string;
}

export interface TopologyFilters {
  showServices: boolean;
  showEndpoints: boolean;
  showSecrets: boolean;
  showConfigMaps: boolean;
  showServiceAccount: boolean;
  showRBAC: boolean;
  statusFilter: ResourceStatus;
  searchTerm: string;
  showContainers: boolean;
  showReplicaSets?: boolean;
  showPods?: boolean;
}

export interface TopologyViewOptions {
  layout: "horizontal" | "vertical" | "radial";
  spacing: {
    nodeWidth: number;
    nodeHeight: number;
    rankSeparation: number;
    nodeSeparation: number;
  };
  showMinimap: boolean;
  showControls: boolean;
  showBackground: boolean;
}