import React, { useState, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Server, RefreshCw, Download, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClusterSelector } from '@/components/cluster-selector';
import { useClusterStore } from '@/stores/cluster.store';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import TopologyGraph from '../topology/components/TopologyGraph';
import TopologySidebar from '../topology/components/TopologySidebar';
import { useTopologyGraph } from '../topology/hooks/useTopologyGraph';
import { useDaemonSetTopologyData } from '../topology/hooks/useDaemonSetTopologyData';
import type { 
  TopologyFilters, 
  TopologyViewOptions
} from '../topology/types';
import { getDefaultViewOptions } from '../topology/utils/layout';

const DaemonSetTopologyPage: React.FC = () => {
  // Get selected cluster from store
  const { currentContext, selectedContexts } = useClusterStore();
  
  // Use the first selected cluster or current context
  const selectedCluster = selectedContexts.length > 0 ? selectedContexts[0] : currentContext;
  
  // Fetch daemonset data from API
  const {
    namespaces,
    daemonsets,
    topology,
    selectedNamespace,
    selectedDaemonSet,
    selectNamespace,
    selectDaemonSet,
    refresh,
    loading,
    error
  } = useDaemonSetTopologyData(selectedCluster);
  
  // State management
  
  // Filters state
  const [filters, setFilters] = useState<TopologyFilters>({
    showServices: true,
    showEndpoints: true,
    showSecrets: false,
    showConfigMaps: false,
    showServiceAccount: false,
    showRBAC: false,
    showContainers: true,
    showReplicaSets: false, // DaemonSets don't have ReplicaSets
    showPods: true,
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
    onNodeClick: handleNodeClickInternal
  } = useTopologyGraph(
    topology, 
    filters,
    viewOptions, 
    selectedCluster,
    true // isDaemonSet flag
  );
  
  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    handleNodeClickInternal(event, node);
  }, [handleNodeClickInternal]);
  
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
          <div className="flex items-center justify-between mb-3 px-4 py-2 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">DaemonSet Topology</span>
            </div>
            <div className="flex items-center gap-1.5">
                  {/* Cluster selector */}
                  <ClusterSelector />
                  
                  {/* Namespace selector */}
                  <Select value={selectedNamespace} onValueChange={selectNamespace} disabled={!selectedCluster}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map(ns => (
                        <SelectItem key={ns} value={ns}>
                          {ns}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* DaemonSet selector */}
                  <Select 
                    value={selectedDaemonSet} 
                    onValueChange={selectDaemonSet}
                    disabled={!selectedNamespace || daemonsets.length === 0}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Select daemonset" />
                    </SelectTrigger>
                    <SelectContent>
                      {daemonsets.map(ds => (
                        <SelectItem key={ds.name} value={ds.name}>
                          <div className="flex items-center justify-between w-full">
                            <span>{ds.name}</span>
                            <div className="flex items-center gap-2 ml-2">
                              <Badge 
                                variant={ds.status === 'Healthy' ? 'success' : ds.status === 'Warning' ? 'warning' : 'destructive'}
                                className="text-xs"
                              >
                                {ds.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {ds.numberReady}/{ds.desiredNumberScheduled}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={viewOptions.layout} 
                    onValueChange={(value) => handleLayoutChange(value as 'horizontal' | 'vertical' | 'radial')}
                  >
                    <SelectTrigger className="w-[110px] h-8">
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
                    title="Export as SVG"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
          </div>
          
          {/* Compact Error state */}
          {error && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-destructive-foreground">{error}</span>
            </div>
          )}
          
          {/* Main content */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Sidebar */}
            <div className="w-52 flex-shrink-0">
              <TopologySidebar
                filters={filters}
                onFiltersChange={setFilters}
                namespace={topology?.namespace || selectedNamespace}
                hiddenFilters={['showReplicaSets']}
                topologyType="daemonset"
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
              ) : !topology && selectedDaemonSet ? (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No topology data available</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Select a namespace and daemonset to view the topology
                    </p>
                  </div>
                </Card>
              ) : topology ? (
                <TopologyGraph
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  viewOptions={viewOptions}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DaemonSetTopologyPage;