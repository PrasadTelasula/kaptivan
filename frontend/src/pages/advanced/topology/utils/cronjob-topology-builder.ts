import type { Node, Edge } from 'reactflow';
import type { CronJobTopology } from '../types/cronjob';
import type { TopologyFilters, TopologyNode, TopologyEdge } from '../types';
import { applyDagreLayout } from '../utils/layout';

export function buildCronJobTopologyGraph(
  topology: CronJobTopology,
  filters: TopologyFilters,
  layout: 'horizontal' | 'vertical' | 'radial',
  context: string
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  if (!topology) {
    return { nodes: [], edges: [] };
  }

  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  // Add CronJob node (always shown)
  const cronJobId = 'cronjob';
  nodes.push({
    id: cronJobId,
    type: 'cronjob',
    position: { x: 0, y: 0 },
    data: {
      label: topology.cronjob.name,
      resource: topology.cronjob,
      context,
      namespace: topology.namespace,
    },
  });

  // Add Job nodes
  if (topology.jobs && topology.jobs.length > 0) {
    topology.jobs.forEach((job) => {
      const jobId = `job-${job.name}`;
      
      // Determine job status
      let status: 'Completed' | 'Failed' | 'Active' | 'Unknown' = 'Unknown';
      if (job.succeeded > 0 && job.active === 0) {
        status = 'Completed';
      } else if (job.failed > 0 && job.active === 0) {
        status = 'Failed';
      } else if (job.active > 0) {
        status = 'Active';
      }
      
      nodes.push({
        id: jobId,
        type: 'job',
        position: { x: 0, y: 0 },
        data: {
          label: job.name,
          status,
          resource: {
            completions: job.completions || 1,
            parallelism: job.parallelism || 1,
            active: job.active,
            succeeded: job.succeeded,
            failed: job.failed,
            startTime: job.startTime,
            completionTime: job.completionTime,
            backoffLimit: job.backoffLimit,
          },
          context,
          namespace: topology.namespace,
        },
      });

      // Connect CronJob to Jobs
      edges.push({
        id: `cronjob-${jobId}`,
        source: cronJobId,
        target: jobId,
        type: 'custom',
        animated: job.active > 0,
        data: {
          animated: job.active > 0,
          type: 'cronjob',
        },
        style: {
          strokeWidth: 2,
          stroke: job.status === 'Healthy' ? '#10b981' : 
                 job.status === 'Error' ? '#ef4444' : '#f59e0b',
        },
      });
    });
  }

  // Add Pod nodes (if filter allows)
  if (filters.showPods && topology.pods && topology.pods.length > 0) {
    topology.pods.forEach((pod: any) => {
      const podId = `pod-${pod.name}`;
      nodes.push({
        id: podId,
        type: 'pod',
        position: { x: 0, y: 0 },
        data: {
          label: pod.name,
          resource: pod,
          phase: pod.phase,
          context,
          namespace: topology.namespace,
        },
      });

      // Connect Jobs to Pods (find parent job from pod owner references)
      if (pod.ownerReferences) {
        pod.ownerReferences.forEach((owner: any) => {
          if (owner.kind === 'Job') {
            const jobId = `job-${owner.name}`;
            if (nodes.find(n => n.id === jobId)) {
              edges.push({
                id: `${jobId}-${podId}`,
                source: jobId,
                target: podId,
                type: 'custom',
                data: {
                  animated: pod.phase === 'Running',
                  type: 'job',
                },
                style: {
                  strokeWidth: 1,
                  stroke: '#94a3b8',
                },
              });
            }
          }
        });
      }
      
      // Add Container nodes (if filter allows)
      if (filters.showContainers && pod.containers && pod.containers.length > 0) {
        pod.containers.forEach((container: any, index: number) => {
          const containerId = `container-${pod.name}-${container.name}`;
          nodes.push({
            id: containerId,
            type: 'container',
            position: { x: 0, y: 0 },
            data: {
              label: container.name,
              resource: container,
              context,
              namespace: topology.namespace,
            },
          });
          
          // Connect Pod to Container
          edges.push({
            id: `${podId}-${containerId}`,
            source: podId,
            target: containerId,
            type: 'custom',
            data: {
              animated: container.state === 'running',
              type: 'container',
            },
            style: {
              strokeWidth: 1,
              stroke: '#6b7280',
            },
          });
        });
      }
    });
  }

  // Add Service nodes (if filter allows) - though rare for CronJobs
  if (filters.showServices && topology.services && topology.services.length > 0) {
    topology.services.forEach((service: any) => {
      const serviceId = `service-${service.name}`;
      nodes.push({
        id: serviceId,
        type: 'service',
        position: { x: 0, y: 0 },
        data: {
          label: service.name,
          resource: service,
          context,
          namespace: topology.namespace,
        },
      });

      // Connect Services to Pods
      topology.pods?.forEach((pod: any) => {
        if (service.selector && matchLabels(pod.labels, service.selector)) {
          edges.push({
            id: `${serviceId}-pod-${pod.name}`,
            source: serviceId,
            target: `pod-${pod.name}`,
            type: 'custom',
            data: {
              animated: false,
              type: 'service',
            },
            style: {
              strokeWidth: 1,
              stroke: '#64748b',
              strokeDasharray: '5 5',
            },
          });
        }
      });
    });
  }

  // Group ConfigMaps (if filter allows)
  if (filters.showConfigMaps && topology.configmaps && topology.configmaps.length > 0) {
    const configMapGroup = {
      id: 'group-configmaps',
      type: 'group',
      position: { x: 0, y: 0 },
      data: {
        label: 'ConfigMaps',
        groupType: 'configmap',
        resource: {
          items: topology.configmaps.map((cm: any) => ({
            name: cm.name,
            type: 'configmap',
            mounted: cm.mountedAt || cm.mountedBy || [],
            resource: cm,
          })),
        },
        details: {
          items: topology.configmaps.map((cm: any) => ({
            name: cm.name,
            type: 'configmap',
            mounted: cm.mountedAt || cm.mountedBy || [],
            resource: cm,
          })),
          itemCount: topology.configmaps.length,
        },
        context,
        namespace: topology.namespace,
      },
    };
    nodes.push(configMapGroup);

    // Connect ConfigMaps to Pods
    topology.configmaps.forEach((cm: any) => {
      if (cm.mountedBy && cm.mountedBy.length > 0) {
        cm.mountedBy.forEach((podName: string) => {
          const podId = `pod-${podName}`;
          if (nodes.find(n => n.id === podId)) {
            edges.push({
              id: `group-configmaps-${podId}`,
              source: 'group-configmaps',
              target: podId,
              type: 'custom',
              data: {
                animated: false,
                type: 'configmap',
                label: 'configmap',
              },
              style: {
                strokeWidth: 1,
                stroke: '#3b82f6',
                strokeDasharray: '3 3',
              },
            });
          }
        });
      }
    });
  }

  // Group Secrets (if filter allows)
  if (filters.showSecrets && topology.secrets && topology.secrets.length > 0) {
    const secretGroup = {
      id: 'group-secrets',
      type: 'group',
      position: { x: 0, y: 0 },
      data: {
        label: 'Secrets',
        groupType: 'secret',
        resource: {
          items: topology.secrets.map((secret: any) => ({
            name: secret.name,
            type: 'secret',
            mounted: secret.mountedAt || secret.mountedBy || [],
            resource: secret,
          })),
        },
        details: {
          items: topology.secrets.map((secret: any) => ({
            name: secret.name,
            type: 'secret',
            mounted: secret.mountedAt || secret.mountedBy || [],
            resource: secret,
          })),
          itemCount: topology.secrets.length,
        },
        context,
        namespace: topology.namespace,
      },
    };
    nodes.push(secretGroup);

    // Connect Secrets to Pods
    topology.secrets.forEach((secret: any) => {
      if (secret.mountedBy && secret.mountedBy.length > 0) {
        secret.mountedBy.forEach((podName: string) => {
          const podId = `pod-${podName}`;
          if (nodes.find(n => n.id === podId)) {
            edges.push({
              id: `group-secrets-${podId}`,
              source: 'group-secrets',
              target: podId,
              type: 'custom',
              data: {
                animated: false,
                type: 'secret',
                label: 'secret',
              },
              style: {
                strokeWidth: 1,
                stroke: '#ef4444',
                strokeDasharray: '3 3',
              },
            });
          }
        });
      }
    });
  }

  // Add RBAC nodes (if filter allows)
  if (filters.showRBAC && topology.serviceAccount) {
    const saId = 'serviceaccount';
    nodes.push({
      id: saId,
      type: 'serviceaccount',  // Changed to lowercase to match nodeTypes
      position: { x: 0, y: 0 },
      data: {
        label: topology.serviceAccount.name,
        resource: {
          ...topology.serviceAccount,
          roles: topology.roles || [],
          roleBindings: topology.roleBindings || [],
          clusterRoles: topology.clusterRoles || [],
          clusterRoleBindings: topology.clusterRoleBindings || [],
        },
        context,
        namespace: topology.namespace,
      },
    });

    // No direct connection between ServiceAccount and Jobs/CronJob
    // The ServiceAccount connects to RoleBindings which connect to Roles (RBAC chain)
    
    // Add Roles
    if (topology.roles && topology.roles.length > 0) {
      topology.roles.forEach((role: any, index: number) => {
        const roleId = `role-${role.name}`;
        nodes.push({
          id: roleId,
          type: 'role',
          position: { x: 0, y: 0 },
          data: {
            label: role.name,
            resource: role,
            context,
            namespace: topology.namespace,
          },
        });
      });
    }
    
    // Add ClusterRoles
    if (topology.clusterRoles && topology.clusterRoles.length > 0) {
      topology.clusterRoles.forEach((role: any, index: number) => {
        const roleId = `clusterrole-${role.name}`;
        nodes.push({
          id: roleId,
          type: 'clusterrole',
          position: { x: 0, y: 0 },
          data: {
            label: role.name,
            resource: role,
            context,
            namespace: topology.namespace,
          },
        });
      });
    }
    
    // Add RoleBindings and connect them
    if (topology.roleBindings && topology.roleBindings.length > 0) {
      topology.roleBindings.forEach((binding: any, index: number) => {
        const bindingId = `rolebinding-${binding.name}`;
        nodes.push({
          id: bindingId,
          type: 'rolebinding',
          position: { x: 0, y: 0 },
          data: {
            label: binding.name,
            resource: binding,
            context,
            namespace: topology.namespace,
          },
        });
        
        // Connect ServiceAccount to RoleBinding
        edges.push({
          id: `${saId}-${bindingId}`,
          source: saId,
          target: bindingId,
          type: 'custom',
          data: {
            animated: false,
            type: 'rbac',
            label: 'binds',
          },
          style: {
            strokeWidth: 1,
            stroke: '#f97316',
            strokeDasharray: '3 3',
          },
        });
        
        // Connect RoleBinding to Role
        if (binding.roleRef && binding.roleRef.kind === 'Role') {
          const roleId = `role-${binding.roleRef.name}`;
          if (nodes.find(n => n.id === roleId)) {
            edges.push({
              id: `${bindingId}-${roleId}`,
              source: bindingId,
              target: roleId,
              type: 'custom',
              data: {
                animated: false,
                type: 'rbac',
                label: 'grants',
              },
              style: {
                strokeWidth: 1,
                stroke: '#f97316',
              },
            });
          }
        }
      });
    }
    
    // Add ClusterRoleBindings and connect them
    if (topology.clusterRoleBindings && topology.clusterRoleBindings.length > 0) {
      topology.clusterRoleBindings.forEach((binding: any, index: number) => {
        const bindingId = `clusterrolebinding-${binding.name}`;
        nodes.push({
          id: bindingId,
          type: 'clusterrolebinding',
          position: { x: 0, y: 0 },
          data: {
            label: binding.name,
            resource: binding,
            context,
            namespace: topology.namespace,
          },
        });
        
        // Connect ServiceAccount to ClusterRoleBinding
        edges.push({
          id: `${saId}-${bindingId}`,
          source: saId,
          target: bindingId,
          type: 'custom',
          data: {
            animated: false,
            type: 'rbac',
            label: 'binds',
          },
          style: {
            strokeWidth: 1,
            stroke: '#f97316',
            strokeDasharray: '3 3',
          },
        });
        
        // Connect ClusterRoleBinding to ClusterRole
        if (binding.roleRef && binding.roleRef.kind === 'ClusterRole') {
          const roleId = `clusterrole-${binding.roleRef.name}`;
          if (nodes.find(n => n.id === roleId)) {
            edges.push({
              id: `${bindingId}-${roleId}`,
              source: bindingId,
              target: roleId,
              type: 'custom',
              data: {
                animated: false,
                type: 'rbac',
                label: 'grants',
              },
              style: {
                strokeWidth: 1,
                stroke: '#f97316',
              },
            });
          }
        }
      });
    }
  }

  // Apply status filter
  if (filters.statusFilter !== 'all') {
    const filteredNodes = nodes.filter(node => {
      if (node.type === 'pod') {
        const phase = node.data.resource?.phase;
        if (filters.statusFilter === 'running') return phase === 'Running';
        if (filters.statusFilter === 'pending') return phase === 'Pending';
        if (filters.statusFilter === 'failed') return phase === 'Failed';
        if (filters.statusFilter === 'succeeded') return phase === 'Succeeded';
      }
      return true;
    });

    // Keep only edges that connect existing nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    // Apply dagre layout to prevent overlapping
    const layoutResult = applyDagreLayout(
      filteredNodes as Node[], 
      filteredEdges as Edge[], 
      { layout }
    );
    return { nodes: layoutResult.nodes as TopologyNode[], edges: layoutResult.edges as TopologyEdge[] };
  }

  // Apply dagre layout to prevent overlapping
  const layoutResult = applyDagreLayout(
    nodes as Node[], 
    edges as Edge[], 
    { layout }
  );
  return { nodes: layoutResult.nodes as TopologyNode[], edges: layoutResult.edges as TopologyEdge[] };
}

// Helper function to match labels
function matchLabels(podLabels: Record<string, string>, selector: Record<string, string>): boolean {
  if (!podLabels || !selector) return false;
  return Object.entries(selector).every(([key, value]) => podLabels[key] === value);
}