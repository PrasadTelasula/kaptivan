import React, { useState, useEffect } from 'react'
import { FileText, Filter } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VirtualLogViewer } from './components/VirtualLogViewer'
import { LogSearch } from './components/LogSearch'
import { LogFilters } from './components/LogFilters'
import { LogDisplaySettings, type DisplaySettings } from './components/LogDisplaySettings'
import ConnectionHealth from './components/ConnectionHealth'
import type { LogFilters as LogFiltersType } from './types/logs'
import { useLogFetcher } from './hooks/useLogFetcher'
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
  } = useLogFetcher(filters)
  
  // Fetch logs on filter change - only when containers are selected
  useEffect(() => {
    if (!isStreaming && filters.clusters.length > 0 && filters.namespaces.length > 0 && filters.pods.length > 0 && filters.containers.length > 0) {
      fetchLogs()
    }
  }, [filters.clusters, filters.namespaces, filters.pods, filters.containers, filters.logLevels])
  
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
    setFilters(prev => ({
      ...prev,
      timeRange: { preset: range as any }
    }))
  }
  
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Page header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Multi-Cluster Logs</h1>
            </div>
            <div className="flex items-center gap-2">
              <LogDisplaySettings
                settings={displaySettings}
                onSettingsChange={setDisplaySettings}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <LogSearch
              onSearch={handleSearch}
              onTimeRangeChange={handleTimeRangeChange}
              onToggleStream={toggleStreaming}
              isStreaming={isStreaming}
              logCount={logs.length}
            />
          </div>
          
          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            {showFilters ? (
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                  <div className="h-full p-4 overflow-auto space-y-4">
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
                      <ConnectionHealth health={connectionHealth} />
                    )}
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={80}>
                  <div className="h-full bg-background">
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
                      <VirtualLogViewer
                        logs={logs}
                        loading={loading}
                        searchTerm={filters.searchTerm}
                        autoScroll={isStreaming}
                        hasSelectedClusters={filters.clusters.length > 0}
                        hasSelectedNamespaces={filters.namespaces.length > 0}
                        hasSelectedPods={filters.pods.length > 0}
                        hasSelectedContainers={filters.containers.length > 0}
                        displaySettings={displaySettings}
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
                <div className="flex-1">
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
                    <VirtualLogViewer
                      logs={logs}
                      loading={loading}
                      searchTerm={filters.searchTerm}
                      autoScroll={isStreaming}
                      hasSelectedClusters={filters.clusters.length > 0}
                      hasSelectedNamespaces={filters.namespaces.length > 0}
                      hasSelectedPods={filters.pods.length > 0}
                      hasSelectedContainers={filters.containers.length > 0}
                      displaySettings={displaySettings}
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