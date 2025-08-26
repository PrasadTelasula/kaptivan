import type {
  TopologyNode,
  TopologyEdge,
  TopologyFilters
} from '../types';
import type { DaemonSetTopology } from '../types/daemonset';
import {
  buildServiceNode,
  buildPodNode,
  buildContainerNode,
  buildSecretNode,
  buildConfigMapNode,
  buildServiceAccountNode
} from './node-builders';
import {
  buildEndpointsNode,
  buildRoleNode,
  buildRoleBindingNode
} from './node-builders-rbac';
import {
  buildPodToContainerEdge,
  computeVolumeLinks
} from './edge-builders';
import {
  buildServiceToEndpointsEdge,
  buildEndpointsToPodEdge
} from './edge-builders-animated';

// Build DaemonSet node
export const buildDaemonSetNode = (
  daemonset: DaemonSetTopology['daemonset'],
  namespace: string,
  context?: string
): TopologyNode => ({
  id: `daemonset-${daemonset.name}`,
  type: 'daemonset',
  position: { x: 0, y: 0 },
  data: {
    label: daemonset.name,
    status: daemonset.status,
    resource: daemonset,
    namespace,
    context
  }
});

// Build DaemonSet to Pod edge
export const buildDaemonSetToPodEdge = (
  daemonsetName: string,
  podName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `edge-ds-pod-${daemonsetName}-${podName}`,
  source: `daemonset-${daemonsetName}`,
  target: `pod-${podName}`,
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {},
  markerEnd: {
    type: 'arrowclosed',
    color: '#6b7280'
  }
});

export const buildDaemonSetTopologyNodesEdges = (
  topology: DaemonSetTopology | null,
  filters: TopologyFilters,
  context?: string,
  layout: 'horizontal' | 'vertical' | 'radial' = 'horizontal'
): { nodes: TopologyNode[]; edges: TopologyEdge[] } => {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  
  if (!topology) {
    return { nodes, edges };
  }
  
  // Add DaemonSet node
  const daemonsetNode = buildDaemonSetNode(topology.daemonset, topology.namespace, context);
  nodes.push(daemonsetNode);
  
  // Add Service nodes if enabled
  if (filters.showServices && topology.services) {
    topology.services.forEach((service, index) => {
      nodes.push(buildServiceNode(service, topology.namespace, index, context));
    });
  }
  
  // Add Endpoints nodes if enabled
  if (filters.showEndpoints && topology.endpoints) {
    topology.endpoints.forEach((endpoints, index) => {
      nodes.push(buildEndpointsNode(endpoints, topology.namespace, index, context));
      
      // Connect service to endpoints
      const matchingService = topology.services?.find(s => s.name === endpoints.name);
      if (matchingService) {
        edges.push(buildServiceToEndpointsEdge(matchingService.name, endpoints.name, layout === 'horizontal'));
      }
    });
  }
  
  // Add Pod nodes directly connected to DaemonSet
  const allPods: any[] = [];
  if (topology.pods) {
    topology.pods.forEach((pod, podIndex) => {
      const podNode = buildPodNode(pod, topology.namespace, topology.daemonset.name, podIndex, context);
      nodes.push(podNode);
      allPods.push(pod);
      
      // Connect DaemonSet directly to pod (no ReplicaSet)
      edges.push(buildDaemonSetToPodEdge(topology.daemonset.name, pod.name, layout === 'horizontal'));
      
      // Add container nodes if enabled
      if (filters.showContainers && pod.containers) {
        pod.containers.forEach((container, containerIndex) => {
          const containerNode = buildContainerNode(
            container,
            pod.name,
            topology.namespace,
            containerIndex,
            pod.name,
            context
          );
          nodes.push(containerNode);
          
          // Connect pod to container
          edges.push(buildPodToContainerEdge(pod.name, container.name, layout === 'horizontal'));
        });
      }
    });
  }
  
  // Add endpoint to pod edges
  if (filters.showEndpoints && topology.endpoints) {
    topology.endpoints.forEach(endpoint => {
      endpoint.addresses?.forEach(addr => {
        if (addr.targetRef?.kind === 'Pod') {
          const podName = addr.targetRef.name;
          if (allPods.some(p => p.name === podName)) {
            edges.push(buildEndpointsToPodEdge(endpoint.name, podName, layout === 'horizontal'));
          }
        }
      });
    });
  }
  
  // Add Secret nodes if enabled
  if (filters.showSecrets && topology.secrets) {
    topology.secrets.forEach((secret, index) => {
      nodes.push(buildSecretNode(secret, topology.namespace, index, context));
    });
  }
  
  // Add ConfigMap nodes if enabled
  if (filters.showConfigMaps && topology.configmaps) {
    topology.configmaps.forEach((configMap, index) => {
      nodes.push(buildConfigMapNode(configMap, topology.namespace, index, context));
    });
  }
  
  // Add volume mount edges
  if ((filters.showSecrets || filters.showConfigMaps) && (topology.secrets || topology.configmaps)) {
    const volumeEdges = computeVolumeLinks(allPods, topology.secrets || [], topology.configmaps || [], layout === 'horizontal');
    edges.push(...volumeEdges);
  }
  
  // Add ServiceAccount node if enabled
  if (filters.showServiceAccount && topology.serviceAccount) {
    nodes.push(buildServiceAccountNode(topology.serviceAccount, topology.namespace, context));
  }
  
  // Add RBAC resources if enabled
  if (filters.showRBAC) {
    // Add Roles
    if (topology.roles) {
      topology.roles.forEach((role, index) => {
        nodes.push(buildRoleNode(role, topology.namespace, index, false, context));
      });
    }
    
    // Add ClusterRoles
    if (topology.clusterRoles) {
      topology.clusterRoles.forEach((role, index) => {
        nodes.push(buildRoleNode(role, topology.namespace, index, true, context));
      });
    }
    
    // Add RoleBindings
    if (topology.roleBindings) {
      topology.roleBindings.forEach((binding, index) => {
        nodes.push(buildRoleBindingNode(binding, topology.namespace, index, false, context));
        
        // Connect ServiceAccount to RoleBinding
        if (topology.serviceAccount) {
          edges.push({
            id: `sa-${topology.serviceAccount.name}-to-binding-${binding.name}`,
            source: `serviceaccount-${topology.serviceAccount.name}`,
            target: `rolebinding-${binding.name}`,
            type: 'custom',
            data: {
              type: 'rbac',
              label: 'binds'
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#f97316'
            }
          });
        }
        
        // Connect RoleBinding to Role
        if (binding.roleRef?.kind === 'Role') {
          const role = topology.roles?.find(r => r.name === binding.roleRef.name);
          if (role) {
            edges.push({
              id: `binding-${binding.name}-to-role-${role.name}`,
              source: `rolebinding-${binding.name}`,
              target: `role-${role.name}`,
              type: 'custom',
              data: {
                type: 'rbac',
                label: 'references'
              },
              markerEnd: {
                type: 'arrowclosed',
                color: '#f97316'
              }
            });
          }
        }
      });
    }
    
    // Add ClusterRoleBindings
    if (topology.clusterRoleBindings) {
      topology.clusterRoleBindings.forEach((binding, index) => {
        nodes.push(buildRoleBindingNode(binding, topology.namespace, index, true, context));
        
        // Connect ServiceAccount to ClusterRoleBinding
        if (topology.serviceAccount) {
          edges.push({
            id: `sa-${topology.serviceAccount.name}-to-binding-${binding.name}`,
            source: `serviceaccount-${topology.serviceAccount.name}`,
            target: `clusterrolebinding-${binding.name}`,
            type: 'custom',
            data: {
              type: 'rbac',
              label: 'binds'
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#f97316'
            }
          });
        }
        
        // Connect ClusterRoleBinding to ClusterRole
        if (binding.roleRef?.kind === 'ClusterRole') {
          const role = topology.clusterRoles?.find(r => r.name === binding.roleRef.name);
          if (role) {
            edges.push({
              id: `binding-${binding.name}-to-clusterrole-${role.name}`,
              source: `clusterrolebinding-${binding.name}`,
              target: `clusterrole-${role.name}`,
              type: 'custom',
              data: {
                type: 'rbac',
                label: 'references'
              },
              markerEnd: {
                type: 'arrowclosed',
                color: '#f97316'
              }
            });
          }
        }
      });
    }
  }
  
  // Remove orphaned edges
  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  
  // Apply search filter
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    const filteredNodes = nodes.filter(node =>
      node.data.label.toLowerCase().includes(searchLower) ||
      node.type.includes(searchLower)
    );
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = validEdges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  // Apply status filter
  if (filters.statusFilter !== 'all') {
    const filteredNodes = nodes.filter(node =>
      node.data.status === filters.statusFilter
    );
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = validEdges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  return { nodes, edges: validEdges };
};