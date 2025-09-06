import React, { useState, useEffect } from 'react'
import { FileText, Filter, Info } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { cn } from '@/utils/cn'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VirtualizedLogViewer } from './components/VirtualizedLogViewer'
import { LogSearch } from './components/LogSearch'
import { LogFiltersMinimal as LogFilters } from './components/LogFiltersMinimal'
import { LogDisplaySettings, type DisplaySettings } from './components/LogDisplaySettings'
import { AdvancedSearchUI } from './components/AdvancedSearchUI'
import { CompactSearchBar } from './components/CompactSearchBar'
import ConnectionHealth from './components/ConnectionHealth'
import { TimeRangeSelector } from './components/TimeRangeSelector'
import type { LogFilters as LogFiltersType } from './types/logs'
import { useLogFetcherOptimized } from './hooks/useLogFetcherOptimized'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { resourcesService } from '@/services/resources.service'

const LogsPage: React.FC = () => {
  const { clusters, selectedContexts } = useClusterStore()
  const connectedClusters = clusters.filter(c => c.connected)
  
  const [showFilters, setShowFilters] = useState(true)
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    showCluster: true,
    showPod: true,
    showContainer: true,
    showTimestamp: true,
    showLevel: true,
    showLineNumbers: false,
  })
  const [filters, setFilters] = useState<LogFiltersType>({
    clusters: selectedContexts || [],
    namespaces: [],
    pods: [],
    containers: [],
    logLevels: ['ERROR', 'WARN', 'INFO'],
    searchTerm: '',
    timeRange: {
      preset: 'last15m'
    },
    autoRefresh: false,
    refreshInterval: 30
  })
  
  // Real data from clusters
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([])
  const [availablePods, setAvailablePods] = useState<string[]>([])
  const [availableContainers, setAvailableContainers] = useState<string[]>([])
  const [podDetails, setPodDetails] = useState<Map<string, string[]>>(new Map()) // Map pod name to containers
  const [loadingNamespaces, setLoadingNamespaces] = useState(false)
  const [loadingPods, setLoadingPods] = useState(false)
  const [loadingContainers, setLoadingContainers] = useState(false)
  
  // Fetch namespaces when clusters change
  useEffect(() => {
    const fetchNamespaces = async () => {
      if (filters.clusters.length === 0) {
        setAvailableNamespaces([])
        return
      }
      
      setLoadingNamespaces(true)
      try {
        const allNamespaces = new Set<string>()
        
        for (const cluster of filters.clusters) {
          try {
            const response = await resourcesService.listNamespaces(cluster)
            response.items.forEach(ns => allNamespaces.add(ns.name))
          } catch (error) {
            console.error(`Failed to fetch namespaces from ${cluster}:`, error)
          }
        }
        
        setAvailableNamespaces(Array.from(allNamespaces).sort())
      } catch (error) {
        console.error('Failed to fetch namespaces:', error)
      } finally {
        setLoadingNamespaces(false)
      }
    }
    
    fetchNamespaces()
  }, [filters.clusters])
  
  // Fetch pods when namespaces change
  useEffect(() => {
    const fetchPods = async () => {
      if (filters.clusters.length === 0 || filters.namespaces.length === 0) {
        setAvailablePods([])
        setPodDetails(new Map())
        return
      }
      
      setLoadingPods(true)
      try {
        const allPods = new Set<string>()
        const newPodDetails = new Map<string, string[]>()
        
        for (const cluster of filters.clusters) {
          for (const namespace of filters.namespaces) {
            try {
              const response = await resourcesService.listPods({ context: cluster, namespace })
              response.items.forEach(pod => {
                allPods.add(pod.name)
                // Store containers for each pod
                if (pod.containers && pod.containers.length > 0) {
                  newPodDetails.set(pod.name, pod.containers)
                }
              })
            } catch (error) {
              console.error(`Failed to fetch pods from ${cluster}/${namespace}:`, error)
            }
          }
        }
        
        setAvailablePods(Array.from(allPods).sort())
        setPodDetails(newPodDetails)
      } catch (error) {
        console.error('Failed to fetch pods:', error)
      } finally {
        setLoadingPods(false)
      }
    }
    
    fetchPods()
  }, [filters.clusters, filters.namespaces])
  
  // Update available containers when pods change
  useEffect(() => {
    if (filters.pods.length === 0) {
      setAvailableContainers([])
      return
    }
    
    setLoadingContainers(true)
    try {
      const allContainers = new Set<string>()
      
      // Get containers from selected pods
      filters.pods.forEach(podName => {
        const containers = podDetails.get(podName)
        if (containers) {
          containers.forEach(container => allContainers.add(container))
        }
      })
      
      setAvailableContainers(Array.from(allContainers).sort())
    } finally {
      setLoadingContainers(false)
    }
  }, [filters.pods, podDetails])
  
  const {
    logs,
    loading,
    error,
    isStreaming,
    connectionHealth,
    fetchLogs,
    searchLogs,
    toggleStreaming,
    bufferInfo,
    totalLogsReceived,
    getMetrics,
  } = useLogFetcherOptimized(filters)
  
  // Fetch logs on filter change - only when containers are selected
  useEffect(() => {
    if (!isStreaming && filters.clusters.length > 0 && filters.namespaces.length > 0 && filters.pods.length > 0 && filters.containers.length > 0) {
      fetchLogs()
    }
  }, [filters.clusters, filters.namespaces, filters.pods, filters.containers, filters.logLevels, filters.timeRange.preset])
  
  const handleSearch = (query: string) => {
    setFilters(prev => ({ ...prev, searchTerm: query }))
    // Only search/fetch if containers are selected
    if (filters.containers.length > 0) {
      if (query) {
        searchLogs(query)
      } else {
        fetchLogs()
      }
    }
  }
  
  const handleTimeRangeChange = (range: string) => {
    console.log('Time range changed in main component:', range)
    setFilters(prev => ({
      ...prev,
      timeRange: { preset: range as any }
    }))
    // Trigger log fetch if we have all required filters
    if (filters.clusters.length > 0 && filters.namespaces.length > 0 && 
        filters.pods.length > 0 && filters.containers.length > 0) {
      console.log('Fetching logs with new time range:', range)
      fetchLogs()
    }
  }
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Compact header with integrated controls */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-medium">Multi-Cluster Logs</h1>
              {/* Rendering stats will be injected here by VirtualizedLogViewer */}
              <div id="rendering-stats-container" />
            </div>
            <div className="flex items-center gap-2">
              <TimeRangeSelector
                value={filters.timeRange.preset || 'last15m'}
                onChange={handleTimeRangeChange}
                className="h-8"
              />
              <LogDisplaySettings
                settings={displaySettings}
                onSettingsChange={setDisplaySettings}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 px-2"
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="ml-1 text-xs">{showFilters ? 'Hide' : 'Show'}</span>
              </Button>
            </div>
          </div>
          
          {/* Compact search bar and controls */}
          <div className="px-3 py-2 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CompactSearchBar
                value={filters.searchTerm}
                onChange={(value) => setFilters(prev => ({ ...prev, searchTerm: value }))}
                onSearch={() => handleSearch(filters.searchTerm)}
                onClear={() => {
                  setFilters(prev => ({ ...prev, searchTerm: '' }))
                  fetchLogs()
                }}
                metrics={{
                  cacheHitRate: 75,
                  avgLatency: 45,
                  indexedLogs: logs.length
                }}
                isLoading={loading}
                logLevels={['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']}
                selectedLogLevels={filters.logLevels}
                onLogLevelToggle={(level) => {
                  const newLevels = filters.logLevels.includes(level)
                    ? filters.logLevels.filter(l => l !== level)
                    : [...filters.logLevels, level]
                  setFilters(prev => ({ ...prev, logLevels: newLevels }))
                }}
                totalLogs={totalLogsReceived}
                className="flex-1"
              />
              
              {/* Buffer info display */}
              {bufferInfo && (
                <div className="flex items-center gap-2 px-3 py-1 bg-background/60 backdrop-blur-sm rounded-md border">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Buffer:</span>
                    <span className={cn(
                      "text-xs font-medium",
                      bufferInfo.isAtCapacity ? "text-yellow-500" : "text-foreground"
                    )}>
                      {bufferInfo.size.toLocaleString()} / {bufferInfo.capacity.toLocaleString()}
                    </span>
                  </div>
                  {bufferInfo.isAtCapacity && (
                    <div className="flex items-center">
                      <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" />
                    </div>
                  )}
                  <div className="relative h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                        bufferInfo.isAtCapacity ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${(bufferInfo.size / bufferInfo.capacity) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Streaming button */}
              {filters.clusters.length > 0 && filters.namespaces.length > 0 && 
               filters.pods.length > 0 && filters.containers.length > 0 && (
                <Button
                  variant={isStreaming ? "destructive" : "default"}
                  size="sm"
                  onClick={toggleStreaming}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  {isStreaming ? (
                    <>
                      <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                      Stop Streaming
                    </>
                  ) : (
                    <>
                      <div className="h-1.5 w-1.5 bg-white rounded-full" />
                      Start Streaming
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            {showFilters ? (
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={15} minSize={10} maxSize={20}>
                  <div className="h-full border-r bg-muted/5">
                    <LogFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                      availableClusters={connectedClusters.map(c => c.context)}
                      availableNamespaces={availableNamespaces}
                      availablePods={availablePods}
                      availableContainers={availableContainers}
                      loadingNamespaces={loadingNamespaces}
                      loadingPods={loadingPods}
                      loadingContainers={loadingContainers}
                    />
                    {isStreaming && showFilters && (
                      <div className="px-4 pb-4">
                        <ConnectionHealth health={connectionHealth} />
                      </div>
                    )}
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={85}>
                  <div className="h-full bg-background overflow-hidden">
                    {error ? (
                      <div className="flex items-center justify-center h-full">
                        <Card className="p-6 max-w-md">
                          <p className="text-destructive font-semibold">Error loading logs</p>
                          <p className="text-sm text-muted-foreground mt-2">{error}</p>
                          <Button onClick={fetchLogs} className="mt-4">
                            Retry
                          </Button>
                        </Card>
                      </div>
                    ) : (
                      <VirtualizedLogViewer
                        logs={logs}
                        loading={loading}
                        searchTerm={filters.searchTerm}
                        autoScroll={isStreaming}
                        hasSelectedClusters={filters.clusters.length > 0}
                        hasSelectedNamespaces={filters.namespaces.length > 0}
                        hasSelectedPods={filters.pods.length > 0}
                        hasSelectedContainers={filters.containers.length > 0}
                        displaySettings={displaySettings}
                        bufferInfo={bufferInfo}
                        totalLogsReceived={totalLogsReceived}
                        className="h-full"
                      />
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <div className="h-full bg-background flex flex-col">
                {isStreaming && (
                  <div className="p-4 border-b">
                    <ConnectionHealth health={connectionHealth} />
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  {error ? (
                    <div className="flex items-center justify-center h-full">
                      <Card className="p-6 max-w-md">
                        <p className="text-destructive font-semibold">Error loading logs</p>
                        <p className="text-sm text-muted-foreground mt-2">{error}</p>
                        <Button onClick={fetchLogs} className="mt-4">
                          Retry
                        </Button>
                      </Card>
                    </div>
                  ) : (
                    <VirtualizedLogViewer
                      logs={logs}
                      loading={loading}
                      searchTerm={filters.searchTerm}
                      autoScroll={isStreaming}
                      hasSelectedClusters={filters.clusters.length > 0}
                      hasSelectedNamespaces={filters.namespaces.length > 0}
                      hasSelectedPods={filters.pods.length > 0}
                      hasSelectedContainers={filters.containers.length > 0}
                      displaySettings={displaySettings}
                      bufferInfo={bufferInfo}
                      totalLogsReceived={totalLogsReceived}
                      className="h-full"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default LogsPage