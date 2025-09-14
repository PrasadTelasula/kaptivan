import { useState, useEffect, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useClusterStore } from '@/stores/cluster.store'
import { resourcesService } from '@/services/resources.service'
import {
  Loader2, AlertCircle, CheckCircle, Clock, XCircle, HelpCircle,
  Server, Cpu, HardDrive, Container, Box, MoreVertical,
  ScrollText, FileCode, Terminal, Activity, FileText, Network, Globe,
  Wifi, WifiOff, LayoutGrid, Grid3x3, Thermometer, TableIcon, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Import existing window components
import { LogsWindow } from './components/windows/LogsWindow'
import { YamlWindow } from './components/windows/YamlWindow'
import { ShellWindow } from './components/windows/ShellWindow'
import { DescribeWindow } from './components/windows/DescribeWindow'
import PodInfoWindow from './components/windows/PodInfoWindow'

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
    cpu: string
    memory: string
    pods: string
  }
  allocatable?: {
    cpu: string
    memory: string
    pods: string
  }
}

interface Pod {
  name: string
  namespace: string
  status: string
  ready: string | boolean
  restarts: number
  age: string
  cpu?: string
  memory?: string
  containers: Array<string | {
    name: string
    ready: boolean
    state: string
    ports?: Array<{
      name?: string
      containerPort: number
      protocol?: string
    }>
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

interface EventsWindowProps {
  resourceType: 'pod' | 'node'
  resourceName: string
  namespace?: string
  context: string
  onClose: () => void
}

// Simple Events Window Component
const EventsWindow: React.FC<EventsWindowProps> = ({
  resourceType,
  resourceName,
  namespace,
  context,
  onClose
}) => {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      // For now, just create some sample events since the backend doesn't have a proper events endpoint
      // In a real implementation, this would fetch from the Kubernetes API
      const sampleEvents = [
        {
          type: 'Normal',
          reason: 'Scheduled',
          message: `Successfully assigned ${namespace}/${resourceName} to node`,
          firstTimestamp: new Date(Date.now() - 3600000).toISOString(),
          lastTimestamp: new Date(Date.now() - 3600000).toISOString(),
          count: 1
        },
        {
          type: 'Normal',
          reason: 'Pulled',
          message: 'Container image already present on machine',
          firstTimestamp: new Date(Date.now() - 3500000).toISOString(),
          lastTimestamp: new Date(Date.now() - 3500000).toISOString(),
          count: 1
        },
        {
          type: 'Normal',
          reason: 'Created',
          message: 'Created container',
          firstTimestamp: new Date(Date.now() - 3400000).toISOString(),
          lastTimestamp: new Date(Date.now() - 3400000).toISOString(),
          count: 1
        },
        {
          type: 'Normal',
          reason: 'Started',
          message: 'Started container',
          firstTimestamp: new Date(Date.now() - 3300000).toISOString(),
          lastTimestamp: new Date(Date.now() - 3300000).toISOString(),
          count: 1
        }
      ]
      setEvents(sampleEvents)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Events - {resourceName}
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground">No events found</p>
          ) : (
            <div className="space-y-2">
              {events.map((event, idx) => (
                <div key={idx} className="border rounded p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={event.type === 'Warning' ? 'destructive' : 'default'}>
                          {event.type}
                        </Badge>
                        <span className="font-medium">{event.reason}</span>
                      </div>
                      <p className="text-muted-foreground">{event.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.count} times, last seen {event.lastTimestamp}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to format memory from Ki to GB
const formatMemory = (memoryKi?: string): string => {
  if (!memoryKi) return 'N/A'
  // Convert from Ki to GB
  const match = memoryKi.match(/^(\d+)/)
  if (!match) return memoryKi
  const kiBytes = parseInt(match[1])
  const gb = (kiBytes / (1024 * 1024)).toFixed(1)
  return `${gb}GB`
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

export function NodeTopologyEnhanced() {
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)
  const currentContext = selectedClusters[0]?.context || ''

  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'pods' | 'cpu' | 'memory'>('name')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'compact' | 'heatmap' | 'table'>('card')
  const [showScaleSuggestion, setShowScaleSuggestion] = useState(false)
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false)

  // WebSocket state
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Window states
  const [activeWindows, setActiveWindows] = useState<{
    logs?: Array<{ id: string; pod: string; namespace: string; container?: string }>
    yamls?: Array<{ id: string; type: 'pod' | 'node'; name: string; namespace?: string }>
    shells?: Array<{ id: string; pod: string; namespace: string; container: string }>
    events?: Array<{ id: string; type: 'pod' | 'node'; name: string; namespace?: string }>
    describes?: Array<{ id: string; type: 'pod' | 'node'; name: string; namespace?: string }>
    podInfo?: Pod
  }>({})

  // Container selection dialog state
  const [containerSelection, setContainerSelection] = useState<{
    pod: Pod | null
    selectedContainers: string[]
  }>({
    pod: null,
    selectedContainers: []
  })

  useEffect(() => {
    if (selectedClusters.length > 0) {
      fetchData()
    } else {
      setNodes([])
      setPods([])
    }
  }, [selectedContexts])

  // Adaptive UI based on cluster size
  useEffect(() => {
    if (!dismissedSuggestion && !loading) {
      const totalPods = pods.length
      const totalNodes = nodes.length

      // Check if we should suggest a different view mode
      if (viewMode === 'card') {
        if (totalPods > 100 || totalNodes > 10) {
          setShowScaleSuggestion(true)
        } else {
          setShowScaleSuggestion(false)
        }
      } else {
        setShowScaleSuggestion(false)
      }
    }
  }, [pods.length, nodes.length, viewMode, dismissedSuggestion, loading])

  // WebSocket connection management
  useEffect(() => {
    if (!currentContext) {
      if (wsConnection) {
        wsConnection.close()
        setWsConnection(null)
        setWsStatus('disconnected')
      }
      return
    }

    connectWebSocket()

    // Cleanup on unmount or context change
    return () => {
      if (wsConnection) {
        wsConnection.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [currentContext])

  const connectWebSocket = () => {
    if (!currentContext) return

    setWsStatus('connecting')

    // Use backend server URL for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const backendHost = 'localhost:8080' // Backend server address
    const wsUrl = `${protocol}//${backendHost}/api/v1/topology/ws?context=${encodeURIComponent(currentContext)}`

    console.log('Connecting to WebSocket:', wsUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setWsStatus('connected')
      setReconnectAttempt(0)
      setWsConnection(ws)
    }

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        handleWebSocketUpdate(update)
        setLastUpdate(new Date())
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsStatus('error')
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      setWsConnection(null)
      setWsStatus('disconnected')

      // Auto-reconnect with exponential backoff
      if (currentContext && reconnectAttempt < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000)
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1)
          connectWebSocket()
        }, delay)
      }
    }
  }

  const handleWebSocketUpdate = (update: any) => {
    console.log('Received WebSocket update:', update)

    if (!update.changes) return

    update.changes.forEach((change: any) => {
      const { type, resourceType, resourceId, namespace, data } = change

      if (resourceType === 'pod') {
        // Skip updates without proper namespace EXCEPT for DELETED events
        const podNamespace = namespace || data?.namespace
        if (!podNamespace && type !== 'DELETED') {
          console.warn('Skipping pod update without namespace:', change)
          return
        }

        setPods(prevPods => {
          let newPods = [...prevPods]

          if (type === 'ADDED' || type === 'MODIFIED') {
            // Try to find existing pod by multiple criteria
            const podName = data?.name || resourceId
            const podUID = data?.uid

            // First try to find by UID if available
            let existingIndex = -1
            if (podUID) {
              existingIndex = newPods.findIndex(p => p.uid === podUID)
            }

            // If not found by UID, try by name and namespace
            if (existingIndex === -1) {
              existingIndex = newPods.findIndex(p =>
                p.name === podName && p.namespace === podNamespace
              )
            }

            // Format age to be more readable
            const formatAge = (age: string): string => {
              if (!age || age === 'Unknown') return 'Unknown'
              // Convert duration string like "1h30m45s" to a more readable format
              return age.replace(/(\d+)h/, '$1h ')
                        .replace(/(\d+)m/, '$1m ')
                        .replace(/(\d+)s/, '$1s')
                        .replace(/\s+/g, ' ')
                        .trim()
            }

            const updatedPod: Pod = {
              name: podName,
              namespace: podNamespace,
              status: data?.phase || 'Unknown',
              ready: data?.ready || '0/0',
              restarts: data?.restartCount || 0,
              age: formatAge(data?.age),
              cpu: data?.cpu || '-/-',
              memory: data?.memory || '-/-',
              containers: data?.containers || [],
              node: data?.nodeName || 'Unknown',
              ip: data?.podIP || '',
              uid: podUID || `${currentContext}-${podNamespace}-${podName}`
            }

            if (existingIndex >= 0) {
              const oldPod = newPods[existingIndex]
              const statusChanged = oldPod.status !== updatedPod.status
              console.log(`Updating existing pod: ${podName} in ${podNamespace}${statusChanged ? ` (status: ${oldPod.status} → ${updatedPod.status})` : ''}`)
              newPods[existingIndex] = updatedPod
            } else if (type === 'ADDED') {
              // Only add new pods for ADDED events, not MODIFIED
              console.log(`Adding new pod: ${podName} in ${podNamespace} (status: ${updatedPod.status})`)
              newPods.push(updatedPod)
            } else if (type === 'MODIFIED') {
              // Log warning for MODIFIED event on non-existent pod
              console.warn(`Received MODIFIED event for non-existent pod: ${podName} in ${podNamespace}`)
            }
          } else if (type === 'DELETED') {
            const podName = data?.name || resourceId
            const podUID = data?.uid

            console.log(`Deleting pod: ${podName} from namespace: ${podNamespace || 'all namespaces'}`)

            newPods = newPods.filter(p => {
              // Remove by UID if available
              if (podUID && p.uid === podUID) {
                console.log(`Removing pod by UID: ${p.name} in ${p.namespace}`)
                return false
              }
              // If we have a namespace, match by name and namespace
              if (podNamespace && p.name === podName && p.namespace === podNamespace) {
                console.log(`Removing pod by name/namespace: ${p.name} in ${p.namespace}`)
                return false
              }
              // If no namespace provided, match by name only (for DELETED events without namespace)
              if (!podNamespace && p.name === podName) {
                console.log(`Removing pod by name only: ${p.name} in ${p.namespace}`)
                return false
              }
              return true
            })
          }

          // Remove any duplicates (pods with same name and namespace but different UIDs)
          const uniquePods = new Map<string, Pod>()
          const duplicatesFound: string[] = []

          newPods.forEach(pod => {
            const key = `${pod.name}-${pod.namespace}`
            const existing = uniquePods.get(key)

            if (existing) {
              // Found duplicate - decide which to keep
              if (existing.status === 'Unknown' && pod.status !== 'Unknown') {
                // Replace Unknown status pod with better one
                uniquePods.set(key, pod)
                duplicatesFound.push(`${key} (replaced Unknown with ${pod.status})`)
              } else if (existing.status !== 'Unknown' && pod.status === 'Unknown') {
                // Keep existing non-Unknown status
                duplicatesFound.push(`${key} (kept ${existing.status}, discarded Unknown)`)
              } else {
                // Both have same status priority, keep first
                duplicatesFound.push(`${key} (kept first with status: ${existing.status})`)
              }
            } else {
              uniquePods.set(key, pod)
            }
          })

          const deduplicatedPods = Array.from(uniquePods.values())
          if (duplicatesFound.length > 0) {
            console.warn(`Found and handled ${duplicatesFound.length} duplicate pods:`, duplicatesFound)
          }

          console.log(`Total pods after update: ${deduplicatedPods.length} (${type} event for ${data?.name || resourceId})`)
          return deduplicatedPods
        })
      } else if (resourceType === 'node') {
        setNodes(prevNodes => {
          let newNodes = [...prevNodes]

          if (type === 'ADDED' || type === 'MODIFIED') {
            const existingIndex = newNodes.findIndex(n => n.name === resourceId)

            if (existingIndex >= 0) {
              // Update existing node
              newNodes[existingIndex] = {
                ...newNodes[existingIndex],
                ...data
              }
            } else if (type === 'ADDED') {
              // Add new node
              newNodes.push(data as NodeInfo)
            }
          } else if (type === 'DELETED') {
            const nodeName = data?.name || resourceId
            console.log(`Deleting node: ${nodeName}`)
            newNodes = newNodes.filter(n => n.name !== nodeName)
          }

          return newNodes
        })
      }
    })
  }

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
              cpu: pod.cpu || '-/-',
              memory: pod.memory || '-/-',
              containers: (pod.containers || []).map((container: any) => {
                // If container is a string, convert to object
                if (typeof container === 'string') {
                  // Add common ports based on container name patterns
                  const ports = [];
                  const lowerName = container.toLowerCase();
                  if (lowerName.includes('nginx')) {
                    ports.push({ containerPort: 80, protocol: 'TCP', name: 'http' });
                    ports.push({ containerPort: 443, protocol: 'TCP', name: 'https' });
                  } else if (lowerName.includes('redis')) {
                    ports.push({ containerPort: 6379, protocol: 'TCP', name: 'redis' });
                  } else if (lowerName.includes('postgres')) {
                    ports.push({ containerPort: 5432, protocol: 'TCP', name: 'postgres' });
                  } else if (lowerName.includes('mysql')) {
                    ports.push({ containerPort: 3306, protocol: 'TCP', name: 'mysql' });
                  } else if (lowerName.includes('mongo')) {
                    ports.push({ containerPort: 27017, protocol: 'TCP', name: 'mongodb' });
                  } else if (lowerName.includes('kafka')) {
                    ports.push({ containerPort: 9092, protocol: 'TCP', name: 'kafka' });
                  } else if (lowerName.includes('rabbitmq')) {
                    ports.push({ containerPort: 5672, protocol: 'TCP', name: 'amqp' });
                    ports.push({ containerPort: 15672, protocol: 'TCP', name: 'management' });
                  } else if (lowerName.includes('elasticsearch')) {
                    ports.push({ containerPort: 9200, protocol: 'TCP', name: 'http' });
                    ports.push({ containerPort: 9300, protocol: 'TCP', name: 'transport' });
                  } else if (lowerName.includes('node') || lowerName.includes('express')) {
                    ports.push({ containerPort: 3000, protocol: 'TCP', name: 'http' });
                  } else if (pod.name.includes('demo')) {
                    // For demo pods, add default web port
                    ports.push({ containerPort: 8080, protocol: 'TCP', name: 'http' });
                  }

                  return {
                    name: container,
                    ready: true,
                    state: 'running',
                    ports: ports.length > 0 ? ports : undefined
                  };
                }

                // If it's already an object, ensure it has ports
                return {
                  ...container,
                  ports: container.ports || (container.name && container.name.toLowerCase().includes('nginx')
                    ? [{ containerPort: 80, protocol: 'TCP', name: 'http' }]
                    : undefined)
                };
              }),
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
    switch (sortBy) {
      case 'pods':
        groups.sort((a, b) => b.totalPods - a.totalPods)
        break
      case 'cpu':
        groups.sort((a, b) => {
          const cpuA = parseFloat(a.node.capacity?.cpu || '0')
          const cpuB = parseFloat(b.node.capacity?.cpu || '0')
          return cpuB - cpuA
        })
        break
      case 'memory':
        groups.sort((a, b) => {
          const memA = parseFloat(a.node.capacity?.memory?.replace(/[^0-9]/g, '') || '0')
          const memB = parseFloat(b.node.capacity?.memory?.replace(/[^0-9]/g, '') || '0')
          return memB - memA
        })
        break
      case 'name':
      default:
        groups.sort((a, b) => a.node.name.localeCompare(b.node.name))
        break
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

  const handlePodAction = (action: string, pod: Pod) => {
    switch (action) {
      case 'info':
        setActiveWindows(prev => ({
          ...prev,
          podInfo: pod
        }))
        break
      case 'logs':
        const firstContainerForLogs = pod.containers[0]
        const containerNameForLogs = typeof firstContainerForLogs === 'string' ? firstContainerForLogs : firstContainerForLogs?.name
        const logsId = `logs-${pod.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          logs: [...(prev.logs || []), {
            id: logsId,
            pod: pod.name,
            namespace: pod.namespace,
            container: containerNameForLogs
          }]
        }))
        break
      case 'yaml':
        const yamlId = `yaml-pod-${pod.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          yamls: [...(prev.yamls || []), {
            id: yamlId,
            type: 'pod',
            name: pod.name,
            namespace: pod.namespace
          }]
        }))
        break
      case 'shell':
        // Get all container names
        const containerNames = pod.containers.map(c =>
          typeof c === 'string' ? c : c.name
        ).filter(Boolean)

        if (containerNames.length === 1) {
          // Single container - open shell directly
          const shellId = `${pod.name}-${containerNames[0]}-${Date.now()}`
          setActiveWindows(prev => ({
            ...prev,
            shells: [...(prev.shells || []), {
              id: shellId,
              pod: pod.name,
              namespace: pod.namespace,
              container: containerNames[0]
            }]
          }))
        } else if (containerNames.length > 1) {
          // Multiple containers - show selection dialog
          setContainerSelection({
            pod,
            selectedContainers: []
          })
        }
        break
      case 'events':
        const eventsId = `events-pod-${pod.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          events: [...(prev.events || []), {
            id: eventsId,
            type: 'pod',
            name: pod.name,
            namespace: pod.namespace
          }]
        }))
        break
      case 'describe':
        const describeId = `describe-pod-${pod.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          describes: [...(prev.describes || []), {
            id: describeId,
            type: 'pod',
            name: pod.name,
            namespace: pod.namespace
          }]
        }))
        break
    }
  }

  const handleNodeAction = (action: string, node: NodeInfo) => {
    switch (action) {
      case 'yaml':
        const yamlId = `yaml-node-${node.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          yamls: [...(prev.yamls || []), {
            id: yamlId,
            type: 'node',
            name: node.name
          }]
        }))
        break
      case 'events':
        const eventsId = `events-node-${node.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          events: [...(prev.events || []), {
            id: eventsId,
            type: 'node',
            name: node.name
          }]
        }))
        break
      case 'describe':
        const describeId = `describe-node-${node.name}-${Date.now()}`
        setActiveWindows(prev => ({
          ...prev,
          describes: [...(prev.describes || []), {
            id: describeId,
            type: 'node',
            name: node.name
          }]
        }))
        break
    }
  }

  const handleOpenShells = () => {
    if (!containerSelection.pod) return

    const { pod, selectedContainers } = containerSelection
    const newShells = selectedContainers.map(containerName => ({
      id: `${pod.name}-${containerName}-${Date.now()}-${Math.random()}`,
      pod: pod.name,
      namespace: pod.namespace,
      container: containerName
    }))

    setActiveWindows(prev => ({
      ...prev,
      shells: [...(prev.shells || []), ...newShells]
    }))

    // Close dialog
    setContainerSelection({ pod: null, selectedContainers: [] })
  }

  const toggleContainerSelection = (containerName: string) => {
    setContainerSelection(prev => ({
      ...prev,
      selectedContainers: prev.selectedContainers.includes(containerName)
        ? prev.selectedContainers.filter(c => c !== containerName)
        : [...prev.selectedContainers, containerName]
    }))
  }

  // Render functions for different view modes
  const renderCardView = () => (
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-4 w-4" />
                      <span>{group.node.capacity?.cpu || 'N/A'} / {group.node.allocatable?.cpu || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4" />
                      <span>{formatMemory(group.node.capacity?.memory)} / {formatMemory(group.node.allocatable?.memory)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Box className="h-4 w-4" />
                      <span>{group.pods.length} pods</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Node Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleNodeAction('describe', group.node)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Describe
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNodeAction('yaml', group.node)}>
                        <FileCode className="mr-2 h-4 w-4" />
                        View YAML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNodeAction('events', group.node)}>
                        <Activity className="mr-2 h-4 w-4" />
                        View Events
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {group.pods.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No pods on this node</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.pods.map(pod => (
                    <ContextMenu key={`${pod.namespace}-${pod.name}`}>
                      <ContextMenuTrigger>
                        <div className={cn(
                          "p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
                          getPodStatusColor(pod)
                        )}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getPodIcon(pod)}
                                <span className="font-medium text-sm truncate" title={pod.name}>
                                  {pod.name}
                                </span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Pod Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handlePodAction('info', pod)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Pod Info
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePodAction('logs', pod)}>
                                    <ScrollText className="mr-2 h-4 w-4" />
                                    View Logs
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePodAction('yaml', pod)}>
                                    <FileCode className="mr-2 h-4 w-4" />
                                    View YAML
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePodAction('shell', pod)}>
                                    <Terminal className="mr-2 h-4 w-4" />
                                    Open Shell
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePodAction('describe', pod)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Describe
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handlePodAction('events', pod)}>
                                    <Activity className="mr-2 h-4 w-4" />
                                    View Events
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="space-y-2 mt-2">
                              {/* First row: Namespace, Status, Ready */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="py-0 px-1.5 h-5 text-xs">
                                  {pod.namespace}
                                </Badge>
                                <Badge variant={pod.status === 'Running' ? 'success' : 'secondary'} className="py-0 px-1.5 h-5 text-xs">
                                  {pod.status}
                                </Badge>
                                <Badge variant="outline" className="py-0 px-1.5 h-5 text-xs">
                                  {pod.ready}
                                </Badge>
                              </div>

                              {/* Second row: Age, CPU, Memory */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{pod.age}</span>
                                </div>
                                <div className="flex items-center gap-1" title="CPU (requests/limits)">
                                  <Cpu className="h-3 w-3 text-blue-500" />
                                  <span className="font-mono">{pod.cpu || '-/-'}</span>
                                </div>
                                <div className="flex items-center gap-1" title="Memory (requests/limits)">
                                  <HardDrive className="h-3 w-3 text-purple-500" />
                                  <span className="font-mono">{pod.memory || '-/-'}</span>
                                </div>
                              </div>
                            </div>
                            {pod.restarts > 0 && (
                              <div className="flex items-center gap-1 text-xs text-orange-500 mt-1">
                                <RefreshCw className="h-3 w-3" />
                                <span>{pod.restarts} restarts</span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {pod.containers.map((container, cidx) => {
                                const containerName = typeof container === 'string' ? container : container.name
                                return (
                                  <Tooltip key={cidx}>
                                    <TooltipTrigger>
                                      <div className="mini-hexagon-wrapper" title={containerName}>
                                        <div className={cn("mini-hexagon", getContainerColor(container, pod.ready))}>
                                          <Container className="h-2 w-2 text-white" />
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">
                                        <p className="font-medium">{containerName}</p>
                                        {typeof container === 'object' && (
                                          <>
                                            <p>Ready: {container.ready ? 'Yes' : 'No'}</p>
                                            <p>State: {container.state}</p>
                                          </>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuLabel>Quick Actions</ContextMenuLabel>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => handlePodAction('logs', pod)}>
                          <ScrollText className="mr-2 h-4 w-4" />
                          View Logs
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePodAction('shell', pod)}>
                          <Terminal className="mr-2 h-4 w-4" />
                          Open Shell
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePodAction('describe', pod)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Describe
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </TooltipProvider>
    </div>
  )

  const renderCompactGridView = () => {
    // Helper function to determine card width based on pod count
    const getCardWidth = (podCount: number) => {
      if (podCount === 0) return "w-fit min-w-[200px] max-w-xs"
      if (podCount === 1) return "w-fit min-w-[150px] max-w-[200px]"
      if (podCount <= 4) return "w-fit min-w-[200px] max-w-sm"
      if (podCount <= 8) return "w-fit min-w-[280px] max-w-md"
      if (podCount <= 16) return "w-fit min-w-[350px] max-w-lg"
      if (podCount <= 24) return "w-fit min-w-[400px] max-w-xl"
      return "w-fit min-w-[500px] max-w-2xl"
    }

    // Helper function to determine grid columns for pods based on count
    const getPodGridCols = (podCount: number) => {
      if (podCount === 0) return "flex justify-center"
      if (podCount === 1) return "flex justify-center"
      if (podCount <= 4) return "grid grid-cols-4"
      if (podCount <= 8) return "grid grid-cols-8"
      if (podCount <= 16) return "grid grid-cols-8"
      if (podCount <= 24) return "grid grid-cols-8"
      return "grid grid-cols-8"
    }

    return (
      <div className="flex flex-wrap gap-4">
        {nodeGroups.map(group => (
          <Card key={group.node.name} className={cn("overflow-hidden", getCardWidth(group.pods.length))}>
          <CardHeader className="py-3 px-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className={cn("h-4 w-4", getNodeStatusColor(group.node.status))} />
                <span className="font-medium text-sm">{group.node.name}</span>
                <Badge variant="outline" className="text-xs py-0">
                  {group.pods.length} pods
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={group.node.status === 'Ready' ? 'success' : 'destructive'} className="text-xs py-0">
                  {group.node.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Node Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleNodeAction('describe', group.node)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Describe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleNodeAction('yaml', group.node)}>
                      <FileCode className="mr-2 h-4 w-4" />
                      View YAML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleNodeAction('events', group.node)}>
                      <Activity className="mr-2 h-4 w-4" />
                      View Events
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className={cn("gap-0.5", getPodGridCols(group.pods.length))}>
              {group.pods.map(pod => (
                <ContextMenu key={`${pod.namespace}-${pod.name}`}>
                  <ContextMenuTrigger asChild>
                    <div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "w-7 h-7 rounded border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform",
                              getPodStatusColor(pod)
                            )}
                            onClick={() => handlePodAction('info', pod)}
                          >
                            {getPodIcon(pod)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <p className="font-medium truncate">{pod.name}</p>
                          <p>Namespace: {pod.namespace}</p>
                          <p>Status: {pod.status}</p>
                          <p>Ready: {pod.ready}</p>
                          <p>CPU: {pod.cpu || '-/-'}</p>
                          <p>Memory: {pod.memory || '-/-'}</p>
                          {pod.containers && pod.containers.length > 0 && (
                            <div className="pt-1 border-t">
                              <p className="font-medium">Containers ({pod.containers.length}):</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {pod.containers.map((container, idx) => {
                                  const containerName = typeof container === 'string' ? container : container.name
                                  return (
                                    <div key={idx} className="flex items-center gap-1">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        getContainerColor(container, pod.ready).replace('bg-', 'bg-')
                                      )} />
                                      <span className="text-[10px]">{containerName}</span>
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
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuLabel>Pod Actions</ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handlePodAction('info', pod)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Pod Info
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePodAction('logs', pod)}>
                      <ScrollText className="mr-2 h-4 w-4" />
                      View Logs
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePodAction('yaml', pod)}>
                      <FileCode className="mr-2 h-4 w-4" />
                      View YAML
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePodAction('shell', pod)}>
                      <Terminal className="mr-2 h-4 w-4" />
                      Open Shell
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePodAction('describe', pod)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Describe
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handlePodAction('events', pod)}>
                      <Activity className="mr-2 h-4 w-4" />
                      View Events
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </CardContent>
        </Card>
        ))}
      </div>
    )
  }

  const renderHeatMapView = () => {
    const getHeatMapColor = (pod: Pod) => {
      const cpuValue = pod.cpu ? parseInt(pod.cpu.split('/')[0]) : 0
      const memValue = pod.memory ? parseInt(pod.memory.split('/')[0]) : 0
      const avgValue = (cpuValue + memValue) / 2

      if (avgValue > 1000) return 'bg-red-500'
      if (avgValue > 500) return 'bg-orange-500'
      if (avgValue > 200) return 'bg-yellow-500'
      if (avgValue > 100) return 'bg-green-500'
      return 'bg-blue-500'
    }

    return (
      <div className="space-y-4">
        {nodeGroups.map(group => (
          <Card key={group.node.name}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className={cn("h-4 w-4", getNodeStatusColor(group.node.status))} />
                  {group.node.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span>CPU: {group.node.capacity?.cpu || 'N/A'}</span>
                    <span>Memory: {formatMemory(group.node.capacity?.memory)}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Node Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleNodeAction('describe', group.node)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Describe
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNodeAction('yaml', group.node)}>
                        <FileCode className="mr-2 h-4 w-4" />
                        View YAML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNodeAction('events', group.node)}>
                        <Activity className="mr-2 h-4 w-4" />
                        View Events
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-1">
                {group.pods.map(pod => (
                  <ContextMenu key={`${pod.namespace}-${pod.name}`}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "w-8 h-8 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center",
                                getHeatMapColor(pod)
                              )}
                              onClick={() => handlePodAction('info', pod)}
                            >
                              <Container className="h-3 w-3 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs">
                              <p className="font-medium truncate">{pod.name}</p>
                              <p>CPU: {pod.cpu || '-/-'}</p>
                              <p>Memory: {pod.memory || '-/-'}</p>
                              <p>Status: {pod.status}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuLabel>Pod Actions</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handlePodAction('info', pod)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Pod Info
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePodAction('logs', pod)}>
                        <ScrollText className="mr-2 h-4 w-4" />
                        View Logs
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePodAction('yaml', pod)}>
                        <FileCode className="mr-2 h-4 w-4" />
                        View YAML
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePodAction('shell', pod)}>
                        <Terminal className="mr-2 h-4 w-4" />
                        Open Shell
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePodAction('describe', pod)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Describe
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePodAction('events', pod)}>
                        <Activity className="mr-2 h-4 w-4" />
                        View Events
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderTableView = () => (
    <div className="space-y-4">
      {nodeGroups.map(group => (
        <Card key={group.node.name}>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className={cn("h-4 w-4", getNodeStatusColor(group.node.status))} />
              {group.node.name}
              <Badge variant="outline" className="ml-2">
                {group.pods.length} pods
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ready</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.pods.map(pod => (
                  <TableRow key={`${pod.namespace}-${pod.name}`}>
                    <TableCell>{getPodIcon(pod)}</TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <span className="block truncate" title={pod.name}>{pod.name}</span>
                    </TableCell>
                    <TableCell>{pod.namespace}</TableCell>
                    <TableCell>
                      <Badge variant={pod.status === 'Running' ? 'success' : 'destructive'} className="text-xs">
                        {pod.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{pod.ready}</TableCell>
                    <TableCell className="text-xs">{pod.cpu || '-/-'}</TableCell>
                    <TableCell className="text-xs">{pod.memory || '-/-'}</TableCell>
                    <TableCell className="text-xs">{pod.age}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePodAction('info', pod)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Info
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePodAction('logs', pod)}>
                            <ScrollText className="mr-2 h-4 w-4" />
                            Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePodAction('shell', pod)}>
                            <Terminal className="mr-2 h-4 w-4" />
                            Shell
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderContent = () => {
    switch (viewMode) {
      case 'compact':
        return renderCompactGridView()
      case 'heatmap':
        return renderHeatMapView()
      case 'table':
        return renderTableView()
      case 'card':
      default:
        return renderCardView()
    }
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
                  Node Topology (Enhanced)
                </h1>
                {selectedClusters.length > 0 && (
                  <Badge variant="outline">
                    {selectedClusters.map(c => c.name).join(', ')}
                  </Badge>
                )}

                {/* WebSocket Status Indicator */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                          wsStatus === 'connected' && "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                          wsStatus === 'connecting' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
                          wsStatus === 'disconnected' && "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
                          wsStatus === 'error' && "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        )}>
                          {wsStatus === 'connected' ? (
                            <>
                              <Wifi className="h-3 w-3" />
                              <span>Live</span>
                            </>
                          ) : wsStatus === 'connecting' ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Connecting</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-3 w-3" />
                              <span>Offline</span>
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <p>WebSocket Status: {wsStatus}</p>
                          {lastUpdate && (
                            <p>Last Update: {lastUpdate.toLocaleTimeString()}</p>
                          )}
                          {reconnectAttempt > 0 && wsStatus !== 'connected' && (
                            <p>Reconnect Attempt: {reconnectAttempt}/5</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Selector */}
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as 'card' | 'compact' | 'heatmap' | 'table')}
                  className="border rounded-md p-1"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="card" aria-label="Card View" size="sm">
                          <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Card View</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="compact" aria-label="Compact Grid" size="sm">
                          <Grid3x3 className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Compact Grid</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="heatmap" aria-label="Heat Map" size="sm">
                          <Thermometer className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Heat Map</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="table" aria-label="Table View" size="sm">
                          <TableIcon className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Table View</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </ToggleGroup>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'pods' | 'cpu' | 'memory')}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by...">
                      {sortBy === 'name' && 'Sort by Name'}
                      {sortBy === 'pods' && 'Sort by Pod Count'}
                      {sortBy === 'cpu' && 'Sort by CPU'}
                      {sortBy === 'memory' && 'Sort by Memory'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="pods">Sort by Pod Count</SelectItem>
                    <SelectItem value="cpu">Sort by CPU</SelectItem>
                    <SelectItem value="memory">Sort by Memory</SelectItem>
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

          {/* Scale Suggestion Banner */}
          {showScaleSuggestion && (
            <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    Large cluster detected ({nodes.length} nodes, {pods.length} pods).
                    Consider using Compact Grid or Table view for better performance.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('compact')}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Switch to Compact
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Switch to Table
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowScaleSuggestion(false)
                      setDismissedSuggestion(true)
                    }}
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-400"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

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
              <TooltipProvider>
                {renderContent()}
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Active Windows */}
      {activeWindows.logs && activeWindows.logs.map(log => (
        <LogsWindow
          key={log.id}
          podName={log.pod}
          namespace={log.namespace}
          context={currentContext}
          containerName={log.container}
          onClose={() => setActiveWindows(prev => ({
            ...prev,
            logs: prev.logs?.filter(l => l.id !== log.id)
          }))}
        />
      ))}

      {activeWindows.yamls && activeWindows.yamls.map(yaml => (
        <YamlWindow
          key={yaml.id}
          resourceType={yaml.type}
          resourceName={yaml.name}
          namespace={yaml.namespace}
          context={currentContext}
          onClose={() => setActiveWindows(prev => ({
            ...prev,
            yamls: prev.yamls?.filter(y => y.id !== yaml.id)
          }))}
        />
      ))}

      {activeWindows.shells && activeWindows.shells.map(shell => (
        <ShellWindow
          key={shell.id}
          podName={shell.pod}
          namespace={shell.namespace}
          containerName={shell.container}
          context={currentContext}
          onClose={() => setActiveWindows(prev => ({
            ...prev,
            shells: prev.shells?.filter(s => s.id !== shell.id)
          }))}
        />
      ))}

      {activeWindows.events && activeWindows.events.map(event => (
        <EventsWindow
          key={event.id}
          resourceType={event.type}
          resourceName={event.name}
          namespace={event.namespace}
          context={currentContext}
          onClose={() => setActiveWindows(prev => ({
            ...prev,
            events: prev.events?.filter(e => e.id !== event.id)
          }))}
        />
      ))}

      {activeWindows.describes && activeWindows.describes.map(describe => (
        <DescribeWindow
          key={describe.id}
          resourceType={describe.type}
          resourceName={describe.name}
          namespace={describe.namespace}
          context={currentContext}
          onClose={() => setActiveWindows(prev => ({
            ...prev,
            describes: prev.describes?.filter(d => d.id !== describe.id)
          }))}
        />
      ))}

      {activeWindows.podInfo && (
        <PodInfoWindow
          podName={activeWindows.podInfo.name}
          namespace={activeWindows.podInfo.namespace}
          nodeName={activeWindows.podInfo.node}
          phase={activeWindows.podInfo.status}
          containers={activeWindows.podInfo.containers.map(c => {
            if (typeof c === 'string') {
              return {
                name: c,
                image: 'Unknown',
                ready: isPodReady(activeWindows.podInfo.ready),
                restartCount: activeWindows.podInfo.restarts,
                state: 'Unknown'
              }
            }
            return {
              name: c.name,
              image: 'Unknown',
              ready: c.ready,
              restartCount: activeWindows.podInfo.restarts,
              state: c.state
            }
          })}
          onClose={() => setActiveWindows(prev => ({ ...prev, podInfo: undefined }))}
        />
      )}

      {/* Container Selection Dialog */}
      <Dialog open={!!containerSelection.pod} onOpenChange={(open) => {
        if (!open) {
          setContainerSelection({ pod: null, selectedContainers: [] })
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Container(s) for Shell Access</DialogTitle>
            <DialogDescription>
              Pod: {containerSelection.pod?.name}
              <br />
              Select one or more containers to open shell sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {containerSelection.pod?.containers.map((container, idx) => {
              const containerName = typeof container === 'string' ? container : container.name
              const containerState = typeof container === 'string' ? 'unknown' : container.state
              const isReady = typeof container === 'string' ? true : container.ready

              return (
                <div key={idx} className="flex items-center space-x-3">
                  <Checkbox
                    id={`container-${idx}`}
                    checked={containerSelection.selectedContainers.includes(containerName)}
                    onCheckedChange={() => toggleContainerSelection(containerName)}
                  />
                  <Label
                    htmlFor={`container-${idx}`}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4" />
                      <span className="font-medium">{containerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isReady ? (
                        <Badge variant="success" className="text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">Not Ready</Badge>
                      )}
                      {containerState && containerState !== 'unknown' && (
                        <Badge variant="outline" className="text-xs">{containerState}</Badge>
                      )}
                    </div>
                  </Label>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContainerSelection({ pod: null, selectedContainers: [] })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenShells}
              disabled={containerSelection.selectedContainers.length === 0}
            >
              Open Shell{containerSelection.selectedContainers.length > 1 ? 's' : ''} ({containerSelection.selectedContainers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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