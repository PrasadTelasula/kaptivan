import React, { useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  BackgroundVariant,
  Handle,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Users, 
  UserCheck,
  Shield, 
  Key, 
  Lock,
  Database,
  Server,
  FileText,
  ChevronDown,
  ChevronRight,
  Activity,
  Package,
  Layers,
  Box,
  HardDrive,
  GitBranch,
  Settings
} from 'lucide-react';
import type { RBACResources, FilterOptions } from '../types';

// Type definitions for ReactFlow
type Node = {
  id: string;
  position: { x: number; y: number };
  data: any;
  type?: string;
};

type Edge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  markerEnd?: any;
  style?: any;
  label?: string;
};

type NodeProps<T = any> = {
  data: T;
  id: string;
  selected?: boolean;
  type?: string;
  xPos: number;
  yPos: number;
  dragging?: boolean;
  zIndex: number;
  isConnectable?: boolean;
  positionAbsoluteX: number;
  positionAbsoluteY: number;
};

interface RBACAccessGraphProps {
  resources: RBACResources;
  filters?: FilterOptions;
  onNodeSelect?: (node: any) => void;
}

interface CategoryNodeData {
  label: string;
  items: Array<{ id: string; name: string; namespace?: string; type?: string }>;
  totalCount: number;
  icon: React.ReactNode;
  expanded: boolean;
  category: 'subjects' | 'roles' | 'actions' | 'resources';
}

interface PermissionNodeData {
  verb: string;
  workloads: string[];
  networking: string[];
  config: string[];
  storage: string[];
  other: string[];
  totalResources: number;
  icon: React.ReactNode;
  expanded: boolean;
}

// Custom node component for category groups
const CategoryNode = ({ data }: NodeProps<CategoryNodeData>) => {
  const [expanded, setExpanded] = useState(data.expanded);
  const displayItems = expanded ? data.items : data.items.slice(0, 3);
  const hiddenCount = data.items.length - displayItems.length;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Card className="bg-slate-900/90 border-slate-700/50 backdrop-blur-sm min-w-[280px] shadow-2xl">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-blue-400">{data.icon}</div>
              <span className="text-white font-medium">{data.label}</span>
            </div>
            <Badge variant="secondary" className="bg-slate-800 text-slate-300">
              {data.totalCount}
            </Badge>
          </div>

          {/* Items */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {displayItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center gap-2 p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200 truncate block">{item.name}</span>
                  {item.namespace && (
                    <span className="text-xs text-slate-400">{item.namespace}</span>
                  )}
                  {item.type && (
                    <span className="text-xs text-slate-500 italic">{item.type}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Show more button */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {hiddenCount} more {data.label.toLowerCase()}...
            </button>
          )}
        </div>
      </Card>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

// Custom node component for permission (verb-resource) relationships
const PermissionNode = ({ data }: NodeProps<PermissionNodeData>) => {
  const [expanded, setExpanded] = useState(data.expanded);
  
  const getVerbColor = (verb: string) => {
    const colors: { [key: string]: string } = {
      'create': 'text-green-400',
      'update': 'text-blue-400',
      'patch': 'text-blue-400',
      'delete': 'text-red-400',
      'deletecollection': 'text-red-400',
      'get': 'text-yellow-400',
      'list': 'text-yellow-400',
      'watch': 'text-purple-400',
      '*': 'text-orange-400',
      'impersonate': 'text-pink-400'
    };
    return colors[verb] || 'text-slate-400';
  };

  const allResources = [
    ...data.workloads.map(r => ({ name: r, category: 'Workloads', icon: '📦' })),
    ...data.networking.map(r => ({ name: r, category: 'Networking', icon: '🌐' })),
    ...data.config.map(r => ({ name: r, category: 'Config', icon: '🔧' })),
    ...data.storage.map(r => ({ name: r, category: 'Storage', icon: '💾' })),
    ...data.other.map(r => ({ name: r, category: 'Other', icon: '📄' }))
  ];
  
  const displayResources = expanded ? allResources : allResources.slice(0, 5);
  const hiddenCount = allResources.length - displayResources.length;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Card className="bg-slate-900/90 border-slate-700/50 backdrop-blur-sm min-w-[350px] shadow-2xl">
        <div className="p-4">
          {/* Verb Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Activity className={`w-5 h-5 ${getVerbColor(data.verb)}`} />
              <span className={`font-bold text-lg ${getVerbColor(data.verb)}`}>
                {data.verb.toUpperCase()}
              </span>
            </div>
            <Badge variant="secondary" className="bg-slate-800 text-slate-300">
              {data.totalResources} resources
            </Badge>
          </div>

          {/* Resources List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {displayResources.map((resource, idx) => (
              <div
                key={`${resource.name}-${idx}`}
                className="flex items-center gap-2 p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <span className="text-xs">{resource.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200">{resource.name}</span>
                  <span className="text-xs text-slate-500 ml-2">({resource.category})</span>
                </div>
              </div>
            ))}
            
            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-2 p-2 text-sm text-blue-400 hover:bg-slate-800/50 rounded transition-colors flex items-center justify-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {hiddenCount} more resources...
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  category: CategoryNode,
  permission: PermissionNode,
};

export default function RBACAccessGraph({ resources, filters, onNodeSelect }: RBACAccessGraphProps) {
  const generateNodesAndEdges = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Helper function to check if a subject matches the filter
    const matchesFilter = (item: any, type: string) => {
      // Check search term first
      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const fullName = item.namespace ? `${item.namespace}/${item.name}` : item.name;
        if (!item.name.toLowerCase().includes(searchLower) && 
            !fullName.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Check specific filter value
      if (filters?.filterValue) {
        const fullName = item.namespace ? `${item.namespace}/${item.name}` : item.name;
        if (filters.filterType === 'serviceAccount' && type === 'ServiceAccount') {
          return fullName === filters.filterValue;
        } else if (filters.filterType === 'role' && type === 'Role') {
          return fullName === filters.filterValue;
        } else if (filters.filterType === 'clusterRole' && type === 'ClusterRole') {
          return item.name === filters.filterValue;
        }
      }
      
      return true;
    };

    // Check if we're in focused mode (specific filter value selected)
    const isFocusedMode = !!(filters?.filterValue);
    
    // Data structures for relationship tracking
    const relevantSubjects = new Map<string, any>();
    const relevantRoles = new Map<string, any>();
    const relevantVerbs = new Set<string>();
    const relevantResources = new Set<string>();
    const relevantBindings = [];

    // Get all bindings first
    const allBindings = [
      ...(resources.roleBindings || []),
      ...(resources.clusterRoleBindings || [])
    ];

    // If in focused mode, find only the specific item and trace its relationships
    if (isFocusedMode && filters?.filterValue) {
      if (filters.filterType === 'serviceAccount') {
        // Find service account in subjects and trace its permissions
        allBindings.forEach(binding => {
          // Check namespace filter
          if (filters?.namespace && filters.namespace !== 'all' && binding.metadata.namespace) {
            if (binding.metadata.namespace !== filters.namespace) return;
          }

          (binding.subjects || []).forEach(subject => {
            if (subject.kind === 'ServiceAccount') {
              const subjectFullName = subject.namespace ? 
                `${subject.namespace}/${subject.name}` : subject.name;
              
              if (subjectFullName === filters.filterValue) {
                const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
                relevantSubjects.set(key, {
                  id: `sa-${subject.namespace}-${subject.name}`,
                  name: subject.name,
                  namespace: subject.namespace,
                  kind: 'ServiceAccount'
                });
                
                // This binding is relevant
                relevantBindings.push(binding);
              }
            }
          });
        });
      } else if (filters.filterType === 'role' || filters.filterType === 'clusterRole') {
        // Find the role and all subjects that have access to it
        const targetRole = filters.filterType === 'role' 
          ? resources.roles?.find(r => `${r.metadata.namespace}/${r.metadata.name}` === filters.filterValue)
          : resources.clusterRoles?.find(r => r.metadata.name === filters.filterValue);
        
        if (targetRole) {
          const roleKey = targetRole.metadata.uid || targetRole.metadata.name;
          relevantRoles.set(roleKey, {
            id: `role-${roleKey}`,
            name: targetRole.metadata.name,
            namespace: targetRole.metadata.namespace,
            type: targetRole.metadata.namespace ? 'Role' : 'ClusterRole'
          });
          
          // Extract verbs and resources from this role
          (targetRole.rules || []).forEach(rule => {
            (rule.verbs || []).forEach(verb => relevantVerbs.add(verb));
            (rule.resources || []).forEach(resource => relevantResources.add(resource));
          });
          
          // Find all bindings that reference this role
          allBindings.forEach(binding => {
            if (binding.roleRef.name === targetRole.metadata.name) {
              if (filters.filterType === 'role' && binding.roleRef.kind === 'Role') {
                relevantBindings.push(binding);
                // Add subjects from this binding
                (binding.subjects || []).forEach(subject => {
                  const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
                  relevantSubjects.set(key, {
                    id: `${subject.kind.toLowerCase()}-${subject.name}`,
                    name: subject.name,
                    namespace: subject.namespace,
                    kind: subject.kind
                  });
                });
              } else if (filters.filterType === 'clusterRole' && binding.roleRef.kind === 'ClusterRole') {
                relevantBindings.push(binding);
                // Add subjects from this binding
                (binding.subjects || []).forEach(subject => {
                  const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
                  relevantSubjects.set(key, {
                    id: `${subject.kind.toLowerCase()}-${subject.name}`,
                    name: subject.name,
                    namespace: subject.namespace,
                    kind: subject.kind
                  });
                });
              }
            }
          });
        }
      }

      // Now find all roles referenced by relevant bindings
      relevantBindings.forEach(binding => {
        const roleRef = binding.roleRef;
        const roleName = roleRef.name;
        
        // Find the actual role
        let role = null;
        if (roleRef.kind === 'Role') {
          role = resources.roles?.find(r => 
            r.metadata.name === roleName && 
            r.metadata.namespace === binding.metadata.namespace
          );
        } else {
          role = resources.clusterRoles?.find(r => r.metadata.name === roleName);
        }
        
        if (role) {
          const roleKey = role.metadata.uid || role.metadata.name;
          relevantRoles.set(roleKey, {
            id: `role-${roleKey}`,
            name: role.metadata.name,
            namespace: role.metadata.namespace,
            type: role.metadata.namespace ? 'Role' : 'ClusterRole'
          });
          
          // Extract verb-resource pairs from this role
          (role.rules || []).forEach(rule => {
            // Store the complete rule with verb-resource associations
            const ruleVerbs = rule.verbs || [];
            const ruleResources = rule.resources || [];
            
            // Add all verbs and resources but keep track of their associations
            ruleVerbs.forEach(verb => relevantVerbs.add(verb));
            ruleResources.forEach(resource => relevantResources.add(resource));
            
            // Store the complete rule for later processing
            if (!role._processedRules) role._processedRules = [];
            role._processedRules.push({ verbs: ruleVerbs, resources: ruleResources });
          });
        }
      });
    } else {
      // Normal mode - show all filtered data
      allBindings.forEach(binding => {
        // Apply namespace filter
        if (filters?.namespace && filters.namespace !== 'all' && binding.metadata.namespace) {
          if (binding.metadata.namespace !== filters.namespace) return;
        }

        (binding.subjects || []).forEach(subject => {
          // Apply search and type filters
          if (!matchesFilter({ name: subject.name, namespace: subject.namespace }, subject.kind)) return;
          
          if (subject.kind === 'User' && filters?.showUsers !== false) {
            const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
            relevantSubjects.set(key, {
              id: `user-${subject.name}`,
              name: subject.name,
              namespace: subject.namespace,
              kind: 'User'
            });
          } else if (subject.kind === 'Group' && filters?.showGroups !== false) {
            const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
            relevantSubjects.set(key, {
              id: `group-${subject.name}`,
              name: subject.name,
              namespace: subject.namespace,
              kind: 'Group'
            });
          } else if (subject.kind === 'ServiceAccount' && filters?.showServiceAccounts !== false) {
            const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
            relevantSubjects.set(key, {
              id: `sa-${subject.namespace}-${subject.name}`,
              name: subject.name,
              namespace: subject.namespace,
              kind: 'ServiceAccount'
            });
          }
        });
      });

      // Get all roles
      const allRoles = [
        ...(resources.roles || []).filter(role => {
          if (filters?.namespace && filters.namespace !== 'all' && role.metadata.namespace) {
            return role.metadata.namespace === filters.namespace;
          }
          return true;
        }),
        ...(resources.clusterRoles || []).filter(role => {
          if (!filters?.showSystemRoles && role.metadata.name.startsWith('system:')) {
            return false;
          }
          return true;
        })
      ];

      allRoles.forEach(role => {
        if (filters?.searchTerm && !role.metadata.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
          return;
        }
        
        const roleKey = role.metadata.uid || role.metadata.name;
        relevantRoles.set(roleKey, {
          id: `role-${roleKey}`,
          name: role.metadata.name,
          namespace: role.metadata.namespace,
          type: role.metadata.namespace ? 'Role' : 'ClusterRole'
        });
        
        (role.rules || []).forEach(rule => {
          (rule.verbs || []).forEach(verb => relevantVerbs.add(verb));
          (rule.resources || []).forEach(resource => relevantResources.add(resource));
        });
      });
    }

    // Group subjects by type
    const users = [];
    const groups = [];
    const serviceAccounts = [];
    
    relevantSubjects.forEach(subject => {
      if (subject.kind === 'User') users.push(subject);
      else if (subject.kind === 'Group') groups.push(subject);
      else if (subject.kind === 'ServiceAccount') serviceAccounts.push(subject);
    });

    // Convert sets to arrays
    const roles = Array.from(relevantRoles.values());
    
    // Create verb-resource permission pairs instead of separate lists
    const permissions = new Map();
    
    // Process all relevant roles to extract their rules
    relevantRoles.forEach(roleInfo => {
      // Find the actual role object
      let role = null;
      if (roleInfo.type === 'Role') {
        role = resources.roles?.find(r => 
          r.metadata.name === roleInfo.name && 
          r.metadata.namespace === roleInfo.namespace
        );
      } else {
        role = resources.clusterRoles?.find(r => r.metadata.name === roleInfo.name);
      }
      
      if (role && role.rules) {
        role.rules.forEach(rule => {
          const verbs = rule.verbs || [];
          const ruleResources = rule.resources || [];
          
          // Create permission entries for each verb-resource combination
          verbs.forEach(verb => {
            if (!permissions.has(verb)) {
              permissions.set(verb, new Set());
            }
            ruleResources.forEach(resource => {
              permissions.get(verb).add(resource);
            });
          });
        });
      }
    });
    
    // Convert permissions map to structured data
    const permissionNodes = Array.from(permissions.entries()).map(([verb, resources]) => ({
      id: `perm-${verb}`,
      verb: verb,
      resources: Array.from(resources).sort()
    }));

    // Create nodes
    let yPosition = 50;

    // Users Node
    if (users.length > 0) {
      nodes.push({
        id: 'users-group',
        type: 'category',
        position: { x: 50, y: yPosition },
        data: {
          label: 'Users',
          items: users,
          totalCount: users.length,
          icon: <User className="w-4 h-4" />,
          expanded: false,
          category: 'subjects'
        }
      });
      yPosition += 200;
    }

    // Groups Node
    if (groups.length > 0) {
      nodes.push({
        id: 'groups-group',
        type: 'category',
        position: { x: 50, y: yPosition },
        data: {
          label: 'Groups',
          items: groups,
          totalCount: groups.length,
          icon: <Users className="w-4 h-4" />,
          expanded: false,
          category: 'subjects'
        }
      });
      yPosition += 200;
    }

    // Service Accounts Node
    if (serviceAccounts.length > 0) {
      nodes.push({
        id: 'serviceaccounts-group',
        type: 'category',
        position: { x: 50, y: yPosition },
        data: {
          label: 'Service Accounts',
          items: serviceAccounts,
          totalCount: serviceAccounts.length,
          icon: <Key className="w-4 h-4" />,
          expanded: isFocusedMode, // Auto-expand in focused mode
          category: 'subjects'
        }
      });
    }

    // Roles Node
    if (roles.length > 0) {
      const rolesY = Math.max(150, (yPosition - 100) / 2);
      nodes.push({
        id: 'roles-group',
        type: 'category',
        position: { x: 400, y: rolesY },
        data: {
          label: 'Roles & ClusterRoles',
          items: roles,
          totalCount: roles.length,
          icon: <Shield className="w-4 h-4" />,
          expanded: isFocusedMode && roles.length <= 5,
          category: 'roles'
        }
      });
    }

    // Permission Nodes - show verb-resource relationships
    if (permissionNodes.length > 0) {
      let permY = 50;
      
      permissionNodes.forEach((perm, index) => {
        // Group resources by category
        const workloadResources = perm.resources.filter(r => 
          ['deployments', 'replicasets', 'statefulsets', 'daemonsets', 'pods', 'jobs', 'cronjobs'].includes(r) ||
          r.includes('deployment') || r.includes('replicaset') || r.includes('statefulset')
        );
        
        const networkResources = perm.resources.filter(r => 
          ['services', 'ingresses', 'endpoints', 'endpointslices', 'networkpolicies'].includes(r) ||
          r.includes('service') || r.includes('ingress') || r.includes('endpoint')
        );
        
        const configResources = perm.resources.filter(r => 
          ['configmaps', 'secrets'].includes(r)
        );
        
        const storageResources = perm.resources.filter(r => 
          r.includes('persistentvolume') || r.includes('storageclass')
        );
        
        const otherResources = perm.resources.filter(r => 
          !workloadResources.includes(r) && 
          !networkResources.includes(r) && 
          !configResources.includes(r) && 
          !storageResources.includes(r)
        );
        
        // Create a node for this permission showing verb and its resources
        nodes.push({
          id: perm.id,
          type: 'permission',
          position: { x: 750, y: permY },
          data: {
            verb: perm.verb,
            workloads: workloadResources,
            networking: networkResources,
            config: configResources,
            storage: storageResources,
            other: otherResources,
            totalResources: perm.resources.length,
            icon: <Activity className="w-4 h-4" />,
            expanded: isFocusedMode && perm.resources.length <= 10
          }
        });
        
        permY += 120;
      });
    }

    // Create edges only between nodes that exist
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Subjects to Roles
    if (nodeIds.has('users-group') && nodeIds.has('roles-group')) {
      edges.push({
        id: 'e-users-roles',
        source: 'users-group',
        target: 'roles-group',
        type: 'smoothstep',
        animated: isFocusedMode,
        style: { stroke: '#fbbf24', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
      });
    }

    if (nodeIds.has('groups-group') && nodeIds.has('roles-group')) {
      edges.push({
        id: 'e-groups-roles',
        source: 'groups-group',
        target: 'roles-group',
        type: 'smoothstep',
        animated: isFocusedMode,
        style: { stroke: '#fbbf24', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
      });
    }

    if (nodeIds.has('serviceaccounts-group') && nodeIds.has('roles-group')) {
      edges.push({
        id: 'e-sa-roles',
        source: 'serviceaccounts-group',
        target: 'roles-group',
        type: 'smoothstep',
        animated: isFocusedMode,
        style: { stroke: '#fbbf24', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
      });
    }

    // Roles to Permissions
    const permNodes = nodes.filter(n => n.type === 'permission');
    if (nodeIds.has('roles-group')) {
      permNodes.forEach((permNode) => {
        edges.push({
          id: `e-roles-${permNode.id}`,
          source: 'roles-group',
          target: permNode.id,
          type: 'smoothstep',
          animated: isFocusedMode,
          style: { stroke: '#fbbf24', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
        });
      });
    }

    return { nodes, edges };
  }, [resources, filters]);

  const [nodes, setNodes, onNodesChange] = useNodesState(generateNodesAndEdges.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateNodesAndEdges.edges);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }, [onNodeSelect]);

  return (
    <div className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          color="#334155"
          size={1}
        />
        <Controls className="bg-slate-800 border-slate-700" />
      </ReactFlow>
    </div>
  );
}