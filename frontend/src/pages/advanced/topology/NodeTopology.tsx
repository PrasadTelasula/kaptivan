import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useClusterStore } from '@/stores/cluster.store'
import { resourcesService } from '@/services/resources.service'
import { Loader2, AlertCircle, CheckCircle, Clock, XCircle, HelpCircle, Server, Cpu, HardDrive, Container, Box } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodeInfo {
  name: string
  status: string
  roles: string
  age: string
  version: string
  internalIP: string
  os: string
  kernelVersion: string
  containerRuntime: string
  labels: Record<string, string>
  capacity?: {
    cpu?: string
    memory?: string
    pods?: string
  }
  allocatable?: {
    cpu?: string
    memory?: string
    pods?: string
  }
}

interface Pod {
  name: string
  namespace: string
  status: string
  ready: string | boolean
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
}

interface NodeGroup {
  node: NodeInfo
  pods: Pod[]
  totalPods: number
  healthyPods: number
  warningPods: number
  errorPods: number
}

// Helper function to check if a pod is ready
const isPodReady = (readyString: string | boolean): boolean => {
  if (typeof readyString === 'boolean') return readyString
  if (!readyString || typeof readyString !== 'string') return false
  const parts = readyString.split('/')
  if (parts.length !== 2) return false
  const [ready, total] = parts
  return ready === total && ready !== '0'
}

export function NodeTopology() {
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)

  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'pods'>('name')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  useEffect(() => {
    if (selectedClusters.length > 0) {
      fetchData()
    } else {
      setNodes([])
      setPods([])
    }
  }, [selectedContexts])

  const fetchData = async () => {
    setLoading(true)
    try {
      const allNodes: NodeInfo[] = []
      const allPods: Pod[] = []

      for (const cluster of selectedClusters) {
        // Fetch nodes
        try {
          const nodesResponse = await resourcesService.listNodes(cluster.context)
          if (nodesResponse.items) {
            allNodes.push(...nodesResponse.items)
          }
        } catch (error) {
          console.error(`Failed to fetch nodes for ${cluster.name}:`, error)
        }

        // Fetch pods
        const response = await fetch('/api/v1/resources/pods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: cluster.context })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.items) {
            const clusterPods = data.items.map((pod: any) => ({
              name: pod.name,
              namespace: pod.namespace,
              status: pod.status,
              ready: pod.ready,
              restarts: pod.restarts || 0,
              age: pod.age || 'Unknown',
              containers: pod.containers || [],
              node: pod.node || 'Unknown',
              ip: pod.ip || '',
              uid: pod.uid || `${cluster.context}-${pod.namespace}-${pod.name}`
            }))
            allPods.push(...clusterPods)
          }
        }
      }

      setNodes(allNodes)
      setPods(allPods)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const nodeGroups = useMemo(() => {
    const groups: NodeGroup[] = nodes.map(node => {
      const nodePods = pods.filter(pod => pod.node === node.name)

      const healthyPods = nodePods.filter(p =>
        (p.status === 'Running' && isPodReady(p.ready)) ||
        p.status === 'Completed' ||
        p.status === 'Succeeded'
      ).length

      const warningPods = nodePods.filter(p =>
        p.status === 'Pending' ||
        p.status === 'ContainerCreating' ||
        p.status === 'PodInitializing' ||
        (!isPodReady(p.ready) && p.status === 'Running')
      ).length

      const errorPods = nodePods.filter(p =>
        ['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
         'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled'].includes(p.status)
      ).length

      return {
        node,
        pods: nodePods,
        totalPods: nodePods.length,
        healthyPods,
        warningPods,
        errorPods
      }
    })

    // Sort groups
    if (sortBy === 'pods') {
      groups.sort((a, b) => b.totalPods - a.totalPods)
    } else {
      groups.sort((a, b) => a.node.name.localeCompare(b.node.name))
    }

    // Filter by selected node if any
    if (selectedNode) {
      return groups.filter(g => g.node.name === selectedNode)
    }

    return groups
  }, [nodes, pods, sortBy, selectedNode])

  const getPodStatusColor = (pod: Pod) => {
    if ((pod.status === 'Running' && isPodReady(pod.ready)) ||
        pod.status === 'Completed' ||
        pod.status === 'Succeeded') return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'

    if (pod.status === 'Pending' ||
        pod.status === 'ContainerCreating' ||
        pod.status === 'PodInitializing' ||
        (!isPodReady(pod.ready) && pod.status === 'Running')) return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'

    if (['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
         'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled'].includes(pod.status)) return 'border-red-500 bg-red-50 dark:bg-red-950'

    return 'border-gray-500 bg-gray-50 dark:bg-gray-950'
  }

  const getPodIcon = (pod: Pod) => {
    if ((pod.status === 'Running' && isPodReady(pod.ready)) ||
        pod.status === 'Completed' ||
        pod.status === 'Succeeded') return <CheckCircle className="h-3 w-3 text-emerald-500" />

    if (pod.status === 'Pending' ||
        pod.status === 'ContainerCreating' ||
        pod.status === 'PodInitializing') return <Clock className="h-3 w-3 text-yellow-500" />

    if (!isPodReady(pod.ready) && pod.status === 'Running') return <AlertCircle className="h-3 w-3 text-yellow-500" />

    if (['Failed', 'Unknown', 'Terminating', 'CrashLoopBackOff', 'Error',
         'ImagePullBackOff', 'ErrImagePull', 'Evicted', 'OOMKilled'].includes(pod.status)) return <XCircle className="h-3 w-3 text-red-500" />

    return <HelpCircle className="h-3 w-3 text-gray-500" />
  }

  const getContainerColor = (container: string | { name: string; ready: boolean; state: string }, podReady: string | boolean) => {
    if (typeof container === 'string') {
      return isPodReady(podReady) ? 'bg-emerald-500' : 'bg-yellow-500'
    }

    const state = container.state?.toLowerCase() || 'unknown'
    if (state === 'running' || container.ready) return 'bg-emerald-500'
    if (state === 'waiting' || state === 'containercreating') return 'bg-yellow-500'
    if (state === 'terminated' || state === 'completed') return 'bg-blue-500'
    if (state === 'error' || state === 'crashloopbackoff') return 'bg-red-500'
    return 'bg-gray-500'
  }

  const getNodeStatusColor = (status: string) => {
    if (status === 'Ready') return 'text-green-500'
    if (status === 'NotReady') return 'text-red-500'
    return 'text-yellow-500'
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          {/* Controls */}
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Node Topology
                </h1>
                {selectedClusters.length > 0 && (
                  <Badge variant="outline">
                    {selectedClusters.map(c => c.name).join(', ')}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v: 'name' | 'pods') => setSortBy(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="pods">Sort by Pod Count</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedNode || 'all'}
                  onValueChange={(v) => setSelectedNode(v === 'all' ? null : v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Nodes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Nodes</SelectItem>
                    {nodes.map(node => (
                      <SelectItem key={node.name} value={node.name}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={fetchData} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : nodeGroups.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No nodes found</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <TooltipProvider>
                  {nodeGroups.map(group => (
                    <Card key={group.node.name} className="overflow-hidden">
                      <CardHeader className="bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server className={cn("h-5 w-5", getNodeStatusColor(group.node.status))} />
                            <CardTitle className="text-lg">{group.node.name}</CardTitle>
                            <Badge variant={group.node.status === 'Ready' ? 'success' : 'destructive'}>
                              {group.node.status}
                            </Badge>
                            <Badge variant="outline">{group.node.roles}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Cpu className="h-4 w-4" />
                              <span>{group.node.capacity?.cpu || 'N/A'} CPU</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-4 w-4" />
                              <span>{group.node.capacity?.memory || 'N/A'}</span>
                            </div>
                            <Badge variant="secondary">{group.totalPods} pods</Badge>
                            {group.errorPods > 0 && (
                              <Badge variant="destructive">{group.errorPods} errors</Badge>
                            )}
                            {group.warningPods > 0 && (
                              <Badge className="bg-yellow-500">{group.warningPods} warnings</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span>Version: {group.node.version}</span>
                          <span className="mx-2">•</span>
                          <span>OS: {group.node.os}</span>
                          <span className="mx-2">•</span>
                          <span>Runtime: {group.node.containerRuntime}</span>
                          <span className="mx-2">•</span>
                          <span>Age: {group.node.age}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4">
                        {group.pods.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No pods scheduled on this node</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {group.pods.map((pod, idx) => (
                              <div key={pod.uid || idx}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Card className={cn("border-2 cursor-pointer hover:shadow-md transition-shadow", getPodStatusColor(pod))}>
                                      <CardHeader className="p-3">
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                              <Box className="h-3 w-3 flex-shrink-0" />
                                              <h4 className="text-xs font-medium truncate" title={pod.name}>
                                                {pod.name.length > 20 ? `${pod.name.substring(0, 20)}...` : pod.name}
                                              </h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{pod.namespace}</p>
                                          </div>
                                          {getPodIcon(pod)}
                                        </div>
                                      </CardHeader>

                                      {/* Container Hexagons - Show all containers */}
                                      {pod.containers && pod.containers.length > 0 && (
                                        <CardContent className="p-3 pt-0">
                                          <div className="flex flex-wrap gap-1">
                                            {pod.containers.map((container, cidx) => {
                                              const containerName = typeof container === 'string' ? container : container.name
                                              return (
                                                <div key={cidx} className="mini-hexagon-wrapper" title={containerName}>
                                                  <div className={cn("mini-hexagon", getContainerColor(container, pod.ready))}>
                                                    <Container className="h-2 w-2 text-white" />
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </CardContent>
                                      )}
                                    </Card>
                                  </TooltipTrigger>

                                <TooltipContent
                                  side="top"
                                  className="max-w-sm p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
                                >
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm">{pod.name}</div>
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">Namespace:</span> {pod.namespace}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Status:</span>
                                        <Badge variant={isPodReady(pod.ready) ? "success" : "destructive"} className="ml-1 text-xs">
                                          {pod.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Ready:</span>
                                        <span className="ml-1">{pod.ready}</span>
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

                                    {/* Container Details */}
                                    {pod.containers && pod.containers.length > 0 && (
                                      <div className="pt-2 border-t">
                                        <div className="text-xs font-semibold mb-1">
                                          Containers ({pod.containers.length}):
                                        </div>
                                        <div className="space-y-1">
                                          {pod.containers.map((container, cidx) => {
                                            const containerName = typeof container === 'string' ? container : container.name
                                            const containerState = typeof container === 'string'
                                              ? (isPodReady(pod.ready) ? 'Running' : 'Unknown')
                                              : (container.state || 'Unknown')

                                            return (
                                              <div key={`${containerName}-${cidx}`} className="flex items-center gap-2">
                                                <div className={cn(
                                                  "w-2 h-2 rounded-full",
                                                  containerState.toLowerCase() === 'running' ? 'bg-green-500' :
                                                  containerState.toLowerCase() === 'waiting' ? 'bg-yellow-500' :
                                                  containerState.toLowerCase() === 'terminated' ? 'bg-gray-500' :
                                                  'bg-red-500'
                                                )} />
                                                <span className="text-xs">{containerName}</span>
                                                {containerState !== 'Running' && containerState !== 'Unknown' && (
                                                  <span className="text-xs text-muted-foreground">({containerState})</span>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .mini-hexagon-wrapper {
          width: 20px;
          height: 23px;
          position: relative;
        }

        .mini-hexagon {
          width: 20px;
          height: 11.5px;
          position: relative;
          margin: 5.75px 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mini-hexagon:before,
        .mini-hexagon:after {
          content: "";
          position: absolute;
          width: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
        }

        .mini-hexagon:before {
          bottom: 100%;
          border-bottom-width: 5.75px;
          border-bottom-style: solid;
        }

        .mini-hexagon:after {
          top: 100%;
          border-top-width: 5.75px;
          border-top-style: solid;
        }

        .mini-hexagon.bg-emerald-500:before {
          border-bottom-color: rgb(16 185 129);
        }
        .mini-hexagon.bg-emerald-500:after {
          border-top-color: rgb(16 185 129);
        }

        .mini-hexagon.bg-yellow-500:before {
          border-bottom-color: rgb(234 179 8);
        }
        .mini-hexagon.bg-yellow-500:after {
          border-top-color: rgb(234 179 8);
        }

        .mini-hexagon.bg-blue-500:before {
          border-bottom-color: rgb(59 130 246);
        }
        .mini-hexagon.bg-blue-500:after {
          border-top-color: rgb(59 130 246);
        }

        .mini-hexagon.bg-red-500:before {
          border-bottom-color: rgb(239 68 68);
        }
        .mini-hexagon.bg-red-500:after {
          border-top-color: rgb(239 68 68);
        }

        .mini-hexagon.bg-gray-500:before {
          border-bottom-color: rgb(107 114 128);
        }
        .mini-hexagon.bg-gray-500:after {
          border-top-color: rgb(107 114 128);
        }
      `}</style>
    </div>
  )
}