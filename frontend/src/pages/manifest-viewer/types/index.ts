import type { LucideIcon } from 'lucide-react'

export interface ResourceItem {
  name: string
  namespace?: string
  kind: string
  apiVersion: string
  uid?: string
  creationTimestamp?: string
  clusterContext?: string
  clusterName?: string
  // ReplicaSet specific fields
  isCurrent?: boolean
  desiredReplicas?: number
  readyReplicas?: number
  age?: string
  ownerReference?: {
    kind: string
    name: string
    apiVersion: string
  }
  // Deployment specific fields
  availableReplicas?: number
  updatedReplicas?: number
  unavailableReplicas?: number
  // Pod specific fields
  podStatus?: string
  containerReady?: number
  containerTotal?: number
  // DaemonSet specific fields
  daemonSetDesiredReplicas?: number
  daemonSetReadyReplicas?: number
  daemonSetAvailableReplicas?: number
  daemonSetUpdatedReplicas?: number
  daemonSetUnavailableReplicas?: number
  // StatefulSet specific fields
  statefulSetDesiredReplicas?: number
  statefulSetReadyReplicas?: number
  statefulSetAvailableReplicas?: number
  statefulSetUpdatedReplicas?: number
  statefulSetUnavailableReplicas?: number
  // Job specific fields
  jobStatus?: string
  jobCompletionTime?: string
  jobStartTime?: string
  jobSucceededCount?: number
  jobFailedCount?: number
  // CronJob specific fields
  cronJobLastScheduleTime?: string
  cronJobNextScheduleTime?: string
  cronJobActiveJobs?: number
  cronJobLastSuccessfulTime?: string
  // Service specific fields
  serviceType?: string
  serviceClusterIP?: string
  serviceExternalIP?: string
  servicePorts?: number
  // ConfigMap specific fields
  configMapDataCount?: number
  // Secret specific fields
  secretType?: string
  secretDataCount?: number
  // PersistentVolume specific fields
  pvStatus?: string
  pvCapacity?: string
  pvAccessModes?: string
  // PersistentVolumeClaim specific fields
  pvcStatus?: string
  pvcCapacity?: string
  pvcAccessModes?: string
  // Ingress specific fields
  ingressStatus?: string
  ingressRulesCount?: number
  // Namespace specific fields
  namespaceStatus?: string
  // ServiceAccount specific fields
  serviceAccountSecretsCount?: number
  serviceAccountImagePullSecretsCount?: number
  // Role specific fields
  roleRulesCount?: number
  // RoleBinding specific fields
  roleBindingSubjectsCount?: number
  // ClusterRole specific fields
  clusterRoleRulesCount?: number
  // ClusterRoleBinding specific fields
  clusterRoleBindingSubjectsCount?: number
  // NetworkPolicy specific fields
  networkPolicyRulesCount?: number
  networkPolicyPodSelectorCount?: number
  // StorageClass specific fields
  storageClassProvisioner?: string
  storageClassReclaimPolicy?: string
  storageClassVolumeBindingMode?: string
  // Event specific fields
  eventReason?: string
  eventType?: string
  eventCount?: number
  // CustomResourceDefinition specific fields
  crdVersionCount?: number
  crdScope?: string
  // Node specific fields
  nodeStatus?: string
  nodeRole?: string
  nodeKubernetesVersion?: string
  nodeOS?: string
  nodeCapacity?: string
  nodePodCount?: number
  // ResourceQuota specific fields
  resourceQuotaStatus?: string
  resourceQuotaUsed?: string
  resourceQuotaHard?: string
  // LimitRange specific fields
  limitRangeStatus?: string
  limitRangeLimitsCount?: number
}

export interface ResourceGroup {
  name: string
  icon: LucideIcon
  expanded: boolean
  items: ResourceItem[]
  loading: boolean
  clusters?: Map<string, ResourceItem[]>
}

export interface ManifestTab {
  id: string
  title: string
  resource: ResourceItem
  content: string
  loading: boolean
}