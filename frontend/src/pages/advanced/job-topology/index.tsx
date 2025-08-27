import React, { useState, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Briefcase, RefreshCw, Download, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClusterSelector } from '@/components/cluster-selector';
import { useClusterStore } from '@/stores/cluster.store';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import TopologyGraph from '../topology/components/TopologyGraph';
import TopologySidebar from '../topology/components/TopologySidebar';
import { useTopologyGraph } from '../topology/hooks/useTopologyGraph';
import { useJobTopologyData } from '../topology/hooks/useJobTopologyData';
import type { 
  TopologyFilters, 
  TopologyViewOptions
} from '../topology/types';
import { getDefaultViewOptions } from '../topology/utils/layout';

const JobTopologyPage: React.FC = () => {
  // Get selected cluster from store
  const { currentContext, selectedContexts } = useClusterStore();
  
  // Use the first selected cluster or current context
  const selectedCluster = selectedContexts.length > 0 ? selectedContexts[0] : currentContext;
  
  // Fetch job data from API
  const {
    namespaces,
    jobs,
    topology,
    selectedNamespace,
    selectedJob,
    selectNamespace,
    selectJob,
    refresh,
    loading,
    error
  } = useJobTopologyData(selectedCluster);
  
  // State management
  
  // Filters state
  const [filters, setFilters] = useState<TopologyFilters>({
    showServices: false, // Jobs rarely have services
    showEndpoints: false,
    showSecrets: false,
    showConfigMaps: false,
    showServiceAccount: false,
    showRBAC: false,
    showContainers: true,
    showReplicaSets: false, // Jobs don't have ReplicaSets
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
    false, // Not a DaemonSet
    true // Is a Job
  );
  
  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    handleNodeClickInternal(event, node);
  }, [handleNodeClickInternal]);
  
  // Change layout
  const handleLayoutChange = useCallback((layout: 'horizontal' | 'vertical' | 'radial') => {
    setViewOptions(prev => ({ ...prev, layout }));
  }, []);
  
  // Get job status for display
  const getJobStatus = () => {
    if (!topology?.job) return null;
    const job = topology.job;
    
    if (job.completionTime && job.succeeded > 0) {
      return { text: 'Completed', variant: 'default' as const, color: 'text-green-600' };
    } else if (job.failed > 0) {
      return { text: 'Failed', variant: 'destructive' as const, color: 'text-red-600' };
    } else if (job.active > 0) {
      return { text: 'Active', variant: 'secondary' as const, color: 'text-blue-600' };
    }
    return { text: 'Unknown', variant: 'outline' as const, color: 'text-gray-600' };
  };
  
  const jobStatus = getJobStatus();
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          {/* Ultra Compact Header */}
          <div className="flex items-center justify-between mb-3 px-4 py-2 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Job Topology</span>
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
                  
                  {/* Job selector */}
                  <Select 
                    value={selectedJob} 
                    onValueChange={selectJob}
                    disabled={!selectedNamespace || jobs.length === 0}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.name} value={job.name}>
                          <div className="flex items-center gap-2">
                            <span>{job.name}</span>
                            {job.succeeded > 0 && (
                              <Badge variant="outline" className="text-xs h-4 px-1 text-green-600">
                                {job.succeeded}✓
                              </Badge>
                            )}
                            {job.failed > 0 && (
                              <Badge variant="outline" className="text-xs h-4 px-1 text-red-600">
                                {job.failed}✗
                              </Badge>
                            )}
                            {job.active > 0 && (
                              <Badge variant="outline" className="text-xs h-4 px-1 text-blue-600">
                                {job.active}↻
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Job Status Badge */}
                  {jobStatus && (
                    <Badge variant={jobStatus.variant} className={jobStatus.color}>
                      {jobStatus.text}
                    </Badge>
                  )}
                  
                  {/* Refresh button */}
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      console.log('Refresh button clicked');
                      refresh();
                    }}
                    disabled={loading || !selectedJob}
                    title="Refresh topology"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
          </div>

          {/* Compact Error */}
          {error && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-destructive-foreground">{error}</span>
            </div>
          )}

          {/* Main Content Area */}
          {selectedJob && topology ? (
            <div className="flex-1 flex gap-4">
              {/* Filters Sidebar */}
              <div className="w-52 flex-shrink-0">
                <TopologySidebar
                filters={filters}
                onFiltersChange={setFilters}
                onLayoutChange={handleLayoutChange}
                currentLayout={viewOptions.layout}
                topologyType="job"
                />
              </div>

              {/* Topology Graph */}
              <Card className="flex-1">
                <TopologyGraph
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  viewOptions={viewOptions}
                  fitView
                />
              </Card>

            </div>
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {!selectedCluster 
                    ? "Select a cluster to view jobs"
                    : !selectedNamespace 
                    ? "Select a namespace to view jobs"
                    : !selectedJob
                    ? jobs.length === 0 
                      ? "No jobs found in this namespace"
                      : "Select a job to view its topology"
                    : "Loading job topology..."}
                </p>
                {!selectedCluster && (
                  <p className="text-sm text-muted-foreground">
                    Use the cluster selector above to choose a cluster
                  </p>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default JobTopologyPage;