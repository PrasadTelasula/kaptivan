import { MarkerType } from 'reactflow';
import type {
  TopologyEdge,
  DeploymentTopology,
  ServiceRef,
  PodRef
} from '../types';
import { statusToColor } from './status-helpers';

export const buildDeploymentToReplicaSetEdge = (
  deploymentName: string,
  replicaSetName: string,
  isCurrent: boolean = true,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-dep-rs-${deploymentName}-${replicaSetName}`,
  source: `deployment-${deploymentName}`,
  target: `replicaset-${replicaSetName}`,
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {
    animated: isCurrent,
    label: isCurrent ? 'current' : 'previous'
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: isCurrent ? '#3b82f6' : '#9ca3af'
  }
});

export const buildReplicaSetToPodEdge = (
  replicaSetName: string,
  podName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-rs-pod-${replicaSetName}-${podName}`,
  source: `replicaset-${replicaSetName}`,
  target: `pod-${podName}`,
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {},
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#6b7280'
  }
});

export const buildPodToContainerEdge = (
  podName: string,
  containerName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-pod-container-${podName}-${containerName}`,
  source: `pod-${podName}`,
  target: `container-${podName}-${containerName}`,
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {},
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#9ca3af'
  }
});

export const buildServiceToPodEdge = (
  serviceName: string,
  podName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-service-pod-${serviceName}-${podName}`,
  source: `service-${serviceName}`,
  target: `pod-${podName}`,
  // In horizontal layout, use only left/right edges for non-RBAC nodes
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {
    animated: true,
    type: 'service',
    label: 'selects'
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#10b981'
  }
});

export const buildDeploymentToServiceAccountEdge = (
  deploymentName: string,
  serviceAccountName: string
): TopologyEdge => ({
  id: `edge-dep-sa-${deploymentName}-${serviceAccountName}`,
  source: `deployment-${deploymentName}`,
  target: `serviceaccount-${serviceAccountName}`,
  type: 'custom',
  data: {},
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#8b5cf6'
  },
  label: 'uses'
});

export const buildPodToSecretEdge = (
  podName: string,
  secretName: string,
  mountPath?: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-pod-secret-${podName}-${secretName}`,
  source: `pod-${podName}`,
  target: `secret-${secretName}`,
  // In horizontal layout, use only left/right edges for non-RBAC nodes
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'smoothstep',
  style: {
    stroke: '#f59e0b',
    strokeWidth: 1,
    strokeDasharray: '2 2'
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#f59e0b'
  },
  label: mountPath ? `mounts at ${mountPath}` : 'mounts'
});

export const buildPodToConfigMapEdge = (
  podName: string,
  configMapName: string,
  mountPath?: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-pod-cm-${podName}-${configMapName}`,
  source: `pod-${podName}`,
  target: `configmap-${configMapName}`,
  // In horizontal layout, use only left/right edges for non-RBAC nodes
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'smoothstep',
  style: {
    stroke: '#06b6d4',
    strokeWidth: 1,
    strokeDasharray: '2 2'
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#06b6d4'
  },
  label: mountPath ? `mounts at ${mountPath}` : 'mounts'
});

export const computeServiceToPodLinks = (
  services: ServiceRef[],
  pods: PodRef[],
  isHorizontal: boolean = true
): TopologyEdge[] => {
  const edges: TopologyEdge[] = [];
  
  services.forEach(service => {
    if (!service.selector) return;
    
    pods.forEach(pod => {
      // In real implementation, match pod labels with service selector
      // For demo, we'll connect to running pods
      if (pod.phase === "Running") {
        edges.push(buildServiceToPodEdge(service.name, pod.name, isHorizontal));
      }
    });
  });
  
  return edges;
};

export const computeVolumeLinks = (
  pods: PodRef[],
  secrets: SecretRef[],
  configMaps: ConfigMapRef[],
  isHorizontal: boolean = true
): TopologyEdge[] => {
  const edges: TopologyEdge[] = [];
  
  // Connect pods to mounted secrets
  secrets.forEach(secret => {
    if (secret.mountedAt) {
      secret.mountedAt.forEach(podName => {
        const pod = pods.find(p => p.name === podName);
        if (pod) {
          edges.push(buildPodToSecretEdge(pod.name, secret.name, undefined, isHorizontal));
        }
      });
    }
  });
  
  // Connect pods to mounted configmaps
  configMaps.forEach(configMap => {
    if (configMap.mountedAt) {
      configMap.mountedAt.forEach(podName => {
        const pod = pods.find(p => p.name === podName);
        if (pod) {
          edges.push(buildPodToConfigMapEdge(pod.name, configMap.name, undefined, isHorizontal));
        }
      });
    }
  });
  
  return edges;
};