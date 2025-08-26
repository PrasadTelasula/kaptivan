import {
  Box,
  Layers,
  Package,
  GitBranch,
  Database,
  Activity,
  Calendar,
  Network,
  Cloud,
  Shield,
  FileCode,
  Lock,
  HardDrive,
  Users,
  Server,
  Folder,
  Cpu,
  Settings,
} from 'lucide-react'

export const RESOURCE_CATEGORIES = [
  {
    category: 'Workloads',
    groups: [
      { name: 'Deployments', icon: Layers, apiVersion: 'apps/v1', kind: 'Deployment' },
      { name: 'ReplicaSets', icon: Package, apiVersion: 'apps/v1', kind: 'ReplicaSet' },
      { name: 'StatefulSets', icon: Database, apiVersion: 'apps/v1', kind: 'StatefulSet' },
      { name: 'DaemonSets', icon: GitBranch, apiVersion: 'apps/v1', kind: 'DaemonSet' },
      { name: 'Pods', icon: Box, apiVersion: 'v1', kind: 'Pod' },
      { name: 'Jobs', icon: Activity, apiVersion: 'batch/v1', kind: 'Job' },
      { name: 'CronJobs', icon: Calendar, apiVersion: 'batch/v1', kind: 'CronJob' },
    ]
  },
  {
    category: 'Networking',
    groups: [
      { name: 'Services', icon: Network, apiVersion: 'v1', kind: 'Service' },
      { name: 'Ingresses', icon: Cloud, apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
      { name: 'NetworkPolicies', icon: Shield, apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy' },
    ]
  },
  {
    category: 'Configuration',
    groups: [
      { name: 'ConfigMaps', icon: FileCode, apiVersion: 'v1', kind: 'ConfigMap' },
      { name: 'Secrets', icon: Lock, apiVersion: 'v1', kind: 'Secret' },
    ]
  },
  {
    category: 'Storage',
    groups: [
      { name: 'PersistentVolumes', icon: HardDrive, apiVersion: 'v1', kind: 'PersistentVolume' },
      { name: 'PersistentVolumeClaims', icon: HardDrive, apiVersion: 'v1', kind: 'PersistentVolumeClaim' },
      { name: 'StorageClasses', icon: Database, apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass' },
    ]
  },
  {
    category: 'Security',
    groups: [
      { name: 'ServiceAccounts', icon: Users, apiVersion: 'v1', kind: 'ServiceAccount' },
      { name: 'Roles', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role' },
      { name: 'RoleBindings', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding' },
      { name: 'ClusterRoles', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRole' },
      { name: 'ClusterRoleBindings', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRoleBinding' },
    ]
  },
  {
    category: 'Cluster',
    groups: [
      { name: 'Nodes', icon: Server, apiVersion: 'v1', kind: 'Node' },
      { name: 'Namespaces', icon: Folder, apiVersion: 'v1', kind: 'Namespace' },
      { name: 'ResourceQuotas', icon: Cpu, apiVersion: 'v1', kind: 'ResourceQuota' },
      { name: 'LimitRanges', icon: Settings, apiVersion: 'v1', kind: 'LimitRange' },
    ]
  }
]