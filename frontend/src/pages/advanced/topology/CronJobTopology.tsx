import React, { useState, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, Clock, Pause, Play, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClusterSelector } from '@/components/cluster-selector';
import { useClusterStore } from '@/stores/cluster.store';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar-new';
import TopologyGraph from './components/TopologyGraph';
import TopologySidebar from './components/TopologySidebar';
import { useTopologyGraph } from './hooks/useTopologyGraph';
import { useCronJobTopologyData } from './hooks/useCronJobTopologyData';
import type { 
  TopologyFilters, 
  TopologyViewOptions
} from './types';
import { getDefaultViewOptions } from './utils/layout';

const CronJobTopologyPage: React.FC = () => {
  // Get selected cluster from store
  const { currentContext, selectedContexts } = useClusterStore();
  
  // Use the first selected cluster or current context
  const selectedCluster = selectedContexts.length > 0 ? selectedContexts[0] : currentContext;
  
  // Fetch CronJob data from API
  const {
    namespaces,
    cronjobs,
    topology,
    selectedNamespace,
    selectedCronJob,
    selectNamespace,
    selectCronJob,
    refresh,
    loading,
    error
  } = useCronJobTopologyData(selectedCluster);
  
  // State management
  
  // Filters state - optimized for CronJob workloads
  const [filters, setFilters] = useState<TopologyFilters>({
    showServices: false, // CronJobs rarely have services
    showEndpoints: false,
    showSecrets: true, // Often used for credentials
    showConfigMaps: true, // Often used for configuration
    showServiceAccount: true, // Important for permissions
    showRBAC: true, // Important for job permissions
    showContainers: true,
    showReplicaSets: false, // CronJobs don't have ReplicaSets
    showPods: true, // Show pods created by jobs
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
    false, // Not a Job
    true  // Is a CronJob
  );
  
  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    handleNodeClickInternal(event, node);
  }, [handleNodeClickInternal]);
  
  // Change layout
  const handleLayoutChange = useCallback((layout: 'horizontal' | 'vertical' | 'radial') => {
    setViewOptions(prev => ({ ...prev, layout }));
  }, []);
  
  // Get CronJob status for display
  const getCronJobStatus = () => {
    if (!topology?.cronjob) return null;
    const cronJob = topology.cronjob;
    
    if (cronJob.suspend) {
      return { text: 'Suspended', variant: 'secondary' as const, color: 'text-orange-600', icon: <Pause className="h-4 w-4" /> };
    } else if (cronJob.active && cronJob.active.length > 0) {
      return { text: 'Active', variant: 'default' as const, color: 'text-green-600', icon: <Play className="h-4 w-4" /> };
    } else {
      return { text: 'Scheduled', variant: 'outline' as const, color: 'text-blue-600', icon: <Clock className="h-4 w-4" /> };
    }
  };
  
  const cronJobStatus = getCronJobStatus();
  
  // Format schedule for display
  const formatSchedule = (schedule: string) => {
    // Parse cron expression and return human-readable format
    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;
    
    // Simple formatting - could be enhanced with a cron parser library
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    if (minute === '0' && hour === '0' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Daily at midnight';
    } else if (minute === '0' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every hour';
    } else if (minute === '*' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every minute';
    }
    
    return schedule; // Return original if no simple pattern matches
  };
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          {/* Ultra Compact Header */}
          <div className="flex items-center justify-between mb-3 px-4 py-2 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">CronJob Topology</span>
            </div>
            <div className="flex items-center gap-1.5">
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
                  
                  {/* CronJob selector */}
                  <Select 
                    value={selectedCronJob} 
                    onValueChange={selectCronJob}
                    disabled={!selectedNamespace || cronjobs.length === 0}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Select CronJob" />
                    </SelectTrigger>
                    <SelectContent>
                      {cronjobs.map(cj => (
                        <SelectItem key={cj.name} value={cj.name}>
                          <div className="flex items-center gap-2">
                            <span>{cj.name}</span>
                            {cj.suspend && (
                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                Suspended
                              </Badge>
                            )}
                            {cj.active > 0 && (
                              <Badge variant="default" className="text-xs h-4 px-1">
                                {cj.active} active
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* CronJob Status and Schedule */}
                  {topology?.cronjob && (
                    <>
                      {cronJobStatus && (
                        <Badge variant={cronJobStatus.variant} className={`${cronJobStatus.color} flex items-center gap-1`}>
                          {cronJobStatus.icon}
                          {cronJobStatus.text}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatSchedule(topology.cronjob.schedule)}
                      </Badge>
                    </>
                  )}
                  
                  {/* Refresh button */}
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={refresh}
                    disabled={loading || !selectedCronJob}
                    title="Refresh topology"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              
              {/* Next Schedule Time */}
              {topology?.cronjob?.nextScheduleTime && (
                <span className="ml-2 text-xs text-muted-foreground">
                  Next: {new Date(topology.cronjob.nextScheduleTime).toLocaleString()}
                </span>
              )}
          </div>

          {/* Compact Error */}
          {error && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-destructive-foreground">{error}</span>
            </div>
          )}

          {/* Main Content Area */}
          {selectedCronJob && topology ? (
            <div className="flex-1 flex gap-4">
              {/* Filters Sidebar */}
              <div className="w-52 flex-shrink-0">
                <TopologySidebar
                filters={filters}
                onFiltersChange={setFilters}
                onLayoutChange={handleLayoutChange}
                currentLayout={viewOptions.layout}
                topologyType="cronjob"
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
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {!selectedCluster 
                    ? "Select a cluster to view CronJobs"
                    : !selectedNamespace 
                    ? "Select a namespace to view CronJobs"
                    : !selectedCronJob
                    ? cronjobs.length === 0 
                      ? "No CronJobs found in this namespace"
                      : "Select a CronJob to view its topology"
                    : "Loading CronJob topology..."}
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

export default CronJobTopologyPage;