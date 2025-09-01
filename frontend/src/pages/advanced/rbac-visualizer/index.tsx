import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useClusterStore } from '@/stores/cluster.store';
import { rbacService } from './services/rbac-api';
import { buildUrl } from '@/utils/api-urls';
import RBACCardView from './components/RBACCardView';
import RBACGraphView from './components/RBACGraphView';
import RBACGalaxyView from './components/RBACGalaxyView';
import RBACSecurityMatrix from './components/RBACSecurityMatrix';
import RBACThreatRadar from './components/RBACThreatRadar';
import RBACFilters from './components/RBACFilters';
import RBACDetailPanel from './components/RBACDetailPanel';
import RBACSidebar from './components/RBACSidebar';
import RBACVisualizerV2 from './components/RBACVisualizerV2';
import RBACAccessGraph from './components/RBACAccessGraph';
import type { 
  ViewMode, 
  FilterOptions, 
  RBACResources, 
  RBACGraph as RBACGraphType,
  RBACGraphNode,
  RBACGraphEdge
} from './types';
import { Network, List, GitBranch, ChevronRight, RefreshCw, Download, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import RBACHierarchy from './components/RBACHierarchy';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function RBACVisualizer() {
  const { currentContext } = useClusterStore();
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [showAccessGraph, setShowAccessGraph] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<RBACResources | null>(null);
  const [graphData, setGraphData] = useState<RBACGraphType | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [useV2Visualizer, setUseV2Visualizer] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    showSystemRoles: false,
    showServiceAccounts: true,
    showUsers: true,
    showGroups: true,
    showBindings: true,
    showPods: true,
    searchTerm: '',
  });
  
  // Detail panel state
  const [detailPanel, setDetailPanel] = useState<{
    open: boolean;
    title: string;
    type: 'role' | 'binding' | 'subject';
    data: any;
  }>({
    open: false,
    title: '',
    type: 'role',
    data: null,
  });

  // Fetch namespaces
  const fetchNamespaces = useCallback(async () => {
    if (!currentContext) return;
    
    try {
      const response = await fetch(buildUrl(`/api/v1/resources/namespaces?context=${currentContext}`), {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched namespaces:', data.items?.length, 'namespaces');
        setNamespaces(data.items?.map((ns: any) => ns.name) || []);
      } else {
        console.error('Failed to fetch namespaces:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch namespaces:', error);
    }
  }, [currentContext]);

  // Fetch RBAC data based on view mode
  const fetchRBACData = useCallback(async () => {
    if (!currentContext) {
      console.error('No cluster selected. Please select a cluster first');
      return;
    }

    setLoading(true);
    try {
      switch (viewMode) {
        case 'graph':
          const resources = await rbacService.getRBACResources(
            currentContext,
            filters.namespace
          );
          setResources({ ...resources, context: currentContext });
          break;
          
        case 'list':
        case 'hierarchy':
          const listResources = await rbacService.getRBACResources(
            currentContext,
            filters.namespace
          );
          setResources({ ...listResources, context: currentContext });
          break;
      }
    } catch (error) {
      console.error('Failed to fetch RBAC data:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentContext, viewMode, filters]);

  // Handle node click in graph
  const handleNodeClick = useCallback(async (node: RBACGraphNode) => {
    if (!currentContext) return;
    
    try {
      if (node.type === 'role' || node.type === 'clusterRole') {
        const roleDetails = await rbacService.getRoleDetails(
          currentContext,
          node.label,
          node.type === 'role' ? 'role' : 'clusterRole',
          node.data.namespace
        );
        
        setDetailPanel({
          open: true,
          title: `${node.type === 'clusterRole' ? 'ClusterRole' : 'Role'}: ${node.label}`,
          type: 'role',
          data: roleDetails.role,
        });
      } else {
        // Handle subject clicks
        const subjectKind = node.type === 'user' ? 'User' : 
                          node.type === 'group' ? 'Group' : 'ServiceAccount';
        const permissions = await rbacService.getSubjectPermissions(
          currentContext,
          node.label,
          subjectKind,
          node.data.namespace
        );
        
        setDetailPanel({
          open: true,
          title: `${subjectKind}: ${node.label}`,
          type: 'subject',
          data: permissions,
        });
      }
    } catch (error) {
      console.error('Failed to fetch details:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [currentContext]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!resources) {
      console.error('No data to export. Please load RBAC resources first');
      return;
    }

    const yaml = rbacService.exportRBACConfiguration(resources, 'yaml');
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rbac-config-${currentContext}-${Date.now()}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('RBAC configuration exported as YAML');
  }, [resources, currentContext]);

  // Effects
  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  useEffect(() => {
    fetchRBACData();
  }, [fetchRBACData]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <Sidebar className="hidden lg:block border-r" />
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col space-y-4 p-4">
            {/* Filters */}
            <RBACFilters
        filters={filters}
        namespaces={namespaces}
        resources={resources}
        onFiltersChange={setFilters}
        onRefresh={fetchRBACData}
        onExport={handleExport}
      />

      {/* Enhanced View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <SegmentedControl
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { value: 'graph', label: 'Graph', icon: <Network className="w-4 h-4" /> },
            { value: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
            { value: 'hierarchy', label: 'Hierarchy', icon: <GitBranch className="w-4 h-4" /> },
            { value: 'access', label: 'Access Graph', icon: <Network className="w-4 h-4" /> }
          ]}
        />
        
        <div className="flex items-center gap-2">
          <Switch
            id="v2-mode"
            checked={useV2Visualizer}
            onCheckedChange={setUseV2Visualizer}
          />
          <Label htmlFor="v2-mode" className="flex items-center gap-2 cursor-pointer">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            Enhanced Multi-View Mode
          </Label>
        </div>
      </div>

      {/* Conditional Content Rendering */}
      {useV2Visualizer && resources ? (
        <div className="flex-1 overflow-hidden">
          <RBACVisualizerV2 
            resources={resources}
            onNodeSelect={(node) => {
              console.log('V2 Node selected:', node);
            }}
          />
        </div>
      ) : (
      <Tabs value={viewMode} className="flex-1 flex flex-col overflow-hidden">

        <TabsContent value="graph" className="flex-1 mt-4 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" style={{ height: 'calc(100% - 2rem)' }}>
          <div className="h-full flex gap-3">
            {/* Sidebar */}
            <div className="w-52 flex-shrink-0">
              <RBACSidebar
                filters={filters}
                onFiltersChange={setFilters}
                namespace={filters.namespace}
              />
            </div>
            
            {/* Graph */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-3 px-4 py-2 bg-card border rounded-lg">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">RBAC Permissions Graph</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchRBACData}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                    title="Refresh"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExport}
                    className="h-8 w-8 p-0"
                    title="Export as YAML"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              
              {/* Graph Content */}
              {loading ? (
                <Card className="flex-1">
                  <CardContent className="h-full flex items-center justify-center">
                    <Skeleton className="w-full h-full" />
                  </CardContent>
                </Card>
              ) : resources ? (
                <div className="flex-1 overflow-hidden">
                  <RBACGraphView
                    resources={resources}
                    onNodeClick={handleNodeClick}
                    filters={filters}
                  />
                </div>
              ) : (
                <Card className="flex-1">
                  <CardContent className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="flex-1 mt-4 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" style={{ height: 'calc(100% - 2rem)' }}>
          {loading ? (
            <Skeleton className="w-full h-full" />
          ) : resources ? (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Roles Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="text-lg font-semibold">Namespace Roles ({resources.roles.length})</h3>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {resources.roles.length > 0 ? (
                          resources.roles.map((role) => (
                            <div 
                              key={role.metadata.uid} 
                              className="p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => handleNodeClick({
                                id: role.metadata.uid,
                                label: role.metadata.name,
                                type: 'role',
                                data: { namespace: role.metadata.namespace }
                              } as RBACGraphNode)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{role.metadata.name}</div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    <span className="inline-flex items-center gap-1">
                                      <span>Namespace:</span>
                                      <span className="font-mono text-xs">{role.metadata.namespace}</span>
                                    </span>
                                    <span className="mx-2">•</span>
                                    <span>{role.rules.length} {role.rules.length === 1 ? 'rule' : 'rules'}</span>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            No namespace roles found
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* ClusterRoles Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="text-lg font-semibold">
                        Cluster Roles ({resources.clusterRoles.filter(cr => filters.showSystemRoles || !cr.metadata.name.startsWith('system:')).length})
                      </h3>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {resources.clusterRoles
                          .filter(cr => filters.showSystemRoles || !cr.metadata.name.startsWith('system:'))
                          .length > 0 ? (
                          resources.clusterRoles
                            .filter(cr => filters.showSystemRoles || !cr.metadata.name.startsWith('system:'))
                            .map((role) => (
                            <div 
                              key={role.metadata.uid} 
                              className="p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => handleNodeClick({
                                id: role.metadata.uid,
                                label: role.metadata.name,
                                type: 'clusterRole',
                                data: {}
                              } as RBACGraphNode)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {role.metadata.name}
                                    {role.metadata.name.startsWith('system:') && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        System
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    <span>Cluster-wide</span>
                                    <span className="mx-2">•</span>
                                    <span>{role.rules.length} {role.rules.length === 1 ? 'rule' : 'rules'}</span>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            No cluster roles found
                            {!filters.showSystemRoles && (
                              <div className="text-sm mt-2">
                                Enable "Show System Roles" to see system roles
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <Card className="h-full">
              <CardContent className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hierarchy" className="flex-1 mt-4 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" style={{ height: 'calc(100% - 2rem)' }}>
          {loading ? (
            <Card className="h-full">
              <CardContent className="h-full flex items-center justify-center">
                <Skeleton className="w-full h-full" />
              </CardContent>
            </Card>
          ) : (
            <div className="h-full overflow-hidden">
              <RBACHierarchy
                resources={resources}
                onNodeClick={(node) => {
                  if (node && node.metadata) {
                    const nodeType = node.type === 'clusterRole' ? 'ClusterRole' :
                                    node.type === 'role' ? 'Role' :
                                    node.type === 'binding' ? 'Binding' :
                                    node.type === 'subject' ? 'Subject' : 'Details';
                    setDetailPanel({
                      open: true,
                      title: `${nodeType}: ${node.name}`,
                      type: node.type === 'subject' ? 'subject' : 
                            node.type === 'binding' ? 'binding' : 'role',
                      data: node.metadata,
                    });
                  }
                }}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="access" className="flex-1 mt-4 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col" style={{ height: 'calc(100% - 2rem)' }}>
          {loading ? (
            <Card className="h-full">
              <CardContent className="h-full flex items-center justify-center">
                <Skeleton className="w-full h-full" />
              </CardContent>
            </Card>
          ) : resources ? (
            <div className="h-full overflow-hidden">
              <RBACAccessGraph
                resources={resources}
                filters={filters}
                onNodeSelect={(node) => {
                  console.log('Access Graph Node selected:', node);
                  handleNodeClick(node);
                }}
              />
            </div>
          ) : (
            <Card className="h-full">
              <CardContent className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      )}

      {/* Detail Panel */}
      <RBACDetailPanel
        open={detailPanel.open}
        onClose={() => setDetailPanel({ ...detailPanel, open: false })}
        title={detailPanel.title}
        type={detailPanel.type}
        data={detailPanel.data}
      />
          </div>
        </div>
      </div>
    </div>
  );
}