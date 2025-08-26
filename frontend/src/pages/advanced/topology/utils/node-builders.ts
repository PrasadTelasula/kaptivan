import { MarkerType } from 'reactflow';
import type {
  TopologyNode,
  TopologyEdge,
  DeploymentTopology,
  K8sStatus,
  ServiceRef,
  ReplicaSetRef,
  PodRef,
  ContainerRef,
  SecretRef,
  ConfigMapRef,
  ServiceAccountRef
} from '../types';
import { 
  getDeploymentStatus, 
  getReplicaSetStatus, 
  phaseToStatus,
  getContainerStatus,
  statusToColor 
} from './status-helpers';

let nodeIdCounter = 0;
const generateNodeId = (prefix: string) => `${prefix}-${nodeIdCounter++}`;

export const buildDeploymentNode = (
  deployment: DeploymentTopology['deployment'],
  namespace: string,
  context?: string
): TopologyNode => ({
  id: `deployment-${deployment.name}`,
  type: 'deployment',
  position: { x: 0, y: 0 },
  data: {
    label: deployment.name,
    status: deployment.status,
    resource: deployment,
    namespace,
    context,
    details: {
      replicas: deployment.replicas,
      available: deployment.available,
      ready: deployment.ready,
      strategy: deployment.strategy || 'RollingUpdate'
    }
  }
});

export const buildServiceNode = (
  service: ServiceRef,
  namespace: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `service-${service.name}`,
  type: 'service',
  position: { x: 0, y: 0 },
  data: {
    label: service.name,
    status: "Healthy" as K8sStatus,
    resource: service,
    namespace,
    context,
    details: {
      type: service.type,
      clusterIP: service.clusterIP,
      ports: service.ports
    }
  }
});

export const buildReplicaSetNode = (
  replicaSet: ReplicaSetRef,
  namespace: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `replicaset-${replicaSet.name}`,
  type: 'replicaset',
  position: { x: 0, y: 0 },
  data: {
    label: replicaSet.name.length > 20 
      ? `${replicaSet.name.substring(0, 17)}...` 
      : replicaSet.name,
    status: getReplicaSetStatus(replicaSet.desired, replicaSet.ready),
    resource: replicaSet,
    namespace,
    context,
    details: {
      desired: replicaSet.desired,
      ready: replicaSet.ready,
      available: replicaSet.available
    }
  }
});

export const buildPodNode = (
  pod: PodRef,
  namespace: string,
  parentId: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `pod-${pod.name}`,
  type: 'pod',
  position: { x: 0, y: 0 },
  data: {
    label: pod.name.length > 25 
      ? `${pod.name.substring(0, 22)}...` 
      : pod.name,
    phase: pod.phase,
    status: phaseToStatus(pod.phase),
    resource: pod,
    namespace,
    context,
    details: {
      phase: pod.phase,
      nodeName: pod.nodeName,
      podIP: pod.podIP,
      containers: pod.containers.length,
      qosClass: pod.qosClass
    }
  }
});

export const buildContainerNode = (
  container: ContainerRef,
  podId: string,
  namespace: string,
  index: number,
  podName?: string,
  context?: string
): TopologyNode => {
  // Create a hash of the resource data to force React Flow to update when resources change
  const resourceHash = JSON.stringify({
    cpu: container.resources?.requests?.cpu,
    memory: container.resources?.requests?.memory,
    cpuLimit: container.resources?.limits?.cpu,
    memoryLimit: container.resources?.limits?.memory
  });
  
  return {
    id: `container-${podId}-${container.name}`,
    type: 'container',
    position: { x: 0, y: 0 },
    data: {
      label: container.name,
      status: getContainerStatus(container),
      resource: container,
      namespace,
      podName,
      context,
      ready: container.ready,
      // Add resource hash to force update when resources change
      resourceHash,
      details: {
        image: container.image.split('/').pop()?.split(':')[0] || container.image,
        ready: container.ready,
        state: container.state,
        restartCount: container.restartCount
      }
    }
  };
};

export const buildSecretNode = (
  secret: SecretRef,
  namespace: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `secret-${secret.name}`,
  type: 'secret',
  position: { x: 0, y: 0 },
  data: {
    label: secret.name,
    status: "Healthy" as K8sStatus,
    resource: secret,
    namespace,
    context,
    details: {
      type: secret.type || 'Opaque',
      mountedAt: secret.mountedAt
    }
  }
});

export const buildConfigMapNode = (
  configMap: ConfigMapRef,
  namespace: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `configmap-${configMap.name}`,
  type: 'configmap',
  position: { x: 0, y: 0 },
  data: {
    label: configMap.name,
    status: "Healthy" as K8sStatus,
    resource: configMap,
    namespace,
    context,
    details: {
      mountedAt: configMap.mountedAt,
      keys: configMap.data ? Object.keys(configMap.data).length : 0
    }
  }
});

export const buildServiceAccountNode = (
  serviceAccount: ServiceAccountRef,
  namespace: string,
  context?: string
): TopologyNode => ({
  id: `serviceaccount-${serviceAccount.name}`,
  type: 'serviceaccount',
  position: { x: 0, y: 0 },
  data: {
    label: serviceAccount.name,
    status: "Healthy" as K8sStatus,
    resource: serviceAccount,
    namespace,
    context,
    details: {
      automount: serviceAccount.automountServiceAccountToken,
      secrets: serviceAccount.secrets?.length || 0
    }
  }
});

export const buildResourceGroupNode = (
  type: 'configmap' | 'secret',
  items: string[],
  namespace: string,
  context?: string
): TopologyNode => ({
  id: `${type}-group`,
  type: 'group',
  position: { x: 0, y: 0 },
  data: {
    label: `${type === 'configmap' ? 'ConfigMaps' : 'Secrets'} (${items.length})`,
    status: "Healthy" as K8sStatus,
    resource: { count: items.length, items },
    namespace,
    context,
    isGroup: true,
    groupType: type,
    details: {
      itemCount: items.length,
      items: items.slice(0, 3), // Show first 3 items
      hasMore: items.length > 3
    }
  }
});