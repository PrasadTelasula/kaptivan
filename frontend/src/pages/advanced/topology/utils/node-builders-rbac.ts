import type { TopologyNode } from '../types';
import type { EndpointsRef, RoleRef, RoleBindingRef } from '../types';

export const buildEndpointsNode = (
  endpoints: EndpointsRef,
  namespace: string,
  index: number,
  context?: string
): TopologyNode => ({
  id: `endpoints-${endpoints.name}`,
  type: 'endpoints',
  position: { x: 0, y: 0 }, // Will be calculated by layout
  data: {
    label: endpoints.name,
    resource: endpoints,
    namespace,
    context,
    details: {
      addressCount: endpoints.addresses?.length || 0,
      portCount: endpoints.ports?.length || 0
    }
  }
});

export const buildRoleNode = (
  role: RoleRef,
  namespace: string,
  index: number,
  isClusterRole: boolean = false,
  context?: string
): TopologyNode => ({
  id: `${isClusterRole ? 'clusterrole' : 'role'}-${role.name}`,
  type: isClusterRole ? 'clusterrole' : 'role',
  position: { x: 0, y: 0 },
  data: {
    label: role.name,
    resource: role,
    namespace: isClusterRole ? undefined : namespace,
    context,
    isClusterRole,
    details: {
      ruleCount: role.rules?.length || 0
    }
  }
});

export const buildRoleBindingNode = (
  binding: RoleBindingRef,
  namespace: string,
  index: number,
  isClusterRoleBinding: boolean = false,
  context?: string
): TopologyNode => ({
  id: `${isClusterRoleBinding ? 'clusterrolebinding' : 'rolebinding'}-${binding.name}`,
  type: isClusterRoleBinding ? 'clusterrolebinding' : 'rolebinding',
  position: { x: 0, y: 0 },
  data: {
    label: binding.name,
    resource: binding,
    namespace: isClusterRoleBinding ? undefined : namespace,
    context,
    isClusterRoleBinding,
    details: {
      subjectCount: binding.subjects?.length || 0,
      roleRef: binding.roleRef
    }
  }
});