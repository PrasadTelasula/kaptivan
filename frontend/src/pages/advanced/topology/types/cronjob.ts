// CronJob specific types
export interface CronJobSummary {
  name: string;
  namespace: string;
  schedule: string;
  suspend?: boolean;
  active: number;
  lastScheduleTime?: string;
  nextScheduleTime?: string;
}

export interface CronJobInfo {
  name: string;
  schedule: string;
  suspend?: boolean;
  lastScheduleTime?: string;
  nextScheduleTime?: string;
  active?: JobRef[];
  status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
  concurrencyPolicy?: string;
  startingDeadlineSeconds?: number;
}

export interface JobRef {
  name: string;
  namespace: string;
  startTime?: string;
  completionTime?: string;
  status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
  active: number;
  succeeded: number;
  failed: number;
  completions?: number;
  parallelism?: number;
  backoffLimit?: number;
}

export interface CronJobTopology {
  namespace: string;
  cronjob: CronJobInfo;
  jobs?: JobRef[];
  pods?: any[]; // Using existing PodRef type
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