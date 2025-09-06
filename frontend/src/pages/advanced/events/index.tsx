import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { useEventWebSocket, type EventUpdate } from '@/hooks/useEventWebSocket'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { useClusterStore } from '@/stores/cluster.store'
import { 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Search, 
  Filter,
  RefreshCw,
  Layers,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Zap,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface EventInfo {
  name: string
  namespace: string
  type: string
  reason: string
  message: string
  count: number
  firstTimestamp: string
  lastTimestamp: string
  involvedObjectKind: string
  involvedObjectName: string
  source: string
  sourceComponent: string
  sourceHost: string
  age: string
  clusterContext?: string // Add cluster context for multi-cluster support
}

interface EventReason {
  reason: string
  count: number
}

interface ClusterEvents {
  [context: string]: {
    events: EventInfo[]
    reasons: EventReason[]
    loading: boolean
    error: string | null
  }
}

export default function EventsPage() {
  const [clusterEvents, setClusterEvents] = useState<ClusterEvents>({})
  const [aggregatedEvents, setAggregatedEvents] = useState<EventInfo[]>([])
  const [filteredEvents, setFilteredEvents] = useState<EventInfo[]>([])
  const [allReasons, setAllReasons] = useState<EventReason[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedReason, setSelectedReason] = useState<string>('all')
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
  const [selectedObjectKind, setSelectedObjectKind] = useState<string>('all')
  const [selectedClusters, setSelectedClusters] = useState<string[]>([])
  const [multiClusterMode, setMultiClusterMode] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    cluster: true,
    namespace: true,
    type: true,
    reason: true,
    object: true,
    message: true,
    count: true,
    age: true,
    source: false
  })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [allNamespaces, setAllNamespaces] = useState<string[]>([])
  const [useWebSocket, setUseWebSocket] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState(Date.now())

  const { currentContext, clusters } = useClusterStore()
  // Filter out clusters that might not be accessible - memoize to prevent recreating on every render
  const connectedClusters = useMemo(() => {
    // If we have a currentContext, include it as connected
    if (currentContext) {
      const currentCluster = clusters.find(c => c.context === currentContext)
      if (currentCluster) {
        return [currentCluster]
      }
      // If currentContext doesn't match any cluster, create a virtual cluster entry
      return [{ context: currentContext, name: currentContext, status: 'connected' }]
    }
    // Otherwise filter for explicitly connected clusters
    return clusters.filter(c => c.context && c.status === 'connected')
  }, [clusters, currentContext])

  // WebSocket integration for real-time events
  const handleEventUpdate = useCallback((update: EventUpdate) => {
    setClusterEvents(prev => {
      const clusterData = prev[update.cluster] || { events: [], reasons: [], loading: false, error: null }
      let updatedEvents = [...clusterData.events]
      
      switch (update.type) {
        case 'ADDED':
          // Add new event at the beginning
          updatedEvents = [{
            ...update.event,
            clusterContext: update.cluster
          }, ...updatedEvents]
          break
        case 'MODIFIED':
          // Update existing event
          const modIndex = updatedEvents.findIndex(e => e.name === update.event.name && e.namespace === update.event.namespace)
          if (modIndex !== -1) {
            updatedEvents[modIndex] = {
              ...update.event,
              clusterContext: update.cluster
            }
          }
          break
        case 'DELETED':
          // Remove deleted event
          updatedEvents = updatedEvents.filter(e => !(e.name === update.event.name && e.namespace === update.event.namespace))
          break
      }
      
      return {
        ...prev,
        [update.cluster]: {
          ...clusterData,
          events: updatedEvents
        }
      }
    })
  }, [])

  const { connect, disconnect, subscribe, isConnected } = useEventWebSocket({
    onEventUpdate: handleEventUpdate,
    onConnect: () => {
      // Don't send subscription here - let the useEffect handle it to avoid duplicates
    },
    onDisconnect: () => {},
    onError: (error) => console.error('WebSocket error:', error)
  })

  const fetchEventsForCluster = useCallback(async (context: string) => {
    try {
      setClusterEvents(prev => ({
        ...prev,
        [context]: { 
          ...prev[context], 
          loading: true, 
          error: null,
          events: prev[context]?.events || [],
          reasons: prev[context]?.reasons || []
        }
      }))

      const params = new URLSearchParams({
        context,
        namespace: selectedNamespace === 'all' ? '' : selectedNamespace,
        type: selectedType === 'all' ? '' : selectedType,
        reason: selectedReason === 'all' ? '' : selectedReason,
        involvedObjectKind: selectedObjectKind === 'all' ? '' : selectedObjectKind,
        limit: '2000'  // Increased limit to get more recent events
      })

      const [eventsResponse, reasonsResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/v1/events/list?${params}`),
        fetch(`http://localhost:8080/api/v1/events/reasons?context=${context}&namespace=${selectedNamespace === 'all' ? '' : selectedNamespace}`)
      ])

      if (!eventsResponse.ok || !reasonsResponse.ok) {
        throw new Error(`Failed to fetch events from ${context}`)
      }

      const eventsData = await eventsResponse.json()
      const reasonsData = await reasonsResponse.json()

      // Add cluster context to each event with null safety
      const eventsWithCluster = Array.isArray(eventsData?.events) 
        ? eventsData.events.map((event: EventInfo) => ({
            ...event,
            clusterContext: context
          }))
        : []

      setClusterEvents(prev => ({
        ...prev,
        [context]: {
          events: eventsWithCluster,
          reasons: Array.isArray(reasonsData?.reasons) ? reasonsData.reasons : [],
          loading: false,
          error: null
        }
      }))
    } catch (err) {
      setClusterEvents(prev => ({
        ...prev,
        [context]: {
          events: [],
          reasons: [],
          loading: false,
          error: err instanceof Error ? err.message : 'An error occurred'
        }
      }))
    }
  }, [selectedNamespace, selectedType, selectedReason, selectedObjectKind])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (multiClusterMode) {
        // In multi-cluster mode, if we have connected clusters use them,
        // otherwise fallback to current context
        const clusterContexts = connectedClusters.length > 0 
          ? connectedClusters.map(cluster => cluster.context)
          : currentContext ? [currentContext] : []
          
        if (clusterContexts.length > 0) {
          await Promise.all(
            clusterContexts.map(context => fetchEventsForCluster(context))
          )
        }
      } else {
        // Fetch from current cluster only
        if (currentContext) {
          await fetchEventsForCluster(currentContext)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [multiClusterMode, currentContext, fetchEventsForCluster])

  // Fetch all namespaces from the cluster
  const fetchNamespaces = useCallback(async () => {
    if (currentContext) {
      try {
        const response = await fetch(`http://localhost:8080/api/v1/resources/namespaces?context=${currentContext}`)
        if (response.ok) {
          const data = await response.json()
          if (data?.items) {
            const namespaceNames = data.items.map((ns: any) => ns.name).sort()
            setAllNamespaces(namespaceNames)
          }
        }
      } catch (err) {
        console.error('Failed to fetch namespaces:', err)
      }
    }
  }, [currentContext])

  // Fetch namespaces when context changes
  useEffect(() => {
    fetchNamespaces()
  }, [fetchNamespaces])

  // Sync with global cluster selection
  useEffect(() => {
    if (currentContext) {
      // When global context changes, update local selection
      setSelectedClusters(prev => {
        // Only update if the current context is not already selected
        if (!prev.includes(currentContext)) {
          setMultiClusterMode(false)
          return [currentContext]
        }
        return prev
      })
    } else if (selectedClusters.length === 0) {
      // If no global context and no local selection, default to all
      setSelectedClusters(['all'])
      setMultiClusterMode(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContext]) // Only depend on currentContext changes

  // Aggregate events from all clusters
  const aggregatedData = useMemo(() => {
    let allEvents: EventInfo[] = []
    let reasonsMap = new Map<string, number>()

    if (multiClusterMode) {
      // Aggregate from all clusters - with null safety
      Object.values(clusterEvents).forEach(clusterData => {
        if (clusterData?.events && Array.isArray(clusterData.events)) {
          allEvents = [...allEvents, ...clusterData.events]
        }
        if (clusterData?.reasons && Array.isArray(clusterData.reasons)) {
          clusterData.reasons.forEach(reason => {
            if (reason?.reason) {
              reasonsMap.set(reason.reason, (reasonsMap.get(reason.reason) || 0) + (reason.count || 0))
            }
          })
        }
      })
    } else {
      // Show only current cluster - with null safety
      if (currentContext && clusterEvents[currentContext]) {
        const clusterData = clusterEvents[currentContext]
        if (clusterData?.events && Array.isArray(clusterData.events)) {
          allEvents = clusterData.events
        }
        if (clusterData?.reasons && Array.isArray(clusterData.reasons)) {
          clusterData.reasons.forEach(reason => {
            if (reason?.reason) {
              reasonsMap.set(reason.reason, reason.count || 0)
            }
          })
        }
      }
    }

    // Sort events by timestamp (most recent first)
    if (allEvents.length > 0) {
      allEvents.sort((a, b) => {
        // Use lastTimestamp if available, otherwise fall back to firstTimestamp
        const aTimestamp = a?.lastTimestamp || a?.firstTimestamp || new Date(0).toISOString()
        const bTimestamp = b?.lastTimestamp || b?.firstTimestamp || new Date(0).toISOString()
        
        const aTime = new Date(aTimestamp).getTime()
        const bTime = new Date(bTimestamp).getTime()
        
        // Sort by timestamp descending (most recent first)
        if (bTime !== aTime) {
          return bTime - aTime
        }
        
        // If timestamps are equal, sort by count descending (higher count first)
        return (b?.count || 0) - (a?.count || 0)
      })
    }

    // Convert reasons map to array and sort by count
    const reasonsArray = Array.from(reasonsMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return {
      events: allEvents,
      reasons: reasonsArray
    }
  }, [clusterEvents, multiClusterMode, currentContext])

  // Update aggregated states when data changes
  useEffect(() => {
    setAggregatedEvents(aggregatedData.events)
    setAllReasons(aggregatedData.reasons)
  }, [aggregatedData])

  // Apply client-side filtering
  useEffect(() => {
    let filtered = aggregatedEvents

    // Filter by selected clusters
    if (!selectedClusters.includes('all') && selectedClusters.length > 0) {
      filtered = filtered.filter(event => 
        event.clusterContext && selectedClusters.includes(event.clusterContext)
      )
    }

    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.involvedObjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.clusterContext && event.clusterContext.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredEvents(filtered)
  }, [searchTerm, aggregatedEvents, selectedClusters])

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    fetchEvents()
  }, [fetchEvents])

  // Create stable reference for connected clusters
  const connectedClusterContexts = useMemo(
    () => connectedClusters.map(c => c.context), 
    [connectedClusters]
  )

  // Initial load and refresh when mode/cluster changes
  useEffect(() => {
    if (multiClusterMode && connectedClusterContexts.length === 0) {
      // No connected clusters in multi-cluster mode, skip
      return
    }
    
    if (!multiClusterMode && !currentContext) {
      // No current context in single-cluster mode, skip
      return
    }

    const timeoutId = setTimeout(() => {
      fetchEvents()
    }, 100) // Small delay to prevent immediate re-renders
    
    return () => clearTimeout(timeoutId)
  }, [fetchEvents, multiClusterMode, currentContext, connectedClusterContexts.length])

  // Auto-refresh interval with stable dependencies
  useEffect(() => {
    if (!autoRefresh || useWebSocket) return // Don't auto-refresh if using WebSocket

    const interval = setInterval(() => {
      fetchEvents()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchEvents, useWebSocket])

  // Update current time every second for age calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // WebSocket connection management - only connect/disconnect when useWebSocket changes
  useEffect(() => {
    if (useWebSocket) {
      connect()
      return () => {
        disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebSocket]) // Only depend on useWebSocket toggle, functions are stable

  // Create a stable subscription object to prevent unnecessary re-subscriptions
  const subscriptionConfig = useMemo(() => {
    if (!useWebSocket || !isConnected) return null
    
    // Build clusters list - always ensure we have at least one cluster
    let clustersToUse: string[] = []
    
    if (selectedClusters.includes('all')) {
      // Use all connected clusters
      clustersToUse = connectedClusterContexts.length > 0 
        ? connectedClusterContexts 
        : currentContext ? [currentContext] : []
    } else if (selectedClusters.length > 0) {
      // Use selected clusters
      clustersToUse = selectedClusters
    } else if (currentContext) {
      // Fallback to current context
      clustersToUse = [currentContext]
    }
    
    // Only return subscription if we have clusters
    if (clustersToUse.length > 0) {
      return {
        clusters: clustersToUse,
        namespaces: selectedNamespace === 'all' ? ['all'] : [selectedNamespace],
        types: selectedType === 'all' ? [] : [selectedType],
        reasons: selectedReason === 'all' ? [] : [selectedReason]
      }
    }
    
    return null
  }, [useWebSocket, isConnected, selectedClusters, selectedNamespace, selectedType, selectedReason, connectedClusterContexts, currentContext])

  // Subscribe/re-subscribe when subscription config changes
  useEffect(() => {
    if (subscriptionConfig) {
      subscribe(subscriptionConfig)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionConfig]) // subscribe is stable, subscriptionConfig is memoized

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'Warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'Normal':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const toggleMessageExpansion = (eventKey: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventKey)) {
        newSet.delete(eventKey)
      } else {
        newSet.add(eventKey)
      }
      return newSet
    })
  }

  const calculateAge = (timestamp: string) => {
    const eventTime = new Date(timestamp).getTime()
    const diff = currentTime - eventTime
    
    if (diff < 0) return '0s' // Future events show as 0s
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days}d`
    } else if (hours > 0) {
      return `${hours}h`
    } else if (minutes > 0) {
      return `${minutes}m`
    } else {
      return `${seconds}s`
    }
  }

  const getEventTypeBadge = (type: string) => {
    const variant = type === 'Warning' ? 'destructive' : 'secondary'
    return (
      <Badge variant={variant} className="text-xs">
        {type}
      </Badge>
    )
  }

  const getClusterBadge = (context: string) => {
    const cluster = clusters.find(c => c.context === context)
    return (
      <Badge variant="outline" className="text-xs">
        {cluster?.name || context}
      </Badge>
    )
  }

  // Use all namespaces from the cluster, not just ones with events
  const uniqueNamespaces = useMemo(() => 
    allNamespaces.length > 0 ? allNamespaces : 
    Array.from(new Set(aggregatedEvents.map(e => e?.namespace).filter(Boolean))).sort(),
    [allNamespaces, aggregatedEvents]
  )
  
  const uniqueObjectKinds = useMemo(() => 
    Array.from(new Set(aggregatedEvents.map(e => e?.involvedObjectKind).filter(Boolean))).sort(),
    [aggregatedEvents]
  )
  
  // Show all available clusters, not just ones with events
  const uniqueClusters = useMemo(() => 
    clusters.map(c => c.context).filter(Boolean).sort(),
    [clusters]
  )

  const uniqueTypes = useMemo(() => 
    Array.from(new Set(aggregatedEvents.map(e => e?.type).filter(Boolean))).sort(),
    [aggregatedEvents]
  )

  const eventsByType = useMemo(() => ({
    normal: filteredEvents.filter(e => e.type === 'Normal'),
    warning: filteredEvents.filter(e => e.type === 'Warning')
  }), [filteredEvents])

  const hasErrors = Object.values(clusterEvents).some(cluster => cluster.error)
  const isLoading = loading || Object.values(clusterEvents).some(cluster => cluster.loading)

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r" />
        <div className="flex flex-1 overflow-hidden">
          {/* Events Sidebar */}
          {sidebarVisible && (
            <div className="w-80 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 overflow-y-auto">
              <div className="p-4 space-y-6">
                {/* Stats Cards */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Event Metrics</h3>
                  <div className="grid gap-3">
                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Events</p>
                            <p className="text-lg font-bold">{aggregatedEvents.length}</p>
                          </div>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Normal Events</p>
                            <p className="text-lg font-bold text-green-600">{eventsByType.normal.length}</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Warning Events</p>
                            <p className="text-lg font-bold text-yellow-600">{eventsByType.warning.length}</p>
                          </div>
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="p-3">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Unique Reasons</p>
                            <p className="text-lg font-bold">{allReasons.length}</p>
                          </div>
                          <Layers className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Top Event Reasons */}
                {allReasons.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-muted-foreground">Top Event Reasons</h3>
                      <Badge variant="outline" className="text-xs">
                        {allReasons.length} total
                      </Badge>
                    </div>
                    <Card className="p-3">
                      <CardContent className="p-0 space-y-2">
                        {allReasons.slice(0, 10).map((reason) => (
                          <Button
                            key={reason.reason}
                            variant={selectedReason === reason.reason ? "default" : "ghost"}
                            size="sm"
                            className="w-full justify-between h-8 px-2 text-xs hover:bg-accent"
                            onClick={() => setSelectedReason(
                              selectedReason === reason.reason ? 'all' : reason.reason
                            )}
                          >
                            <span className="truncate mr-2 text-left">{reason.reason}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] ml-auto">
                              {reason.count}
                            </Badge>
                          </Button>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}

          <main className="flex-1 overflow-auto">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 lg:p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSidebarVisible(!sidebarVisible)}
                      className="h-9 w-9 p-0"
                    >
                      {sidebarVisible ? (
                        <PanelLeftClose className="h-4 w-4" />
                      ) : (
                        <PanelLeftOpen className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">Cluster Events</h2>
                      <p className="text-muted-foreground text-sm lg:text-base">
                        Monitor and analyze events across {multiClusterMode ? 'multiple clusters' : 'your cluster'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:gap-2 lg:gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="multi-cluster"
                        checked={multiClusterMode}
                        onCheckedChange={setMultiClusterMode}
                      />
                      <Label htmlFor="multi-cluster" className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">Multi-cluster</span>
                        <span className="sm:hidden">Multi</span>
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isLoading}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                      Refresh
                    </Button>
                    <Select
                      value={autoRefresh ? refreshInterval.toString() : 'off'}
                      onValueChange={(value) => {
                        if (value === 'off') {
                          setAutoRefresh(false)
                        } else {
                          setAutoRefresh(true)
                          setRefreshInterval(parseInt(value))
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue placeholder="Auto-refresh" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">Auto-refresh off</SelectItem>
                        <SelectItem value="10">Every 10s</SelectItem>
                        <SelectItem value="30">Every 30s</SelectItem>
                        <SelectItem value="60">Every 1m</SelectItem>
                        <SelectItem value="300">Every 5m</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2 border rounded-md px-3 py-1">
                      <Switch
                        id="websocket-mode"
                        checked={useWebSocket}
                        onCheckedChange={(checked) => {
                          setUseWebSocket(checked)
                          if (checked) {
                            setAutoRefresh(false) // Disable auto-refresh when WebSocket is enabled
                          }
                        }}
                      />
                      <Label htmlFor="websocket-mode" className="text-sm cursor-pointer">
                        <span className="flex items-center gap-1">
                          <Zap className={cn("h-3 w-3", isConnected && "text-green-500")} />
                          Real-time
                          {isConnected && <span className="text-xs text-green-500">(connected)</span>}
                        </span>
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Events Table */}
              <div className="flex-1 p-4 lg:p-6">
                <Card className="h-full flex flex-col overflow-hidden">
                  <CardHeader className="shrink-0 pb-3">
                    <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                      <CardTitle className="text-base">Event Stream ({filteredEvents.length})</CardTitle>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-[200px] h-9"
                      />
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[180px] h-9 justify-between">
                          <span className="truncate">
                            {selectedClusters.includes('all') 
                              ? 'All clusters' 
                              : selectedClusters.length === 0
                              ? currentContext 
                                ? clusters.find(c => c.context === currentContext)?.name || currentContext
                                : 'Select clusters'
                              : selectedClusters.length === 1
                              ? clusters.find(c => c.context === selectedClusters[0])?.name || selectedClusters[0]
                              : `${selectedClusters.length} clusters`}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px]">
                          <DropdownMenuCheckboxItem
                            checked={selectedClusters.includes('all')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedClusters(['all'])
                                setMultiClusterMode(true)
                              } else {
                                setSelectedClusters([])
                              }
                            }}
                          >
                            All clusters
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {uniqueClusters.map(context => {
                            const cluster = clusters.find(c => c.context === context)
                            const isAllSelected = selectedClusters.includes('all')
                            return (
                              <DropdownMenuCheckboxItem
                                key={context}
                                checked={isAllSelected || selectedClusters.includes(context)}
                                onCheckedChange={(checked) => {
                                  // If 'all' is selected, first deselect it
                                  if (isAllSelected) {
                                    setSelectedClusters(checked ? [context] : [])
                                    setMultiClusterMode(false)
                                  } else {
                                    if (checked) {
                                      const newSelection = [...selectedClusters, context]
                                      // If all clusters are now selected, switch to 'all'
                                      if (newSelection.length === uniqueClusters.length) {
                                        setSelectedClusters(['all'])
                                        setMultiClusterMode(true)
                                      } else {
                                        setSelectedClusters(newSelection)
                                        setMultiClusterMode(newSelection.length > 1)
                                      }
                                    } else {
                                      const newSelection = selectedClusters.filter(c => c !== context)
                                      setSelectedClusters(newSelection)
                                      setMultiClusterMode(newSelection.length > 1 || newSelection.includes('all'))
                                    }
                                  }
                                }}
                              >
                                {cluster?.name || context}
                              </DropdownMenuCheckboxItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                    <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All namespaces" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All namespaces</SelectItem>
                        {uniqueNamespaces.map(ns => (
                          <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="w-[100px] h-9">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {uniqueTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedObjectKind} onValueChange={setSelectedObjectKind}>
                      <SelectTrigger className="w-[120px] h-9">
                        <SelectValue placeholder="All kinds" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All kinds</SelectItem>
                        {uniqueObjectKinds.map(kind => (
                          <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                          <Filter className="h-4 w-4 mr-1" />
                          Columns
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(visibleColumns).map(([key, value]) => (
                          <DropdownMenuCheckboxItem
                            key={key}
                            checked={value}
                            onCheckedChange={(checked) =>
                              setVisibleColumns(prev => ({ ...prev, [key]: checked }))
                            }
                          >
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                {error || hasErrors ? (
                  <div className="flex items-center justify-center py-8 text-red-500">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {error || 'Failed to load events from some clusters'}
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2" />
                    <p>No events found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full w-full">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          {visibleColumns.cluster && multiClusterMode && <TableHead className="min-w-[100px]">Cluster</TableHead>}
                          {visibleColumns.namespace && <TableHead className="min-w-[100px]">Namespace</TableHead>}
                          {visibleColumns.type && <TableHead className="min-w-[80px]">Type</TableHead>}
                          {visibleColumns.reason && <TableHead className="min-w-[120px]">Reason</TableHead>}
                          {visibleColumns.object && <TableHead className="min-w-[150px]">Object</TableHead>}
                          {visibleColumns.message && <TableHead className="min-w-[200px]">Message</TableHead>}
                          {visibleColumns.count && <TableHead className="min-w-[70px] text-center">Count</TableHead>}
                          {visibleColumns.age && <TableHead className="min-w-[70px]">Age</TableHead>}
                          {visibleColumns.source && <TableHead className="min-w-[120px] hidden xl:table-cell">Source</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.map((event, index) => (
                          <TableRow key={`${event.clusterContext}-${event.name}-${index}`}>
                            <TableCell>{getEventIcon(event.type)}</TableCell>
                            {visibleColumns.cluster && multiClusterMode && (
                              <TableCell>
                                {event.clusterContext ? getClusterBadge(event.clusterContext) : '-'}
                              </TableCell>
                            )}
                            {visibleColumns.namespace && (
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {event.namespace}
                                </Badge>
                              </TableCell>
                            )}
                            {visibleColumns.type && (
                              <TableCell>{getEventTypeBadge(event.type)}</TableCell>
                            )}
                            {visibleColumns.reason && (
                              <TableCell className="font-medium">{event.reason}</TableCell>
                            )}
                            {visibleColumns.object && (
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground">
                                    {event.involvedObjectKind}
                                  </span>
                                  <span className="font-medium">{event.involvedObjectName}</span>
                                </div>
                              </TableCell>
                            )}
                            {visibleColumns.message && (
                              <TableCell className="max-w-[200px] lg:max-w-[400px] xl:max-w-[600px]">
                                {(() => {
                                  const eventKey = `${event.clusterContext}-${event.namespace}-${event.name}`
                                  const isExpanded = expandedMessages.has(eventKey)
                                  const needsExpansion = event.message.length > 100
                                  
                                  return (
                                    <div className="text-sm">
                                      <p className={cn(
                                        "break-words",
                                        !isExpanded && needsExpansion && "line-clamp-2"
                                      )}>
                                        {event.message}
                                      </p>
                                      {needsExpansion && (
                                        <button
                                          onClick={() => toggleMessageExpansion(eventKey)}
                                          className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                                        >
                                          {isExpanded ? 'Show less' : 'Show more'}
                                        </button>
                                      )}
                                    </div>
                                  )
                                })()}
                              </TableCell>
                            )}
                            {visibleColumns.count && (
                              <TableCell className="text-center">
                                {event.count > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.count}
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                            {visibleColumns.age && (
                              <TableCell className="text-muted-foreground text-sm">
                                <span title={new Date(event.lastTimestamp).toLocaleString()}>
                                  {calculateAge(event.lastTimestamp)}
                                </span>
                              </TableCell>
                            )}
                            {visibleColumns.source && (
                              <TableCell className="text-xs text-muted-foreground hidden xl:table-cell">
                                {event.source}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}