import type {
  DeploymentTopology,
  TopologyNode,
  TopologyEdge,
  TopologyFilters
} from '../types';
import {
  buildDeploymentNode,
  buildServiceNode,
  buildReplicaSetNode,
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
  buildDeploymentToReplicaSetEdge,
  buildReplicaSetToPodEdge,
  buildPodToContainerEdge,
  buildDeploymentToServiceAccountEdge,
  computeServiceToPodLinks,
  computeVolumeLinks
} from './edge-builders';
import {
  buildServiceToEndpointsEdge,
  buildEndpointsToPodEdge,
  buildServiceAccountToRoleBindingEdge,
  buildRoleBindingToRoleEdge
} from './edge-builders-animated';

export const buildTopologyNodesEdges = (
  topology: DeploymentTopology | null,
  filters: TopologyFilters,
  context?: string,
  layout: 'horizontal' | 'vertical' | 'radial' = 'horizontal'
): { nodes: TopologyNode[]; edges: TopologyEdge[] } => {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  
  // Return empty if no topology data
  if (!topology) {
    return { nodes, edges };
  }
  
  // Add deployment node
  const deploymentNode = buildDeploymentNode(topology.deployment, topology.namespace, context);
  nodes.push(deploymentNode);
  
  // Add service nodes if enabled
  if (filters.showServices && topology.services) {
    topology.services.forEach((service, index) => {
      nodes.push(buildServiceNode(service, topology.namespace, index, context));
    });
  }
  
  // Add endpoints nodes if enabled
  if (filters.showEndpoints && topology.endpoints) {
    topology.endpoints.forEach((endpoints, index) => {
      nodes.push(buildEndpointsNode(endpoints, topology.namespace, index, context));
      
      // Connect service to endpoints (animated)
      const matchingService = topology.services?.find(s => s.name === endpoints.name);
      if (matchingService) {
        edges.push(buildServiceToEndpointsEdge(matchingService.name, endpoints.name, layout === 'horizontal'));
      }
    });
  }
  
  // Add replicaset nodes and their pods
  const allPods: any[] = [];
  if (topology.replicasets) {
    topology.replicasets.forEach((rs, rsIndex) => {
    const rsNode = buildReplicaSetNode(rs, topology.namespace, rsIndex, context);
    nodes.push(rsNode);
    
    // Connect deployment to replicaset
    // Determine if this is the current RS based on replica count
    // Current RS has desired > 0, previous/old RS has desired === 0
    const isCurrent = rs.desired > 0;
    edges.push(
      buildDeploymentToReplicaSetEdge(
        topology.deployment.name,
        rs.name,
        isCurrent,
        layout === 'horizontal'
      )
    );
    
    // Add pod nodes
    rs.pods.forEach((pod, podIndex) => {
      const podNode = buildPodNode(pod, topology.namespace, rs.name, podIndex, context);
      nodes.push(podNode);
      allPods.push(pod);
      
      // Connect replicaset to pod
      edges.push(buildReplicaSetToPodEdge(rs.name, pod.name, layout === 'horizontal'));
      
      // Add container nodes if enabled
      if (filters.showContainers) {
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
  });
  }
  
  // Add endpoint to pod edges only if endpoints are shown
  if (filters.showEndpoints && topology.endpoints) {
    // Connect endpoints to pods (animated)
    topology.endpoints.forEach(endpoint => {
      endpoint.addresses?.forEach(addr => {
        if (addr.targetRef?.kind === 'Pod') {
          const podName = addr.targetRef.name;
          // Check if this pod exists in our nodes
          if (allPods.some(p => p.name === podName)) {
            edges.push(buildEndpointsToPodEdge(endpoint.name, podName, layout === 'horizontal'));
          }
        }
      });
    });
  }
  // Note: Services should NOT connect directly to Pods - they only connect via Endpoints
  
  // Add secret nodes if enabled
  if (filters.showSecrets && topology.secrets) {
    topology.secrets.forEach((secret, index) => {
      nodes.push(buildSecretNode(secret, topology.namespace, index, context));
    });
  }
  
  // Add configmap nodes if enabled
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
  
  // Add service account node if enabled
  if (filters.showServiceAccount && topology.serviceAccount) {
    nodes.push(buildServiceAccountNode(topology.serviceAccount, topology.namespace, context));
    // No edge between deployment and serviceaccount - removed per user request
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
    
    // Add RoleBindings and connect them
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
    
    // Add ClusterRoleBindings and connect them
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
  
  // Remove orphaned edges (edges where source or target node doesn't exist)
  const nodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(edge => {
    const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
    if (!isValid) {
      console.warn('Orphaned edge removed:', {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceExists: nodeIds.has(edge.source),
        targetExists: nodeIds.has(edge.target)
      });
    }
    return isValid;
  });
  
  // Additional cleanup: ensure no duplicate edges
  const uniqueEdges = validEdges.filter((edge, index, self) =>
    index === self.findIndex(e => e.id === edge.id)
  );
  
  // Apply search filter
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    const filteredNodes = nodes.filter(node =>
      node.data.label.toLowerCase().includes(searchLower) ||
      node.type.includes(searchLower)
    );
    
    // Keep edges that connect filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = uniqueEdges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  // Apply status filter
  if (filters.statusFilter !== 'all') {
    const filteredNodes = nodes.filter(node => {
      if (node.type === 'deployment') {
        const deployment = topology.deployment;
        // Filter by Deployment status
        switch (filters.statusFilter) {
          case 'Available':
            return deployment.available === deployment.replicas;
          case 'Progressing':
            return deployment.available < deployment.replicas && deployment.available > 0;
          case 'Failed':
            return deployment.available === 0 && deployment.replicas > 0;
          case 'Unknown':
            return deployment.status === 'Unknown';
          case 'Healthy':
            return deployment.status === 'Healthy';
          case 'Warning':
            return deployment.status === 'Warning';
          case 'Error':
            return deployment.status === 'Error';
          default:
            return true;
        }
      } else if (node.type === 'pod') {
        // Filter pods by their phase
        const pod = node.data.resource;
        if (pod && pod.phase) {
          switch (filters.statusFilter) {
            case 'Running':
            case 'Available':
              return pod.phase === 'Running';
            case 'Pending':
            case 'Progressing':
              return pod.phase === 'Pending';
            case 'Failed':
              return pod.phase === 'Failed';
            case 'Succeeded':
              return pod.phase === 'Succeeded';
            case 'Unknown':
              return pod.phase === 'Unknown' || !pod.phase;
            default:
              return false;
          }
        }
        // If no phase, only show for Unknown filter
        return filters.statusFilter === 'Unknown';
      }
      // For other node types (services, configmaps, secrets, etc.)
      // Only show them when "all" is selected, hide for specific status filters
      const deploymentSpecificStatuses = ['Available', 'Progressing', 'Failed', 'Unknown', 'Healthy', 'Warning', 'Error'];
      if (deploymentSpecificStatuses.includes(filters.statusFilter as string)) {
        // Don't show auxiliary resources when filtering by specific statuses
        return false;
      }
      return true;
    });
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = uniqueEdges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  return { nodes, edges: uniqueEdges };
};