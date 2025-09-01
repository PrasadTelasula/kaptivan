import { buildUrl } from '@/utils/api-urls';
import type {
  RBACResources,
  RBACGraph,
  PermissionMatrix,
  RoleDetails,
  SubjectPermissions,
  FilterOptions
} from '../types';

export class RBACService {
  private baseUrl = '/api/v1/rbac';

  async getRBACResources(context: string, namespace?: string): Promise<RBACResources> {
    const params = new URLSearchParams({ context });
    if (namespace) params.append('namespace', namespace);
    
    const response = await fetch(buildUrl(`${this.baseUrl}/resources?${params}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch RBAC resources: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Always fetch pods to show which ones use service accounts
    try {
      const pods = await this.getPods(context, namespace);
      console.log('Fetched pods:', pods.length, 'pods for context:', context);
      data.pods = pods;
    } catch (error) {
      console.warn('Failed to fetch pods:', error);
      data.pods = [];
    }
    
    return data;
  }
  
  async getPods(context: string, namespace?: string): Promise<any[]> {
    const body = {
      context: context,
      ...(namespace ? { namespace: namespace } : {})
    };
    
    const response = await fetch(buildUrl('/api/v1/resources/pods'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pods: ${response.statusText}`);
    }
    const data = await response.json();
    return data.items || [];
  }

  async getRBACGraph(context: string, options?: FilterOptions): Promise<RBACGraph> {
    const params = new URLSearchParams({ context });
    if (options?.namespace) params.append('namespace', options.namespace);
    if (options?.filterType) params.append('filterType', options.filterType);
    if (options?.filterValue) params.append('filterValue', options.filterValue);
    
    const response = await fetch(buildUrl(`${this.baseUrl}/graph?${params}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch RBAC graph: ${response.statusText}`);
    }
    return response.json();
  }

  async getPermissionMatrix(context: string, namespace?: string): Promise<PermissionMatrix> {
    const params = new URLSearchParams({ context });
    if (namespace) params.append('namespace', namespace);
    
    const response = await fetch(buildUrl(`${this.baseUrl}/permissions/matrix?${params}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch permission matrix: ${response.statusText}`);
    }
    return response.json();
  }

  async getRoleDetails(
    context: string,
    roleName: string,
    roleType: 'role' | 'clusterRole',
    namespace?: string
  ): Promise<RoleDetails> {
    const params = new URLSearchParams({
      context,
      name: roleName,
      type: roleType
    });
    if (namespace && roleType === 'role') {
      params.append('namespace', namespace);
    }
    
    const response = await fetch(buildUrl(`${this.baseUrl}/role/details?${params}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch role details: ${response.statusText}`);
    }
    return response.json();
  }

  async getSubjectPermissions(
    context: string,
    subjectName: string,
    subjectKind: 'User' | 'Group' | 'ServiceAccount',
    namespace?: string
  ): Promise<SubjectPermissions> {
    const params = new URLSearchParams({
      context,
      name: subjectName,
      kind: subjectKind
    });
    if (namespace) params.append('namespace', namespace);
    
    const response = await fetch(buildUrl(`${this.baseUrl}/subject/permissions?${params}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch subject permissions: ${response.statusText}`);
    }
    return response.json();
  }

  exportRBACConfiguration(resources: RBACResources, format: 'yaml' | 'json' = 'yaml'): string {
    if (format === 'json') {
      return JSON.stringify(resources, null, 2);
    }
    
    // Simple YAML conversion for export
    let yaml = '# RBAC Configuration Export\n---\n';
    
    // Export Roles
    resources.roles.forEach(role => {
      yaml += `apiVersion: rbac.authorization.k8s.io/v1\n`;
      yaml += `kind: Role\n`;
      yaml += `metadata:\n`;
      yaml += `  name: ${role.metadata.name}\n`;
      if (role.metadata.namespace) {
        yaml += `  namespace: ${role.metadata.namespace}\n`;
      }
      yaml += `rules:\n`;
      role.rules.forEach(rule => {
        yaml += `- apiGroups: ${JSON.stringify(rule.apiGroups || [])}\n`;
        yaml += `  resources: ${JSON.stringify(rule.resources || [])}\n`;
        yaml += `  verbs: ${JSON.stringify(rule.verbs)}\n`;
      });
      yaml += '---\n';
    });
    
    // Export ClusterRoles
    resources.clusterRoles.forEach(role => {
      yaml += `apiVersion: rbac.authorization.k8s.io/v1\n`;
      yaml += `kind: ClusterRole\n`;
      yaml += `metadata:\n`;
      yaml += `  name: ${role.metadata.name}\n`;
      yaml += `rules:\n`;
      role.rules.forEach(rule => {
        yaml += `- apiGroups: ${JSON.stringify(rule.apiGroups || [])}\n`;
        yaml += `  resources: ${JSON.stringify(rule.resources || [])}\n`;
        yaml += `  verbs: ${JSON.stringify(rule.verbs)}\n`;
      });
      yaml += '---\n';
    });
    
    // Export RoleBindings
    resources.roleBindings.forEach(binding => {
      yaml += `apiVersion: rbac.authorization.k8s.io/v1\n`;
      yaml += `kind: RoleBinding\n`;
      yaml += `metadata:\n`;
      yaml += `  name: ${binding.metadata.name}\n`;
      if (binding.metadata.namespace) {
        yaml += `  namespace: ${binding.metadata.namespace}\n`;
      }
      yaml += `subjects:\n`;
      binding.subjects.forEach(subject => {
        yaml += `- kind: ${subject.kind}\n`;
        yaml += `  name: ${subject.name}\n`;
        if (subject.namespace) {
          yaml += `  namespace: ${subject.namespace}\n`;
        }
      });
      yaml += `roleRef:\n`;
      yaml += `  apiGroup: ${binding.roleRef.apiGroup}\n`;
      yaml += `  kind: ${binding.roleRef.kind}\n`;
      yaml += `  name: ${binding.roleRef.name}\n`;
      yaml += '---\n';
    });
    
    // Export ClusterRoleBindings
    resources.clusterRoleBindings.forEach(binding => {
      yaml += `apiVersion: rbac.authorization.k8s.io/v1\n`;
      yaml += `kind: ClusterRoleBinding\n`;
      yaml += `metadata:\n`;
      yaml += `  name: ${binding.metadata.name}\n`;
      yaml += `subjects:\n`;
      binding.subjects.forEach(subject => {
        yaml += `- kind: ${subject.kind}\n`;
        yaml += `  name: ${subject.name}\n`;
        if (subject.namespace) {
          yaml += `  namespace: ${subject.namespace}\n`;
        }
      });
      yaml += `roleRef:\n`;
      yaml += `  apiGroup: ${binding.roleRef.apiGroup}\n`;
      yaml += `  kind: ${binding.roleRef.kind}\n`;
      yaml += `  name: ${binding.roleRef.name}\n`;
      yaml += '---\n';
    });
    
    return yaml;
  }
}

export const rbacService = new RBACService();