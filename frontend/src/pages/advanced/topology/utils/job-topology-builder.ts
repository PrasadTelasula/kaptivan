import type { Node, Edge } from 'reactflow';
import type { JobTopology } from '../types/job';
import type { TopologyFilters } from '../types';
import { 
  buildPodNode, 
  buildServiceNode, 
  buildSecretNode,
  buildConfigMapNode,
  buildServiceAccountNode,
  buildContainerNode
} from './node-builders';
import {
  buildEndpointsNode,
  buildRoleNode,
  buildRoleBindingNode
} from './node-builders-rbac';
import { computeVolumeLinks } from './edge-builders';

export function buildJobTopologyGraph(
  topology: JobTopology | null,
  filters: TopologyFilters,
  layout: 'horizontal' | 'vertical' | 'radial',
  context: string
): { nodes: Node[]; edges: Edge[] } {
  if (!topology || !topology.job) {
    return { nodes: [], edges: [] };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Build Job node
  const jobNode: Node = {
    id: `job-${topology.job.name}`,
    type: 'job',
    position: { x: 0, y: 0 },
    data: {
      label: topology.job.name,
      status: getJobStatus(topology.job),
      resource: {
        completions: topology.job.completions,
        parallelism: topology.job.parallelism,
        active: topology.job.active,
        succeeded: topology.job.succeeded,
        failed: topology.job.failed,
        startTime: topology.job.startTime,
        completionTime: topology.job.completionTime,
        backoffLimit: topology.job.backoffLimit
      },
      namespace: topology.namespace,
      context
    }
  };
  nodes.push(jobNode);
  
  // Build Pod nodes if enabled
  const allPods = topology.pods || [];
  if (filters.showPods && allPods.length > 0) {
    allPods.forEach((pod, index) => {
      const podNode = buildPodNode(pod, topology.namespace, index, context);
      nodes.push(podNode);
      
      // Connect Job to Pod
      edges.push({
        id: `job-to-pod-${pod.name}`,
        source: `job-${topology.job.name}`,
        target: `pod-${pod.name}`,
        type: 'custom',
        data: {
          type: 'manages',
          label: 'creates'
        },
        markerEnd: {
          type: 'arrowclosed',
          color: '#10b981'
        }
      });
      
      // Build Container nodes if enabled
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
          edges.push({
            id: `pod-${pod.name}-to-container-${container.name}`,
            source: `pod-${pod.name}`,
            target: `container-${pod.name}-${container.name}`,
            type: 'custom',
            data: {
              type: 'contains',
              label: 'runs'
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#6b7280'
            }
          });
        });
      }
    });
  }
  
  // Add Service nodes if enabled (Jobs typically don't have services, but check anyway)
  if (filters.showServices && topology.services) {
    topology.services.forEach((service, index) => {
      nodes.push(buildServiceNode(service, topology.namespace, index, context));
      
      // Connect Service to Pods
      allPods.forEach(pod => {
        if (matchesSelector(pod, service.selector)) {
          edges.push({
            id: `service-${service.name}-to-pod-${pod.name}`,
            source: `service-${service.name}`,
            target: `pod-${pod.name}`,
            type: 'custom',
            data: {
              type: 'service',
              label: 'routes to'
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#3b82f6'
            }
          });
        }
      });
    });
  }
  
  // Add Endpoints nodes if enabled
  if (filters.showEndpoints && topology.endpoints) {
    topology.endpoints.forEach((endpoints, index) => {
      nodes.push(buildEndpointsNode(endpoints, topology.namespace, index, context));
      
      // Connect Service to Endpoints
      const matchingService = topology.services?.find(s => s.name === endpoints.name);
      if (matchingService) {
        edges.push({
          id: `service-${matchingService.name}-to-endpoints-${endpoints.name}`,
          source: `service-${matchingService.name}`,
          target: `endpoints-${endpoints.name}`,
          type: 'custom',
          data: {
            type: 'endpoints',
            label: 'has'
          },
          markerEnd: {
            type: 'arrowclosed',
            color: '#8b5cf6'
          }
        });
      }
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
  if (filters.statusFilter && filters.statusFilter !== 'all') {
    const filteredNodes = nodes.filter(node => {
      if (node.type === 'job') {
        const status = node.data.status;
        switch (filters.statusFilter) {
          case 'healthy':
            return status === 'Completed';
          case 'warning':
            return status === 'Active';
          case 'error':
            return status === 'Failed';
          default:
            return true;
        }
      }
      return true;
    });
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = validEdges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  return { nodes, edges: validEdges };
}

// Helper function to determine Job status
function getJobStatus(job: any): 'Completed' | 'Failed' | 'Active' | 'Unknown' {
  if (job.completionTime && job.succeeded > 0) {
    return 'Completed';
  } else if (job.failed > 0) {
    return 'Failed';
  } else if (job.active > 0) {
    return 'Active';
  }
  return 'Unknown';
}

// Helper function to check if pod matches service selector
function matchesSelector(pod: any, selector: Record<string, string> | undefined): boolean {
  if (!selector || !pod.labels) return false;
  
  return Object.entries(selector).every(([key, value]) => 
    pod.labels && pod.labels[key] === value
  );
}