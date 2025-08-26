import type { TopologyEdge } from '../types';
import type { MarkerType } from 'reactflow';

// Service → Endpoints edge (animated)
export const buildServiceToEndpointsEdge = (
  serviceName: string,
  endpointsName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `service-${serviceName}-endpoints-${endpointsName}`,
  source: `service-${serviceName}`,
  target: `endpoints-${endpointsName}`,
  // In horizontal layout, use only left/right edges for non-RBAC nodes
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'custom',
  data: {
    animated: true,
    type: 'service',
    label: 'resolves to'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#10b981'
  }
});

// Endpoints → Pod edge (animated)
export const buildEndpointsToPodEdge = (
  endpointsName: string,
  podName: string,
  isHorizontal: boolean = true
): TopologyEdge => ({
  id: `endpoints-${endpointsName}-pod-${podName}`,
  source: `endpoints-${endpointsName}`,
  target: `pod-${podName}`,
  // In horizontal layout, use only left/right edges for non-RBAC nodes
  sourceHandle: isHorizontal ? 'source-right' : 'source-bottom',
  targetHandle: isHorizontal ? 'target-left' : 'target-top',
  type: 'smoothstep',
  style: {
    stroke: '#10b981',
    strokeWidth: 2,
    strokeDasharray: '5 5'
  },
  animated: true,
  data: {
    type: 'service'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#10b981'
  }
});

// ServiceAccount → Role edge
export const buildServiceAccountToRoleEdge = (
  saName: string,
  roleName: string,
  isClusterRole: boolean = false
): TopologyEdge => ({
  id: `sa-${saName}-role-${roleName}`,
  source: `serviceaccount-${saName}`,
  target: `${isClusterRole ? 'clusterrole' : 'role'}-${roleName}`,
  type: 'custom',
  data: {
    type: 'rbac',
    label: 'uses'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#f97316'
  }
});

// Role → RoleBinding edge
export const buildRoleToRoleBindingEdge = (
  roleName: string,
  bindingName: string,
  isClusterRole: boolean = false,
  isClusterRoleBinding: boolean = false
): TopologyEdge => ({
  id: `role-${roleName}-binding-${bindingName}`,
  source: `${isClusterRole ? 'clusterrole' : 'role'}-${roleName}`,
  target: `${isClusterRoleBinding ? 'clusterrolebinding' : 'rolebinding'}-${bindingName}`,
  type: 'custom',
  data: {
    type: 'rbac',
    label: 'grants'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#f97316'
  }
});

// Keep old functions for backwards compatibility but rename them
export const buildServiceAccountToRoleBindingEdge = (
  saName: string,
  bindingName: string,
  isClusterRoleBinding: boolean = false
): TopologyEdge => ({
  id: `sa-${saName}-binding-${bindingName}`,
  source: `serviceaccount-${saName}`,
  target: `${isClusterRoleBinding ? 'clusterrolebinding' : 'rolebinding'}-${bindingName}`,
  type: 'custom',
  data: {
    type: 'rbac',
    label: 'subject'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#f97316'
  }
});

export const buildRoleBindingToRoleEdge = (
  bindingName: string,
  roleName: string,
  isClusterRole: boolean = false,
  isClusterRoleBinding: boolean = false
): TopologyEdge => ({
  id: `binding-${bindingName}-role-${roleName}`,
  source: `${isClusterRoleBinding ? 'clusterrolebinding' : 'rolebinding'}-${bindingName}`,
  target: `${isClusterRole ? 'clusterrole' : 'role'}-${roleName}`,
  type: 'custom',
  data: {
    type: 'rbac',
    label: 'grants'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#f97316'
  }
});

// Deployment → ServiceAccount edge (already exists but adding for completeness)
export const buildDeploymentToServiceAccountEdgeAnimated = (
  deploymentName: string,
  saName: string
): TopologyEdge => ({
  id: `deployment-${deploymentName}-sa-${saName}`,
  source: `deployment-${deploymentName}`,
  target: `serviceaccount-${saName}`,
  type: 'custom',
  data: {
    animated: true,
    label: 'uses'
  },
  markerEnd: {
    type: 'arrowclosed' as MarkerType,
    color: '#06b6d4'
  }
});