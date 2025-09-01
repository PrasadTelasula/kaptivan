import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  BackgroundVariant,
  Panel,
} from 'reactflow';

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
};

import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Users, 
  Shield, 
  Key, 
  Lock, 
  Unlock,
  Eye,
  Search,
  ChevronDown,
  ChevronRight,
  Network,
  GitBranch,
  Target,
  Layers,
  FileText,
  Download,
  Filter,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { RBACResources, RBACRole, RBACRoleBinding } from '../types';

interface RBACVisualizerV2Props {
  resources: RBACResources;
  onNodeSelect?: (node: any) => void;
}

type ViewMode = 'identity' | 'resource' | 'hierarchy';

interface PermissionRule {
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
  resourceNames?: string[];
}

// Custom node components for each view
const IdentityNode = ({ data }: { data: any }) => {
  const getIcon = () => {
    switch (data.subjectKind) {
      case 'User': return <User className="w-5 h-5" />;
      case 'Group': return <Users className="w-5 h-5" />;
      case 'ServiceAccount': return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  return (
    <Card className="w-64 border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {getIcon()}
          <CardTitle className="text-sm">{data.label}</CardTitle>
        </div>
        <CardDescription className="text-xs">
          {data.subjectKind} • {data.namespace || 'Cluster-wide'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {data.bindingCount} bindings
          </Badge>
          {data.roleCount > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">
              {data.roleCount} roles
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const RoleNode = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Card className={`w-72 border ${data.kind === 'ClusterRole' ? 'border-blue-500' : 'border-green-500'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <CardTitle className="text-sm">{data.label}</CardTitle>
          </div>
          <Badge variant={data.kind === 'ClusterRole' ? 'default' : 'secondary'}>
            {data.kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {data.rules?.length || 0} rules
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {data.rules?.map((rule: PermissionRule, idx: number) => (
                  <div key={idx} className="text-xs p-2 bg-muted rounded">
                    <div className="font-medium">Resources: {rule.resources?.join(', ') || 'All'}</div>
                    <div className="text-muted-foreground">Verbs: {rule.verbs?.join(', ') || 'All'}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

const ResourceNode = ({ data }: { data: any }) => {
  const getAccessLevel = (verbs: string[]) => {
    if (verbs.includes('*') || verbs.includes('delete')) return 'critical';
    if (verbs.includes('create') || verbs.includes('update')) return 'write';
    if (verbs.includes('get') || verbs.includes('list')) return 'read';
    return 'none';
  };

  const accessLevel = getAccessLevel(data.verbs || []);
  const borderColor = {
    critical: 'border-red-500',
    write: 'border-orange-500',
    read: 'border-green-500',
    none: 'border-gray-500'
  }[accessLevel];

  return (
    <Card className={`w-64 border-2 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <CardTitle className="text-sm">{data.label}</CardTitle>
          </div>
          <Badge variant={accessLevel === 'critical' ? 'destructive' : 'default'}>
            {data.apiGroup || 'core'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {data.verbs?.map((verb: string) => (
              <Badge key={verb} variant="outline" className="text-xs">
                {verb}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            {data.accessorCount} accessor{data.accessorCount !== 1 ? 's' : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const HierarchyNode = ({ data }: { data: any }) => {
  const hasAggregation = data.aggregationRule && data.aggregationRule.clusterRoleSelectors?.length > 0;
  
  return (
    <Card className={`w-80 ${hasAggregation ? 'border-purple-500 border-2' : 'border'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              {hasAggregation && <Layers className="w-4 h-4 text-purple-500" />}
              {data.label}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {data.namespace ? `Namespace: ${data.namespace}` : 'Cluster-scoped'}
            </CardDescription>
          </div>
          <Badge variant={data.kind === 'ClusterRole' ? 'default' : 'secondary'}>
            {data.kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasAggregation ? (
          <div className="space-y-2">
            <div className="text-xs font-medium">Aggregates from:</div>
            {data.aggregationRule.clusterRoleSelectors.map((selector: any, idx: number) => (
              <div key={idx} className="text-xs p-1 bg-purple-50 dark:bg-purple-950 rounded">
                {Object.entries(selector.matchLabels || {}).map(([k, v]) => (
                  <div key={k}>{k}: {String(v)}</div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {data.rules?.length || 0} direct rules
            </div>
            {data.inheritedRules > 0 && (
              <div className="text-xs text-purple-600">
                +{data.inheritedRules} inherited rules
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Node type mapping
const nodeTypes = {
  identity: IdentityNode,
  role: RoleNode,
  resource: ResourceNode,
  hierarchy: HierarchyNode,
};

export default function RBACVisualizerV2({ resources, onNodeSelect }: RBACVisualizerV2Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('identity');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsContent, setDetailsContent] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Generate nodes and edges for Identity-Centric View
  const generateIdentityView = useCallback((subjectName?: string) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Get all subjects from bindings
    const subjects = new Map<string, any>();
    
    [...(resources.roleBindings || []), ...(resources.clusterRoleBindings || [])].forEach(binding => {
      binding.subjects?.forEach((subject: any) => {
        const key = `${subject.kind}:${subject.namespace || 'cluster'}:${subject.name}`;
        if (!subjectName || subject.name === subjectName) {
          if (!subjects.has(key)) {
            subjects.set(key, {
              ...subject,
              bindings: [],
              roles: new Set()
            });
          }
          subjects.get(key).bindings.push(binding);
          subjects.get(key).roles.add(binding.roleRef.name);
        }
      });
    });

    // Create nodes for subjects
    let yOffset = 0;
    subjects.forEach((subject, key) => {
      const subjectId = `subject-${key}`;
      nodes.push({
        id: subjectId,
        type: 'identity',
        position: { x: 400, y: yOffset },
        data: {
          label: subject.name,
          subjectKind: subject.kind,
          namespace: subject.namespace,
          bindingCount: subject.bindings.length,
          roleCount: subject.roles.size
        }
      });

      // Add role nodes and connections
      let roleOffset = 0;
      subject.bindings.forEach((binding: any, idx: number) => {
        const roleId = `role-${binding.roleRef.name}-${idx}`;
        const role = binding.roleRef.kind === 'Role' 
          ? resources.roles?.find(r => r.metadata.name === binding.roleRef.name && r.metadata.namespace === binding.metadata?.namespace)
          : resources.clusterRoles?.find(r => r.metadata.name === binding.roleRef.name);

        if (role) {
          nodes.push({
            id: roleId,
            type: 'role',
            position: { x: 800, y: yOffset + roleOffset },
            data: {
              label: role.metadata.name,
              kind: binding.roleRef.kind,
              namespace: role.metadata.namespace,
              rules: role.rules
            }
          });

          edges.push({
            id: `edge-${subjectId}-${roleId}`,
            source: subjectId,
            target: roleId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
          });

          roleOffset += 150;
        }
      });

      yOffset += Math.max(300, roleOffset);
    });

    return { nodes, edges };
  }, [resources]);

  // Generate nodes and edges for Resource-Centric View
  const generateResourceView = useCallback((resourceName?: string) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Group resources by type
    const resourceMap = new Map<string, any>();
    
    [...(resources.roles || []), ...(resources.clusterRoles || [])].forEach(role => {
      role.rules?.forEach((rule: PermissionRule) => {
        rule.resources?.forEach(resource => {
          if (!resourceName || resource === resourceName) {
            const key = `${rule.apiGroups?.[0] || 'core'}:${resource}`;
            if (!resourceMap.has(key)) {
              resourceMap.set(key, {
                apiGroup: rule.apiGroups?.[0] || 'core',
                resource,
                verbs: new Set(),
                accessors: []
              });
            }
            rule.verbs?.forEach(verb => resourceMap.get(key).verbs.add(verb));
            resourceMap.get(key).accessors.push({
              role: role.metadata.name,
              kind: role.kind || (role.metadata.namespace ? 'Role' : 'ClusterRole')
            });
          }
        });
      });
    });

    // Create resource nodes
    let yOffset = 0;
    resourceMap.forEach((resourceData, key) => {
      const resourceId = `resource-${key}`;
      nodes.push({
        id: resourceId,
        type: 'resource',
        position: { x: 400, y: yOffset },
        data: {
          label: resourceData.resource,
          apiGroup: resourceData.apiGroup,
          verbs: Array.from(resourceData.verbs),
          accessorCount: resourceData.accessors.length
        }
      });

      // Add accessor nodes
      let accessorOffset = 0;
      resourceData.accessors.forEach((accessor: any, idx: number) => {
        const accessorId = `accessor-${key}-${idx}`;
        nodes.push({
          id: accessorId,
          type: 'role',
          position: { x: 800, y: yOffset + accessorOffset },
          data: {
            label: accessor.role,
            kind: accessor.kind
          }
        });

        edges.push({
          id: `edge-${resourceId}-${accessorId}`,
          source: resourceId,
          target: accessorId,
          type: 'smoothstep',
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
        });

        accessorOffset += 100;
      });

      yOffset += Math.max(200, accessorOffset);
    });

    return { nodes, edges };
  }, [resources]);

  // Generate nodes and edges for Role Hierarchy View
  const generateHierarchyView = useCallback(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Build hierarchy map
    const roleHierarchy = new Map<string, any>();
    
    // Process ClusterRoles with aggregation
    resources.clusterRoles?.forEach(role => {
      const key = role.metadata.name;
      roleHierarchy.set(key, {
        ...role,
        kind: 'ClusterRole',
        children: [],
        parents: []
      });

      // Check for aggregation rules
      if (role.aggregationRule?.clusterRoleSelectors) {
        // This role aggregates other roles
        resources.clusterRoles?.forEach(otherRole => {
          role.aggregationRule.clusterRoleSelectors.forEach((selector: any) => {
            const matches = Object.entries(selector.matchLabels || {}).every(([k, v]) => 
              otherRole.metadata.labels?.[k] === v
            );
            if (matches && otherRole.metadata.name !== role.metadata.name) {
              roleHierarchy.get(key).children.push(otherRole.metadata.name);
            }
          });
        });
      }
    });

    // Layout using dagre
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150 });

    roleHierarchy.forEach((role, key) => {
      dagreGraph.setNode(key, { width: 320, height: 150 });
    });

    roleHierarchy.forEach((role, key) => {
      role.children.forEach((child: string) => {
        dagreGraph.setEdge(key, child);
      });
    });

    dagre.layout(dagreGraph);

    // Create nodes
    roleHierarchy.forEach((role, key) => {
      const nodeWithPosition = dagreGraph.node(key);
      if (nodeWithPosition) {
        nodes.push({
          id: `hierarchy-${key}`,
          type: 'hierarchy',
          position: { 
            x: nodeWithPosition.x - 160, 
            y: nodeWithPosition.y - 75 
          },
          data: {
            label: role.metadata.name,
            kind: role.kind,
            namespace: role.metadata?.namespace,
            aggregationRule: role.aggregationRule,
            rules: role.rules,
            inheritedRules: role.children.length * 5 // Approximate
          }
        });
      }
    });

    // Create edges for aggregation
    roleHierarchy.forEach((role, key) => {
      role.children.forEach((child: string) => {
        edges.push({
          id: `hierarchy-edge-${key}-${child}`,
          source: `hierarchy-${key}`,
          target: `hierarchy-${child}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5 5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
        });
      });
    });

    return { nodes, edges };
  }, [resources]);

  // Generate view based on mode
  const { nodes: viewNodes, edges: viewEdges } = useMemo(() => {
    switch (viewMode) {
      case 'identity':
        return generateIdentityView(selectedSubject || undefined);
      case 'resource':
        return generateResourceView(selectedResource || undefined);
      case 'hierarchy':
        return generateHierarchyView();
      default:
        return { nodes: [], edges: [] };
    }
  }, [viewMode, selectedSubject, selectedResource, generateIdentityView, generateResourceView, generateHierarchyView]);

  const [nodes, setNodes, onNodesChange] = useNodesState(viewNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(viewEdges);

  // Update nodes when view changes
  React.useEffect(() => {
    setNodes(viewNodes);
    setEdges(viewEdges);
  }, [viewNodes, viewEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setDetailsContent(node.data);
    setDetailsOpen(true);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  return (
    <div className="h-full flex flex-col">
      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="identity" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Identity-Centric
          </TabsTrigger>
          <TabsTrigger value="resource" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Resource-Centric
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Role Hierarchy
          </TabsTrigger>
        </TabsList>

        {/* Controls Panel */}
        <div className="flex items-center gap-4 p-4 border-b">
          {viewMode === 'identity' && (
            <Select value={selectedSubject || 'all'} onValueChange={(value) => setSelectedSubject(value === 'all' ? null : value)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a subject..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {Array.from(new Set([
                  ...(resources.roleBindings || []).flatMap(b => b.subjects?.map((s: any) => s.name) || []),
                  ...(resources.clusterRoleBindings || []).flatMap(b => b.subjects?.map((s: any) => s.name) || [])
                ])).map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {viewMode === 'resource' && (
            <Select value={selectedResource || 'all'} onValueChange={(value) => setSelectedResource(value === 'all' ? null : value)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a resource..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {Array.from(new Set([
                  ...(resources.roles || []).flatMap(r => r.rules?.flatMap((rule: any) => rule.resources || []) || []),
                  ...(resources.clusterRoles || []).flatMap(r => r.rules?.flatMap((rule: any) => rule.resources || []) || [])
                ])).map(resource => (
                  <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="ml-auto"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Graph Canvas */}
        <TabsContent value={viewMode} className="flex-1 mt-0">
          <div className="h-[600px] border rounded-lg">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background variant={BackgroundVariant.Dots} />
              <Controls />
              <MiniMap />
              <Panel position="top-right" className="bg-background/80 backdrop-blur p-2 rounded-lg border">
                <div className="text-xs space-y-1">
                  <div className="font-medium">View: {viewMode}</div>
                  <div>Nodes: {nodes.length}</div>
                  <div>Edges: {edges.length}</div>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </TabsContent>
      </Tabs>

      {/* Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>
              Complete information about the selected item
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-150px)] mt-4">
            {detailsContent && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Basic Information</h3>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {detailsContent.label}</div>
                    <div><span className="text-muted-foreground">Type:</span> {detailsContent.kind || detailsContent.subjectKind || 'Resource'}</div>
                    {detailsContent.namespace && (
                      <div><span className="text-muted-foreground">Namespace:</span> {detailsContent.namespace}</div>
                    )}
                  </div>
                </div>

                {detailsContent.rules && (
                  <div>
                    <h3 className="font-medium mb-2">Permissions</h3>
                    <div className="space-y-2">
                      {detailsContent.rules.map((rule: PermissionRule, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="p-3">
                            <div className="space-y-1 text-sm">
                              <div><span className="font-medium">Resources:</span> {rule.resources?.join(', ')}</div>
                              <div><span className="font-medium">Verbs:</span> {rule.verbs?.join(', ')}</div>
                              <div><span className="font-medium">API Groups:</span> {rule.apiGroups?.join(', ') || 'core'}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {detailsContent.verbs && (
                  <div>
                    <h3 className="font-medium mb-2">Allowed Operations</h3>
                    <div className="flex flex-wrap gap-2">
                      {detailsContent.verbs.map((verb: string) => (
                        <Badge key={verb} variant="secondary">{verb}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Search Command Palette */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search subjects, roles, or resources..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Subjects">
            {Array.from(new Set([
              ...(resources.roleBindings || []).flatMap(b => b.subjects?.map((s: any) => s.name) || []),
              ...(resources.clusterRoleBindings || []).flatMap(b => b.subjects?.map((s: any) => s.name) || [])
            ])).slice(0, 5).map(name => (
              <CommandItem
                key={name}
                onSelect={() => {
                  setSelectedSubject(name);
                  setViewMode('identity');
                  setSearchOpen(false);
                }}
              >
                <User className="mr-2 h-4 w-4" />
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Resources">
            {Array.from(new Set([
              ...(resources.roles || []).flatMap(r => r.rules?.flatMap((rule: any) => rule.resources || []) || []),
              ...(resources.clusterRoles || []).flatMap(r => r.rules?.flatMap((rule: any) => rule.resources || []) || [])
            ])).slice(0, 5).map(resource => (
              <CommandItem
                key={resource}
                onSelect={() => {
                  setSelectedResource(resource);
                  setViewMode('resource');
                  setSearchOpen(false);
                }}
              >
                <Lock className="mr-2 h-4 w-4" />
                {resource}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}