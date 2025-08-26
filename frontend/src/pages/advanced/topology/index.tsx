import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Network, RefreshCw, Download, Settings2, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClusterSelector } from '@/components/cluster-selector';
import { useClusterStore } from '@/stores/cluster.store';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import TopologyGraph from './components/TopologyGraph';
import TopologySidebar from './components/TopologySidebar';
import { useTopologyGraph } from './hooks/useTopologyGraph';
import { useTopologyData } from './hooks/useTopologyData';
import type { 
  DeploymentTopology, 
  TopologyFilters, 
  TopologyViewOptions
} from './types';
import { getDefaultViewOptions } from './utils/layout';

const TopologyPage: React.FC = () => {
  // Get selected cluster from store
  const { currentContext, selectedContexts } = useClusterStore();
  
  // Use the first selected cluster or current context
  const selectedCluster = selectedContexts.length > 0 ? selectedContexts[0] : currentContext;
  console.log('TopologyPage - selectedCluster:', selectedCluster, 'selectedContexts:', selectedContexts, 'currentContext:', currentContext);
  
  // Fetch real data from API with selected cluster
  const {
    namespaces,
    deployments,
    topology,
    selectedNamespace,
    selectedDeployment,
    selectNamespace,
    selectDeployment,
    refresh,
    loading,
    error
  } = useTopologyData(selectedCluster);
  
  // State management
  
  // Filters state
  const [filters, setFilters] = useState<TopologyFilters>({
    showServices: true,      // Default ON
    showEndpoints: true,     // Default ON
    showSecrets: false,      // Default OFF - user can enable if needed
    showConfigMaps: false,   // Default OFF - user can enable if needed
    showServiceAccount: false, // Default OFF - user can enable if needed
    showRBAC: false,         // Default OFF - user can enable if needed
    showContainers: true,    // Default ON
    statusFilter: 'all',
    searchTerm: ''
  });
  
  // View options state
  const [viewOptions, setViewOptions] = useState<TopologyViewOptions>(getDefaultViewOptions());
  
  // Use the topology graph hook with real data
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeClick: handleNodeClickInternal,
    getNodeById
  } = useTopologyGraph(topology, filters, viewOptions, selectedCluster);
  
  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    handleNodeClickInternal(event, node);
  }, [handleNodeClickInternal]);
  
  // Handle group node toggle event
  React.useEffect(() => {
    const handleGroupNodeToggle = (event: CustomEvent) => {
      console.log('Group node toggled:', event.detail);
      // The graph will automatically re-render with the expanded/collapsed state
    };
    
    window.addEventListener('groupNodeToggle', handleGroupNodeToggle as EventListener);
    return () => {
      window.removeEventListener('groupNodeToggle', handleGroupNodeToggle as EventListener);
    };
  }, []);
  
  // Handle view resource YAML event
  React.useEffect(() => {
    const handleViewResourceYaml = (event: CustomEvent) => {
      const { type, name, namespace } = event.detail;
      console.log('View YAML for:', type, name, namespace);
      
      // Create a virtual node to display in the details panel
      const virtualNode: TopologyNode = {
        id: `${type}-${name}`,
        type: type as any,
        position: { x: 0, y: 0 },
        data: {
          label: name,
          namespace: namespace,
          status: 'active',
          resource: {
            name,
            namespace,
            type
          }
        }
      };
      
      setSelectedNode(virtualNode);
      setIsDetailsPanelOpen(true);
    };
    
    window.addEventListener('viewResourceYaml', handleViewResourceYaml as EventListener);
    return () => {
      window.removeEventListener('viewResourceYaml', handleViewResourceYaml as EventListener);
    };
  }, []);
  
  // Export topology as SVG
  const handleExport = useCallback(() => {
    // This would export the current view as SVG/PNG
    console.log('Exporting topology...');
  }, []);
  
  // Change layout
  const handleLayoutChange = useCallback((layout: 'horizontal' | 'vertical' | 'radial') => {
    setViewOptions(prev => ({ ...prev, layout }));
  }, []);
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          {/* Header */}
          <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Network className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Deployment Topology</CardTitle>
                <CardDescription>
                  Interactive visualization of Kubernetes resource relationships
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Cluster selector */}
              <ClusterSelector />
              
              {/* Namespace selector */}
              <Select value={selectedNamespace} onValueChange={selectNamespace} disabled={!selectedCluster}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select namespace" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(ns => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Deployment selector */}
              <Select 
                value={selectedDeployment} 
                onValueChange={selectDeployment}
                disabled={!selectedNamespace || deployments.length === 0}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select deployment" />
                </SelectTrigger>
                <SelectContent>
                  {deployments.map(dep => (
                    <SelectItem key={dep.name} value={dep.name}>
                      <div className="flex items-center justify-between w-full">
                        <span>{dep.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {dep.ready}/{dep.replicas}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={viewOptions.layout} 
                onValueChange={(value) => handleLayoutChange(value as 'horizontal' | 'vertical' | 'radial')}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                size="icon"
                variant="outline"
                onClick={refresh}
                title="Refresh topology"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                size="icon"
                variant="outline"
                onClick={handleExport}
                title="Export as SVG"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Error state */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <TopologySidebar
            filters={filters}
            onFiltersChange={setFilters}
            namespace={topology?.namespace || selectedNamespace}
          />
        </div>
        
        {/* Graph */}
        <div className="flex-1 min-w-0">
          {loading && !topology ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading topology...</p>
              </div>
            </Card>
          ) : !topology && selectedDeployment ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No topology data available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Select a namespace and deployment to view the topology
                </p>
              </div>
            </Card>
          ) : (
            <TopologyGraph
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              viewOptions={viewOptions}
            />
          )}
        </div>
      </div>
        </main>
      </div>
    </div>
  );
};

export default TopologyPage;