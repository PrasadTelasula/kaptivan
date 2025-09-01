import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronRight, 
  ChevronDown,
  Shield,
  ShieldCheck,
  User,
  Users,
  Bot,
  Link,
  Key,
  Search,
  Filter,
  FolderOpen,
  Folder,
  FileText,
  Lock,
  Unlock,
  GitBranch,
  Package
} from 'lucide-react';
import type { RBACResources } from '../types';

interface RBACHierarchyProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'namespace' | 'role' | 'clusterRole' | 'binding' | 'subject' | 'permission';
  children: TreeNode[];
  metadata?: any;
  expanded?: boolean;
  icon?: React.ReactNode;
  badges?: { label: string; variant: any }[];
}

export default function RBACHierarchy({ resources, onNodeClick }: RBACHierarchyProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'roles' | 'bindings' | 'subjects'>('all');

  // Build hierarchy tree from resources
  const hierarchyTree = useMemo((): TreeNode[] => {
    if (!resources) return [];

    const tree: TreeNode[] = [];
    
    // Create namespace nodes
    const namespaceMap = new Map<string, TreeNode>();
    
    // Add cluster-level node
    const clusterNode: TreeNode = {
      id: 'cluster',
      name: 'Cluster Level',
      type: 'namespace',
      icon: <GitBranch className="w-4 h-4 text-blue-500" />,
      children: [],
      badges: [
        { label: `${resources.clusterRoles.length} ClusterRoles`, variant: 'default' },
        { label: `${resources.clusterRoleBindings.length} Bindings`, variant: 'secondary' }
      ]
    };
    
    // Add ClusterRoles to cluster node
    const clusterRolesNode: TreeNode = {
      id: 'cluster-roles',
      name: 'ClusterRoles',
      type: 'role',
      icon: <ShieldCheck className="w-4 h-4 text-blue-500" />,
      children: [],
      badges: [{ label: `${resources.clusterRoles.length}`, variant: 'default' }]
    };
    
    resources.clusterRoles.forEach(role => {
      const roleNode: TreeNode = {
        id: `cr-${role.metadata.uid}`,
        name: role.metadata.name,
        type: 'clusterRole',
        icon: <Shield className="w-4 h-4 text-blue-400" />,
        children: [],
        metadata: role,
        badges: [{ label: `${role.rules.length} rules`, variant: 'outline' }]
      };
      
      // Add permissions as children
      role.rules.forEach((rule, idx) => {
        const permNode: TreeNode = {
          id: `${roleNode.id}-perm-${idx}`,
          name: `${rule.verbs.join(', ')} on ${rule.resources?.join(', ') || 'unknown'}`,
          type: 'permission',
          icon: <Key className="w-3 h-3 text-gray-400" />,
          children: [],
          metadata: rule
        };
        roleNode.children.push(permNode);
      });
      
      clusterRolesNode.children.push(roleNode);
    });
    
    clusterNode.children.push(clusterRolesNode);
    
    // Add ClusterRoleBindings to cluster node
    const clusterBindingsNode: TreeNode = {
      id: 'cluster-bindings',
      name: 'ClusterRoleBindings',
      type: 'binding',
      icon: <Link className="w-4 h-4 text-green-500" />,
      children: [],
      badges: [{ label: `${resources.clusterRoleBindings.length}`, variant: 'secondary' }]
    };
    
    resources.clusterRoleBindings.forEach(binding => {
      const bindingNode: TreeNode = {
        id: `crb-${binding.metadata.uid}`,
        name: binding.metadata.name,
        type: 'binding',
        icon: <Link className="w-4 h-4 text-green-400" />,
        children: [],
        metadata: binding,
        badges: [
          { label: binding.roleRef.name, variant: 'default' },
          { label: `${binding.subjects?.length || 0} subjects`, variant: 'outline' }
        ]
      };
      
      // Add subjects as children
      binding.subjects?.forEach((subject, idx) => {
        const subjectIcon = subject.kind === 'ServiceAccount' 
          ? <Bot className="w-3 h-3 text-purple-400" />
          : subject.kind === 'Group'
          ? <Users className="w-3 h-3 text-orange-400" />
          : <User className="w-3 h-3 text-green-400" />;
          
        const subjectNode: TreeNode = {
          id: `${bindingNode.id}-subject-${idx}`,
          name: subject.name,
          type: 'subject',
          icon: subjectIcon,
          children: [],
          metadata: subject,
          badges: [{ label: subject.kind, variant: 'outline' }]
        };
        bindingNode.children.push(subjectNode);
      });
      
      clusterBindingsNode.children.push(bindingNode);
    });
    
    clusterNode.children.push(clusterBindingsNode);
    tree.push(clusterNode);
    
    // Process namespace-scoped resources
    const namespacedRoles = new Map<string, any[]>();
    const namespacedBindings = new Map<string, any[]>();
    
    resources.roles.forEach(role => {
      const ns = role.metadata.namespace || 'default';
      if (!namespacedRoles.has(ns)) {
        namespacedRoles.set(ns, []);
      }
      namespacedRoles.get(ns)!.push(role);
    });
    
    resources.roleBindings.forEach(binding => {
      const ns = binding.metadata.namespace || 'default';
      if (!namespacedBindings.has(ns)) {
        namespacedBindings.set(ns, []);
      }
      namespacedBindings.get(ns)!.push(binding);
    });
    
    // Create namespace nodes
    const allNamespaces = new Set([...namespacedRoles.keys(), ...namespacedBindings.keys()]);
    
    allNamespaces.forEach(ns => {
      const nsNode: TreeNode = {
        id: `ns-${ns}`,
        name: ns,
        type: 'namespace',
        icon: <Package className="w-4 h-4 text-indigo-500" />,
        children: [],
        badges: [
          { label: `${namespacedRoles.get(ns)?.length || 0} Roles`, variant: 'default' },
          { label: `${namespacedBindings.get(ns)?.length || 0} Bindings`, variant: 'secondary' }
        ]
      };
      
      // Add Roles
      if (namespacedRoles.has(ns)) {
        const rolesNode: TreeNode = {
          id: `${nsNode.id}-roles`,
          name: 'Roles',
          type: 'role',
          icon: <Shield className="w-4 h-4 text-blue-500" />,
          children: [],
          badges: [{ label: `${namespacedRoles.get(ns)!.length}`, variant: 'default' }]
        };
        
        namespacedRoles.get(ns)!.forEach(role => {
          const roleNode: TreeNode = {
            id: `r-${role.metadata.uid}`,
            name: role.metadata.name,
            type: 'role',
            icon: <Shield className="w-4 h-4 text-blue-400" />,
            children: [],
            metadata: role,
            badges: [{ label: `${role.rules.length} rules`, variant: 'outline' }]
          };
          
          // Add permissions
          role.rules.forEach((rule, idx) => {
            const permNode: TreeNode = {
              id: `${roleNode.id}-perm-${idx}`,
              name: `${rule.verbs.join(', ')} on ${rule.resources?.join(', ') || 'unknown'}`,
              type: 'permission',
              icon: <Key className="w-3 h-3 text-gray-400" />,
              children: [],
              metadata: rule
            };
            roleNode.children.push(permNode);
          });
          
          rolesNode.children.push(roleNode);
        });
        
        nsNode.children.push(rolesNode);
      }
      
      // Add RoleBindings
      if (namespacedBindings.has(ns)) {
        const bindingsNode: TreeNode = {
          id: `${nsNode.id}-bindings`,
          name: 'RoleBindings',
          type: 'binding',
          icon: <Link className="w-4 h-4 text-green-500" />,
          children: [],
          badges: [{ label: `${namespacedBindings.get(ns)!.length}`, variant: 'secondary' }]
        };
        
        namespacedBindings.get(ns)!.forEach(binding => {
          const bindingNode: TreeNode = {
            id: `rb-${binding.metadata.uid}`,
            name: binding.metadata.name,
            type: 'binding',
            icon: <Link className="w-4 h-4 text-green-400" />,
            children: [],
            metadata: binding,
            badges: [
              { label: binding.roleRef.name, variant: 'default' },
              { label: `${binding.subjects?.length || 0} subjects`, variant: 'outline' }
            ]
          };
          
          // Add subjects
          binding.subjects?.forEach((subject, idx) => {
            const subjectIcon = subject.kind === 'ServiceAccount' 
              ? <Bot className="w-3 h-3 text-purple-400" />
              : subject.kind === 'Group'
              ? <Users className="w-3 h-3 text-orange-400" />
              : <User className="w-3 h-3 text-green-400" />;
              
            const subjectNode: TreeNode = {
              id: `${bindingNode.id}-subject-${idx}`,
              name: subject.name,
              type: 'subject',
              icon: subjectIcon,
              children: [],
              metadata: subject,
              badges: [{ label: subject.kind, variant: 'outline' }]
            };
            bindingNode.children.push(subjectNode);
          });
          
          bindingsNode.children.push(bindingNode);
        });
        
        nsNode.children.push(bindingsNode);
      }
      
      tree.push(nsNode);
    });
    
    return tree;
  }, [resources]);

  // Filter tree based on search and filter type
  const filterTree = (nodes: TreeNode[], term: string, type: string): TreeNode[] => {
    return nodes.reduce((filtered: TreeNode[], node) => {
      const matchesSearch = !term || 
        node.name.toLowerCase().includes(term.toLowerCase());
      
      const matchesType = type === 'all' ||
        (type === 'roles' && (node.type === 'role' || node.type === 'clusterRole')) ||
        (type === 'bindings' && node.type === 'binding') ||
        (type === 'subjects' && node.type === 'subject');
      
      const filteredChildren = filterTree(node.children, term, type);
      
      if (matchesSearch && matchesType || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren
        });
      }
      
      return filtered;
    }, []);
  };

  const filteredTree = useMemo(() => {
    return filterTree(hierarchyTree, searchTerm, filterType);
  }, [hierarchyTree, searchTerm, filterType]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allNodeIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        allNodeIds.add(node.id);
        collectIds(node.children);
      });
    };
    collectIds(hierarchyTree);
    setExpandedNodes(allNodeIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    
    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-1.5 px-2 hover:bg-accent rounded-md cursor-pointer transition-colors`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            if (node.metadata && onNodeClick) {
              onNodeClick(node.metadata);
            }
          }}
        >
          {hasChildren && (
            <button
              className="p-0.5 hover:bg-accent rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          {node.icon}
          
          <span className="text-sm font-medium flex-1 truncate" title={node.name}>
            {node.name}
          </span>
          
          {node.badges?.map((badge, idx) => (
            <Badge key={idx} variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          ))}
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No RBAC data available</p>
          <p className="text-sm text-muted-foreground mt-2">Select a cluster to view hierarchy</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            RBAC Hierarchy
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-[200px]"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="h-8 px-3 py-1 text-sm border rounded-md bg-background"
            >
              <option value="all">All Types</option>
              <option value="roles">Roles Only</option>
              <option value="bindings">Bindings Only</option>
              <option value="subjects">Subjects Only</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              title="Expand all"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              title="Collapse all"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-2">
        <div className="pr-4 pb-4">
          {filteredTree.map(node => renderTreeNode(node))}
        </div>
      </CardContent>
    </Card>
  );
}