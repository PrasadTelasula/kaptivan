import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useClusterStore } from '@/stores/cluster.store'
import { Loader2, AlertCircle, CheckCircle, Clock, XCircle, HelpCircle, Hexagon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Pod {
  name: string
  namespace: string
  status: string
  ready: string | boolean  // Can be either string (e.g., "2/2") or boolean
  restarts: number
  age: string
  containers: Array<string | {
    name: string
    ready: boolean
    state: string
  }>
  node: string
  ip: string
  uid?: string
  clusterName?: string
  clusterContext?: string
}

interface NamespaceGroup {
  name: string
  pods: Pod[]
  totalPods: number
  healthyPods: number
  warningPods: number
  errorPods: number
}

interface ClusterGroup {
  name: string
  context: string
  namespaces: NamespaceGroup[]
  totalPods: number
}

// Helper function to check if a pod is ready based on the ready string
const isPodReady = (readyString: string | boolean): boolean => {
  // Handle boolean for backward compatibility
  if (typeof readyString === 'boolean') return readyString

  // Handle string format like "2/2", "1/1", etc.
  if (!readyString || typeof readyString !== 'string') return false

  const parts = readyString.split('/')
  if (parts.length !== 2) return false

  const [ready, total] = parts
  return ready === total && ready !== '0'
}

export function ClusterTopology() {
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)

  const [sortBy, setSortBy] = useState<'status' | 'namespace'>('namespace')
  const [groupBy, setGroupBy] = useState<'namespace'>('namespace')
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredPod, setHoveredPod] = useState<Pod | null>(null)
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null)

  useEffect(() => {
    fetchPods()
  }, [selectedContexts])

  const fetchPods = async () => {
    if (selectedClusters.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const allPods: Pod[] = []

      for (const cluster of selectedClusters) {
        const response = await fetch('/api/v1/resources/pods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: cluster.context })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.items) {
            const clusterPods = data.items.map((pod: any, index: number) => {
              // Convert container names array to container objects with status
              const containerList = pod.containers || []
              const containers = Array.isArray(containerList) && typeof containerList[0] === 'string'
                ? containerList.map((name: string) => ({
                    name,
                    ready: isPodReady(pod.ready),  // Use isPodReady helper
                    state: pod.status === 'Running' ? 'running' : 'waiting'
                  }))
                : containerList

              return {
                name: pod.name,
                namespace: pod.namespace,
                status: pod.phase || pod.status,
                ready: pod.ready,  // Keep the original ready value from API (e.g., "2/2", "1/1")
                restarts: pod.restartCount || pod.restarts || 0,
                age: pod.age || 'Unknown',
                containers,
                node: pod.nodeName || pod.node || 'Unknown',
                ip: pod.podIP || pod.ip || '',
                uid: pod.uid || `${cluster.context}-${pod.namespace}-${pod.name}-${index}`,
                clusterName: cluster.name,
                clusterContext: cluster.context
              }
            })
            allPods.push(...clusterPods)
          }
        }
      }

      setPods(allPods)
    } catch (error) {
      console.error('Failed to fetch pods:', error)
    } finally {
      setLoading(false)
    }
  }

  const clusterGroups = useMemo(() => {
    const clusterMap = new Map<string, ClusterGroup>()

    // Group pods by cluster first
    pods.forEach(pod => {
      const clusterKey = pod.clusterContext || 'unknown'
      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, {
          name: pod.clusterName || clusterKey,
          context: clusterKey,
          namespaces: [],
          totalPods: 0
        })
      }
    })

    // For each cluster, group pods by namespace
    clusterMap.forEach((clusterGroup, clusterKey) => {
      const clusterPods = pods.filter(p => (p.clusterContext || 'unknown') === clusterKey)
      const namespaceMap = new Map<string, Pod[]>()

      clusterPods.forEach(pod => {
        const namespace = pod.namespace
        if (!namespaceMap.has(namespace)) {
          namespaceMap.set(namespace, [])
        }
        namespaceMap.get(namespace)!.push(pod)
      })

      const namespaceGroups: NamespaceGroup[] = []
      namespaceMap.forEach((nsPods, namespace) => {
        const healthyPods = nsPods.filter(p =>
          // Healthy: Running and ready OR Completed successfully
          (p.status === 'Running' && isPodReady(p.ready)) ||
          p.status === 'Completed' ||
          p.status === 'Succeeded'
        ).length
        const warningPods = nsPods.filter(p =>
          // Warning: Currently experiencing issues
          p.status === 'Pending' ||
          p.status === 'ContainerCreating' ||
          p.status === 'PodInitializing' ||
          (!isPodReady(p.ready) && p.status === 'Running') // Running but not ready
        ).length
        const errorPods = nsPods.filter(p =>
          // Error: Failed states
          ['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
           'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled',
           'CreateContainerConfigError', 'InvalidImageName', 'CreateContainerError'].includes(p.status)
        ).length

        namespaceGroups.push({
          name: namespace,
          pods: nsPods,
          totalPods: nsPods.length,
          healthyPods,
          warningPods,
          errorPods
        })
      })

      // Sort namespaces within each cluster
      if (sortBy === 'status') {
        namespaceGroups.sort((a, b) => b.errorPods - a.errorPods || b.warningPods - a.warningPods)
      } else {
        namespaceGroups.sort((a, b) => a.name.localeCompare(b.name))
      }

      // Filter namespaces if selection exists
      const filteredGroups = selectedNamespaces.length > 0
        ? namespaceGroups.filter(g => selectedNamespaces.includes(g.name))
        : namespaceGroups

      clusterGroup.namespaces = filteredGroups
      clusterGroup.totalPods = filteredGroups.reduce((sum, ns) => sum + ns.totalPods, 0)
    })

    return Array.from(clusterMap.values()).filter(cluster => cluster.namespaces.length > 0)
  }, [pods, sortBy, selectedNamespaces])

  const getPodColor = (pod: Pod) => {
    // Healthy: Running and ready OR Completed successfully
    if ((pod.status === 'Running' && isPodReady(pod.ready)) ||
        pod.status === 'Completed' ||
        pod.status === 'Succeeded') return 'bg-emerald-500'

    // Warning: Currently experiencing issues
    if (pod.status === 'Pending' ||
        pod.status === 'ContainerCreating' ||
        pod.status === 'PodInitializing' ||
        (!isPodReady(pod.ready) && pod.status === 'Running')) return 'bg-yellow-500'

    // Error: Failed states
    if (['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
         'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled',
         'CreateContainerConfigError', 'InvalidImageName', 'CreateContainerError'].includes(pod.status)) return 'bg-red-500'

    // Default (for any other state)
    return 'bg-gray-500'
  }

  const getPodIcon = (pod: Pod) => {
    // Healthy: Running and ready OR Completed
    if ((pod.status === 'Running' && isPodReady(pod.ready)) ||
        pod.status === 'Completed' ||
        pod.status === 'Succeeded') return <CheckCircle className="h-3 w-3" />

    // Warning states
    if (pod.status === 'Pending' ||
        pod.status === 'ContainerCreating' ||
        pod.status === 'PodInitializing') return <Clock className="h-3 w-3" />
    if (!isPodReady(pod.ready) && pod.status === 'Running') return <AlertCircle className="h-3 w-3" />

    // Error states
    if (['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
         'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled',
         'CreateContainerConfigError', 'InvalidImageName', 'CreateContainerError'].includes(pod.status)) return <XCircle className="h-3 w-3" />

    // Default
    return <HelpCircle className="h-3 w-3" />
  }

  const getWarningReasons = (pods: Pod[]): string[] => {
    const reasons = new Set<string>()
    pods.forEach(pod => {
      if (pod.status === 'Pending') reasons.add('Pods pending scheduling')
      if (pod.status === 'ContainerCreating') reasons.add('Containers being created')
      if (pod.status === 'PodInitializing') reasons.add('Pods initializing')
      if (!isPodReady(pod.ready) && pod.status === 'Running') reasons.add('Pods running but not ready')
    })
    return Array.from(reasons)
  }

  const allNamespaces = useMemo(() => {
    return Array.from(new Set(pods.map(p => p.namespace))).sort()
  }, [pods])

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header with Controls */}
            <div className="border-b p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hexagon className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Cluster Topology</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{pods.length} pods</Badge>
                  <Badge variant="outline">{clusterGroups.length} clusters</Badge>
                  <Badge variant="outline">
                    {clusterGroups.reduce((sum, c) => sum + c.namespaces.length, 0)} namespaces
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort by:</span>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="namespace">Namespace</SelectItem>
                      <SelectItem value="status">Alert Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Group by:</span>
                  <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="namespace">Namespace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Namespaces:</span>
                  <Select
                    value={selectedNamespaces.length === 0 ? "all" : "custom"}
                    onValueChange={(v) => {
                      if (v === "all") setSelectedNamespaces([])
                    }}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {allNamespaces.map(ns => (
                        <SelectItem key={ns} value={ns} onSelect={() => {
                          setSelectedNamespaces(prev =>
                            prev.includes(ns)
                              ? prev.filter(n => n !== ns)
                              : [...prev, ns]
                          )
                        }}>
                          <div className="flex items-center gap-2">
                            {selectedNamespaces.includes(ns) && <CheckCircle className="h-3 w-3" />}
                            {ns}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchPods}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : clusterGroups.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Hexagon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No pods found</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <TooltipProvider>
                    {clusterGroups.map(cluster => (
                      <div key={cluster.context} className="space-y-4">
                        {/* Cluster Header */}
                        <div className="flex items-center gap-3 pb-2 border-b">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary" />
                            <h2 className="text-base font-semibold">{cluster.name}</h2>
                          </div>
                          <Badge variant="secondary">{cluster.totalPods} pods</Badge>
                          <Badge variant="outline">{cluster.namespaces.length} namespaces</Badge>
                        </div>

                        {/* Namespaces within this cluster */}
                        <div className="space-y-4 pl-5">
                          {cluster.namespaces.map(namespace => (
                            <div key={`${cluster.context}-${namespace.name}`} className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-sm">{namespace.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {namespace.totalPods}
                                </Badge>
                                {namespace.errorPods > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {namespace.errorPods} errors
                                  </Badge>
                                )}
                                {namespace.warningPods > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className="bg-yellow-500 text-xs cursor-help">
                                        {namespace.warningPods} warning{namespace.warningPods > 1 ? 's' : ''}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="text-xs space-y-1">
                                        <div className="font-semibold mb-1">Warning reasons:</div>
                                        {getWarningReasons(namespace.pods.filter(p =>
                                          p.status === 'Pending' ||
                                          p.status === 'ContainerCreating' ||
                                          p.status === 'PodInitializing' ||
                                          (!isPodReady(p.ready) && p.status === 'Running')
                                        )).map((reason, idx) => (
                                          <div key={idx} className="flex items-start gap-1">
                                            <span className="text-yellow-500">•</span>
                                            <span>{reason}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>

                              {/* Hexagonal Grid */}
                              <div className="flex flex-wrap gap-1">
                                {namespace.pods.map((pod, index) => (
                                  <Tooltip key={pod.uid || `${cluster.context}-${pod.namespace}-${pod.name}-${index}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "hexagon-wrapper relative",
                                    selectedPod?.name === pod.name && "ring-2 ring-primary"
                                  )}
                                  onClick={() => setSelectedPod(pod)}
                                  onMouseEnter={() => setHoveredPod(pod)}
                                  onMouseLeave={() => setHoveredPod(null)}
                                >
                                  <div className={cn(
                                    "hexagon",
                                    getPodColor(pod),
                                    "cursor-pointer hover:opacity-80 transition-opacity"
                                  )}>
                                    <div className="hexagon-content">
                                      {getPodIcon(pod)}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-sm p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl text-gray-900 dark:text-gray-100"
                              >
                                <div className="space-y-2">
                                  <div className="font-semibold">{pod.name}</div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Status:</span>
                                      <Badge variant={isPodReady(pod.ready) ? "success" : "destructive"} className="ml-1">
                                        {pod.status}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Node:</span>
                                      <span className="ml-1">{pod.node}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Restarts:</span>
                                      <span className="ml-1">{pod.restarts}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Age:</span>
                                      <span className="ml-1">{pod.age}</span>
                                    </div>
                                  </div>
                                  {pod.containers && pod.containers.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <div className="text-xs font-semibold mb-1">Containers ({pod.containers.length}):</div>
                                      {pod.containers.map((container, idx) => {
                                        const containerName = typeof container === 'string' ? container : container.name
                                        const containerState = typeof container === 'string'
                                          ? (isPodReady(pod.ready) ? 'Running' : 'Unknown')
                                          : (container.state || 'Unknown')
                                        const containerReady = typeof container === 'string'
                                          ? isPodReady(pod.ready)
                                          : container.ready

                                        // Determine icon and color based on container state
                                        const getContainerIcon = () => {
                                          // Normalize the state by removing parentheses and converting to lowercase
                                          const normalizedState = containerState.replace(/[()]/g, '').toLowerCase().trim()

                                          if (containerReady || normalizedState === 'running') {
                                            return <CheckCircle className="h-3 w-3 text-green-500" />
                                          }

                                          switch (normalizedState) {
                                            case 'waiting':
                                              return <Clock className="h-3 w-3 text-yellow-500" />
                                            case 'terminated':
                                            case 'completed':
                                              return <CheckCircle className="h-3 w-3 text-blue-500" />
                                            case 'crashloopbackoff':
                                            case 'error':
                                            case 'imagepullbackoff':
                                            case 'errimagepull':
                                              return <XCircle className="h-3 w-3 text-red-500" />
                                            default:
                                              return <HelpCircle className="h-3 w-3 text-gray-500" />
                                          }
                                        }

                                        return (
                                          <div key={`${containerName}-${idx}`} className="flex items-center gap-1 text-xs">
                                            {getContainerIcon()}
                                            <span>{containerName}</span>
                                            {containerState !== 'Running' && containerState !== 'Unknown' && (
                                              <span className="text-muted-foreground">({containerState})</span>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              )}
            </div>

            {/* Selected Pod Details Panel */}
            {selectedPod && (
              <div className="border-t p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Pod Details</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPod(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-mono">{selectedPod.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Namespace:</span>
                    <p>{selectedPod.namespace}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={selectedPod.ready ? "success" : "destructive"}>
                      {selectedPod.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Node:</span>
                    <p>{selectedPod.node}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .hexagon-wrapper {
          width: 40px;
          height: 46px;
          position: relative;
        }

        .hexagon {
          width: 40px;
          height: 23px;
          position: relative;
          margin: 11.5px 0;
        }

        .hexagon:before,
        .hexagon:after {
          content: "";
          position: absolute;
          width: 0;
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
        }

        .hexagon:before {
          bottom: 100%;
          border-bottom: 11.5px solid;
          border-bottom-color: inherit;
        }

        .hexagon:after {
          top: 100%;
          border-top: 11.5px solid;
          border-top-color: inherit;
        }

        .hexagon-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .bg-emerald-500:before,
        .bg-emerald-500:after {
          border-bottom-color: rgb(16 185 129);
          border-top-color: rgb(16 185 129);
        }

        .bg-yellow-500:before,
        .bg-yellow-500:after {
          border-bottom-color: rgb(234 179 8);
          border-top-color: rgb(234 179 8);
        }

        .bg-red-500:before,
        .bg-red-500:after {
          border-bottom-color: rgb(239 68 68);
          border-top-color: rgb(239 68 68);
        }

        .bg-gray-500:before,
        .bg-gray-500:after {
          border-bottom-color: rgb(107 114 128);
          border-top-color: rgb(107 114 128);
        }
      `}</style>
    </div>
  )
}