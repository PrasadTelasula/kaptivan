export interface JobInfo {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  startTime?: string;
  completionTime?: string;
  completions?: number;
  parallelism?: number;
  backoffLimit?: number;
  active: number;
  succeeded: number;
  failed: number;
  status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
}

export interface JobTopology {
  namespace: string;
  job: JobInfo;
  pods?: any[];
  services?: any[];
  endpoints?: any[];
  secrets?: any[];
  configmaps?: any[];
  serviceAccount?: any;
  roles?: any[];
  roleBindings?: any[];
  clusterRoles?: any[];
  clusterRoleBindings?: any[];
}

export interface JobSummary {
  name: string;
  namespace: string;
  completions?: number;
  parallelism?: number;
  active: number;
  succeeded: number;
  failed: number;
  startTime?: string;
  completionTime?: string;
}