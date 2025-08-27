import { useState, useEffect, useMemo, useRef, KeyboardEvent } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useClusterStore } from '@/stores/cluster.store'
import { resourcesService } from '@/services/resources.service'
import { podsService } from '@/services/pods.service'
import { ManagedTerminal } from '@/components/managed-terminal'
import { terminalManager } from '@/services/terminal-manager'
import { 
  Terminal, 
  Server, 
  Box, 
  Search, 
  Filter, 
  X, 
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Container,
  Cloud,
  Layers,
  RefreshCw,
  AlertCircle,
  FolderOpen,
  Folder,
  Circle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cpu,
  HardDrive,
  Grid3x3,
  List,
  Play,
  Square,
  Check,
  Send,
  Command,
  Link,
  Unlink
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface ContainerInfo {
  name: string
  image: string
  status: string
  ready: boolean
  restartCount: number
}

interface PodInfo {
  name: string
  namespace: string
  cluster: string
  status: string
  containers: ContainerInfo[]
  nodeName: string
  podIP: string
  createdAt: string
}

interface TerminalSession {
  id: string
  podName: string
  containerName: string
  namespace: string
  cluster: string
  title: string
  isActive: boolean
  isMaximized: boolean
}

interface TreeNode {
  id: string
  label: string
  type: 'cluster' | 'namespace' | 'pod' | 'container'
  data?: any
  children?: TreeNode[]
  expanded?: boolean
  status?: string
  ready?: boolean
  icon?: any
}

export function AdvancedTerminalsPage() {
  const [selectedClusters, setSelectedClusters] = useState<string[]>([])
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([])
  // Terminal manager handles all terminal instances globally
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [terminals, setTerminals] = useState<TerminalSession[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [pods, setPods] = useState<PodInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs')
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [broadcastCommand, setBroadcastCommand] = useState('')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [syncInputEnabled, setSyncInputEnabled] = useState(false)
  const [showCloseAllDialog, setShowCloseAllDialog] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const { clusters, fetchClusters } = useClusterStore()

  // Fetch clusters on mount
  useEffect(() => {
    fetchClusters()
  }, [])
  
  // Clean up all terminals on page unmount
  useEffect(() => {
    return () => {
      // Only cleanup if actually navigating away from the page
      terminals.forEach(terminal => {
        terminalManager.destroyTerminal(terminal.id)
      })
    }
  }, []) // Empty deps - only cleanup on actual unmount
  
  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])
  
  // Resize all terminals when fullscreen mode or view mode changes
  useEffect(() => {
    // Small delay to allow DOM to update
    const resizeTimeout = setTimeout(() => {
      terminals.forEach(terminal => {
        terminalManager.resizeTerminal(terminal.id)
      })
    }, 150)
    
    return () => clearTimeout(resizeTimeout)
  }, [isFullscreen, viewMode, terminals.length])
  
  // Handle window resize events
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout
    const handleWindowResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        terminals.forEach(terminal => {
          terminalManager.resizeTerminal(terminal.id)
        })
      }, 100)
    }
    
    window.addEventListener('resize', handleWindowResize)
    return () => {
      window.removeEventListener('resize', handleWindowResize)
      clearTimeout(resizeTimer)
    }
  }, [terminals])

  // Fetch pods and namespaces when clusters or namespace filter changes
  useEffect(() => {
    if (clusters.filter(c => c.connected).length > 0) {
      fetchPodsAndNamespaces()
    }
  }, [selectedClusters, selectedNamespaces, clusters])

  const fetchPodsAndNamespaces = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const allPods: PodInfo[] = []
      const allNamespaces = new Set<string>()
      
      // Determine which clusters to fetch from
      const clustersToFetch = selectedClusters.length > 0 
        ? clusters.filter(c => selectedClusters.includes(c.context) && c.connected)
        : clusters.filter(c => c.connected)
      
      // Fetch pods from each selected cluster
      for (const cluster of clustersToFetch) {
        try {
          // First fetch namespaces for this cluster
          const namespacesResponse = await resourcesService.listNamespaces(cluster.context)
          namespacesResponse.items.forEach(ns => allNamespaces.add(ns.name))
          
          // Then fetch pods
          const podsResponse = await resourcesService.listPods({
            context: cluster.context,
            namespace: selectedNamespaces.length > 0 ? selectedNamespaces[0] : undefined
          })
          
          // Fetch detailed pod info including containers for each pod
          for (const pod of podsResponse.items) {
            try {
              const podDetail = await podsService.getPod(cluster.context, pod.namespace, pod.name)
              
              const podInfo: PodInfo = {
                name: pod.name,
                namespace: pod.namespace,
                cluster: cluster.context,
                status: podDetail.phase || pod.status,
                nodeName: podDetail.nodeName || pod.node,
                podIP: podDetail.podIP || pod.ip,
                createdAt: podDetail.creationTimestamp,
                containers: (podDetail.containerStatuses || []).map((cs: any) => ({
                  name: cs.name,
                  image: cs.image,
                  status: cs.state.running ? 'Running' : cs.state.waiting ? 'Waiting' : 'Terminated',
                  ready: cs.ready,
                  restartCount: cs.restartCount
                }))
              }
              
              // If no container statuses, use container specs
              if (podInfo.containers.length === 0 && podDetail.containers) {
                podInfo.containers = podDetail.containers.map((c: any) => ({
                  name: c.name,
                  image: c.image,
                  status: 'Unknown',
                  ready: false,
                  restartCount: 0
                }))
              }
              
              allPods.push(podInfo)
            } catch (detailError) {
              console.error(`Failed to fetch details for pod ${pod.name}:`, detailError)
              // Add pod with basic info even if details fail
              allPods.push({
                name: pod.name,
                namespace: pod.namespace,
                cluster: cluster.context,
                status: pod.status,
                nodeName: pod.node,
                podIP: pod.ip,
                createdAt: '',
                containers: pod.containers?.map((c: string) => ({
                  name: c,
                  image: 'unknown',
                  status: 'Unknown',
                  ready: false,
                  restartCount: 0
                })) || []
              })
            }
          }
        } catch (clusterError) {
          console.error(`Failed to fetch pods from cluster ${cluster.context}:`, clusterError)
        }
      }
      
      setPods(allPods)
      setNamespaces(Array.from(allNamespaces).sort())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pods')
      console.error('Error fetching pods:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshData = () => {
    fetchPodsAndNamespaces()
  }

  // Build tree structure from pods data
  const treeData = useMemo(() => {
    const tree: TreeNode[] = []
    const clusterMap = new Map<string, TreeNode>()
    
    // Group pods by cluster and namespace
    pods.forEach(pod => {
      // Apply search filter
      if (searchQuery && !pod.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !pod.namespace.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !pod.containers.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return
      }
      
      // Get or create cluster node
      if (!clusterMap.has(pod.cluster)) {
        const clusterNode: TreeNode = {
          id: `cluster-${pod.cluster}`,
          label: pod.cluster,
          type: 'cluster',
          icon: Cloud,
          children: [],
          expanded: expandedNodes.has(`cluster-${pod.cluster}`)
        }
        clusterMap.set(pod.cluster, clusterNode)
        tree.push(clusterNode)
      }
      
      const clusterNode = clusterMap.get(pod.cluster)!
      
      // Get or create namespace node
      let namespaceNode = clusterNode.children?.find(n => n.label === pod.namespace)
      if (!namespaceNode) {
        namespaceNode = {
          id: `namespace-${pod.cluster}-${pod.namespace}`,
          label: pod.namespace,
          type: 'namespace',
          icon: Layers,
          children: [],
          expanded: expandedNodes.has(`namespace-${pod.cluster}-${pod.namespace}`)
        }
        clusterNode.children?.push(namespaceNode)
      }
      
      // Create pod node
      const podNode: TreeNode = {
        id: `pod-${pod.cluster}-${pod.namespace}-${pod.name}`,
        label: pod.name,
        type: 'pod',
        icon: Box,
        status: pod.status,
        data: pod,
        children: pod.containers.map(container => ({
          id: `container-${pod.cluster}-${pod.namespace}-${pod.name}-${container.name}`,
          label: container.name,
          type: 'container',
          icon: Container,
          ready: container.ready,
          status: container.status,
          data: { ...container, pod, cluster: pod.cluster, namespace: pod.namespace }
        })),
        expanded: expandedNodes.has(`pod-${pod.cluster}-${pod.namespace}-${pod.name}`)
      }
      
      namespaceNode.children?.push(podNode)
    })
    
    // Sort nodes at each level
    tree.forEach(clusterNode => {
      clusterNode.children?.sort((a, b) => a.label.localeCompare(b.label))
      clusterNode.children?.forEach(namespaceNode => {
        namespaceNode.children?.sort((a, b) => a.label.localeCompare(b.label))
      })
    })
    
    return tree
  }, [pods, searchQuery, expandedNodes])

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const openTerminal = (container: any) => {
    // Check if a terminal for this container already exists
    const existingTerminal = terminals.find(t => 
      t.cluster === container.cluster &&
      t.namespace === container.namespace &&
      t.podName === container.pod.name &&
      t.containerName === container.name
    )
    
    if (existingTerminal) {
      // If terminal exists, just activate it
      setActiveTerminalId(existingTerminal.id)
      // If in grid view, ensure it's visible (within first 4)
      if (viewMode === 'grid') {
        const currentIndex = terminals.findIndex(t => t.id === existingTerminal.id)
        if (currentIndex > 3) {
          // Move the terminal to the front so it's visible in grid
          const reorderedTerminals = [
            existingTerminal,
            ...terminals.filter(t => t.id !== existingTerminal.id)
          ]
          setTerminals(reorderedTerminals)
        }
      }
      return
    }
    
    // Create a new terminal only if it doesn't exist
    const terminalId = `${container.cluster}-${container.namespace}-${container.pod.name}-${container.name}-${Date.now()}`
    const newTerminal: TerminalSession = {
      id: terminalId,
      podName: container.pod.name,
      containerName: container.name,
      namespace: container.namespace,
      cluster: container.cluster,
      title: `${container.pod.name}/${container.name}`,
      isActive: true,
      isMaximized: false
    }
    
    setTerminals([...terminals, newTerminal])
    setActiveTerminalId(terminalId)
  }

  const handleBroadcastCommand = () => {
    if (!broadcastCommand.trim()) return
    
    // Get all terminal IDs
    const terminalIds = terminals.map(t => t.id)
    
    // Broadcast the command to all terminals
    terminalManager.broadcastCommand(broadcastCommand, terminalIds)
    
    // Clear the input
    setBroadcastCommand('')
  }

  const handleBroadcastKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBroadcastCommand()
    }
  }

  const toggleSyncInput = () => {
    const newState = !syncInputEnabled
    setSyncInputEnabled(newState)
    
    if (newState) {
      // Enable sync for all current terminals
      const terminalIds = terminals.map(t => t.id)
      terminalManager.enableSyncInput(terminalIds)
      
      // Focus the active terminal or the first one
      setTimeout(() => {
        const terminalToFocus = activeTerminalId || terminals[0]?.id
        if (terminalToFocus) {
          terminalManager.focusTerminal(terminalToFocus)
        }
      }, 100)
    } else {
      // Disable sync
      terminalManager.disableSyncInput()
    }
  }

  // Update sync terminals when terminals list changes
  useEffect(() => {
    if (syncInputEnabled) {
      const terminalIds = terminals.map(t => t.id)
      terminalManager.updateSyncTerminals(terminalIds)
    }
  }, [terminals, syncInputEnabled])

  const closeTerminal = (terminalId: string) => {
    // Destroy terminal through manager
    terminalManager.destroyTerminal(terminalId)
    
    setTerminals(terminals.filter(t => t.id !== terminalId))
    if (activeTerminalId === terminalId) {
      const remaining = terminals.filter(t => t.id !== terminalId)
      setActiveTerminalId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    }
  }

  const toggleMaximize = (terminalId: string) => {
    setTerminals(terminals.map(t => 
      t.id === terminalId ? { ...t, isMaximized: !t.isMaximized } : t
    ))
  }

  const toggleContainerSelection = (containerId: string) => {
    const newSelected = new Set(selectedContainers)
    if (newSelected.has(containerId)) {
      newSelected.delete(containerId)
    } else {
      newSelected.add(containerId)
    }
    setSelectedContainers(newSelected)
  }

  const openSelectedTerminals = () => {
    selectedContainers.forEach(containerId => {
      // Parse the container ID to get the container data
      const parts = containerId.split('-')
      if (parts.length >= 4) {
        const [cluster, namespace, ...rest] = parts
        const podName = rest.slice(0, -1).join('-')
        const containerName = rest[rest.length - 1]
        
        // Find the container data from the tree
        const container = findContainerInTree(treeData, containerId)
        if (container) {
          openTerminal(container.data)
        }
      }
    })
    // Clear selection after opening
    setSelectedContainers(new Set())
    setIsSelectionMode(false)
  }

  const findContainerInTree = (nodes: TreeNode[], containerId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === containerId && node.type === 'container') {
        return node
      }
      if (node.children) {
        const found = findContainerInTree(node.children, containerId)
        if (found) return found
      }
    }
    return null
  }

  const getStatusIcon = (status?: string, ready?: boolean) => {
    if (ready !== undefined) {
      return ready ? <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" /> : <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
    }
    switch (status?.toLowerCase()) {
      case 'running': return <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
      case 'pending': return <AlertCircle className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
      case 'failed': return <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
      case 'terminating': return <AlertTriangle className="h-3 w-3 text-orange-500 dark:text-orange-400" />
      default: return <Circle className="h-3 w-3 text-gray-400 dark:text-gray-500" />
    }
  }

  const TreeNodeComponent = ({ node, level = 0 }: { node: TreeNode, level?: number }) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = node.expanded || expandedNodes.has(node.id)
    const Icon = node.icon || Folder
    
    return (
      <div>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors",
            selectedNode?.id === node.id && "bg-accent",
            "group"
          )}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={(e) => {
            if (isSelectionMode && node.type === 'container') {
              e.stopPropagation()
              toggleContainerSelection(node.id)
            } else if (node.type === 'container' && node.data && node.ready && !isSelectionMode) {
              openTerminal(node.data)
            } else if (hasChildren) {
              toggleNodeExpansion(node.id)
            }
            setSelectedNode(node)
          }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNodeExpansion(node.id)
              }}
              className="p-0.5 hover:bg-background rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          <Icon className={cn(
            "h-4 w-4 flex-shrink-0",
            node.type === 'cluster' && "text-cyan-500 dark:text-cyan-400",
            node.type === 'namespace' && "text-purple-500 dark:text-purple-400",
            node.type === 'pod' && "text-blue-500 dark:text-blue-400",
            node.type === 'container' && "text-emerald-500 dark:text-emerald-400"
          )} />
          
          <span className="text-sm truncate flex-1">{node.label}</span>
          
          {node.type === 'pod' && (
            <div className="flex items-center gap-1">
              {node.status?.toLowerCase() !== 'running' && getStatusIcon(node.status)}
              <span className="text-xs text-muted-foreground">
                {node.children?.length || 0}
              </span>
            </div>
          )}
          
          {node.type === 'container' && (
            <div className="flex items-center gap-2">
              {isSelectionMode ? (
                <input
                  type="checkbox"
                  checked={selectedContainers.has(node.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleContainerSelection(node.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5"
                />
              ) : node.ready === false ? (
                <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
              ) : (
                <Terminal className="h-3 w-3 text-orange-500 dark:text-orange-400" />
              )}
            </div>
          )}
          
          {node.type === 'namespace' && (
            <Badge variant="outline" className="text-xs px-1 py-0 h-5">
              {node.children?.length || 0} pods
            </Badge>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children?.map(child => (
              <TreeNodeComponent key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {!isFullscreen && <Header />}
      <div className={cn("flex", isFullscreen ? "h-screen" : "h-[calc(100vh-3.5rem)]")}>
        {!isFullscreen && <Sidebar className="hidden lg:block border-r" />}
        
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - File Tree */}
            {!isFullscreen && (
              <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
              <div className="h-full flex flex-col">
                {/* Tree Header */}
                <div className="p-3 border-b space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Pods Explorer</h2>
                    <div className="flex items-center gap-1">
                      <Button
                        variant={isSelectionMode ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          setIsSelectionMode(!isSelectionMode)
                          if (!isSelectionMode) {
                            setSelectedContainers(new Set())
                          }
                        }}
                        title="Toggle selection mode"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refreshData}
                        disabled={isLoading}
                      >
                        <RefreshCw className={cn(
                          "h-4 w-4",
                          isLoading && "animate-spin",
                          "text-blue-500 dark:text-blue-400"
                        )} />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Selection Actions */}
                  {isSelectionMode && (
                    <div className="flex items-center justify-between p-2 bg-accent rounded-md">
                      <span className="text-xs">
                        {selectedContainers.size} container{selectedContainers.size !== 1 ? 's' : ''} selected
                      </span>
                      <Button
                        size="sm"
                        onClick={openSelectedTerminals}
                        disabled={selectedContainers.size === 0}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Open All
                      </Button>
                    </div>
                  )}
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <Input
                      placeholder="Search pods, namespaces, containers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allNodeIds = new Set<string>()
                        treeData.forEach(cluster => {
                          allNodeIds.add(cluster.id)
                          cluster.children?.forEach(ns => {
                            allNodeIds.add(ns.id)
                            ns.children?.forEach(pod => {
                              allNodeIds.add(pod.id)
                            })
                          })
                        })
                        setExpandedNodes(allNodeIds)
                      }}
                      className="text-xs"
                    >
                      Expand All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedNodes(new Set())}
                      className="text-xs"
                    >
                      Collapse All
                    </Button>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0 h-5">
                      <Cloud className="h-2.5 w-2.5 text-cyan-500 dark:text-cyan-400" />
                      <span className="text-[10px] font-medium">{clusters.filter(c => c.connected).length}</span>
                      <span className="text-[10px] text-muted-foreground">clusters</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0 h-5">
                      <Layers className="h-2.5 w-2.5 text-purple-500 dark:text-purple-400" />
                      <span className="text-[10px] font-medium">{namespaces.length}</span>
                      <span className="text-[10px] text-muted-foreground">namespaces</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0 h-5">
                      <Box className="h-2.5 w-2.5 text-blue-500 dark:text-blue-400" />
                      <span className="text-[10px] font-medium">{pods.length}</span>
                      <span className="text-[10px] text-muted-foreground">pods</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0 h-5">
                      <Container className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium">{pods.reduce((acc, p) => acc + p.containers.length, 0)}</span>
                      <span className="text-[10px] text-muted-foreground">containers</span>
                    </Badge>
                  </div>
                </div>
                
                {/* Tree Content */}
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {error ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
                        <p className="text-sm font-medium">Error loading pods</p>
                        <p className="text-xs mt-1">{error}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={refreshData}
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : isLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mb-2 animate-spin text-blue-500 dark:text-blue-400" />
                        <p className="text-sm">Loading pods...</p>
                      </div>
                    ) : treeData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Box className="h-8 w-8 mb-2" />
                        <p className="text-sm font-medium">No pods found</p>
                        <p className="text-xs mt-1 text-center px-4">
                          {clusters.filter(c => c.connected).length === 0 
                            ? "No clusters connected. Please connect to a cluster first."
                            : searchQuery 
                              ? "No results for your search. Try a different query."
                              : "No pods available in the selected clusters."}
                        </p>
                      </div>
                    ) : (
                      treeData.map(node => (
                        <TreeNodeComponent key={node.id} node={node} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
              </ResizablePanel>
            )}

            {!isFullscreen && <ResizableHandle withHandle />}

            {/* Right Panel - Terminals */}
            <ResizablePanel defaultSize={isFullscreen ? 100 : 65} minSize={isFullscreen ? 100 : 50}>
              <div className="h-full flex flex-col">
                {/* Terminal Header - Always visible for fullscreen toggle */}
                <div className="border-b px-3 py-1 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {terminals.length} Terminal{terminals.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" /> : <Maximize2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />}
                    </Button>
                    {terminals.length > 0 && (
                      <>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button
                          variant={syncInputEnabled ? 'secondary' : 'ghost'}
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            syncInputEnabled && "bg-primary/10 hover:bg-primary/20"
                          )}
                          onClick={toggleSyncInput}
                          title={syncInputEnabled ? "Disable synchronized input" : "Enable synchronized input (like tmux)"}
                        >
                          {syncInputEnabled ? <Link className="h-3.5 w-3.5 text-green-500 dark:text-green-400" /> : <Unlink className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setShowBroadcast(!showBroadcast)}
                          title="Broadcast command to all terminals"
                        >
                          <Command className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setShowCloseAllDialog(true)}
                          title="Close all terminals"
                        >
                          <X className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button
                          variant={viewMode === 'tabs' ? 'secondary' : 'ghost'}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewMode('tabs')}
                          title="Tab view"
                        >
                          <List className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                        </Button>
                        <Button
                          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewMode('grid')}
                          title="Grid view"
                        >
                          <Grid3x3 className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {terminals.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <Terminal className="h-12 w-12 mb-4 text-orange-500 dark:text-orange-400" />
                    <p className="text-lg font-medium">No Active Terminals</p>
                    <p className="text-sm mt-2">
                      {isSelectionMode 
                        ? "Select containers and click 'Open All' to open multiple terminals"
                        : "Select a container from the tree to open a terminal"}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Sync Input Indicator */}
                    {syncInputEnabled && (
                      <div className="border-b px-3 py-1 bg-yellow-500/10 border-yellow-500/20">
                        <div className="flex items-center gap-2">
                          <Link className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">
                            Sync Active - Input mirrored to {terminals.length} terminals
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Broadcast Command Bar */}
                    {showBroadcast && (
                      <div className="border-b px-3 py-1.5 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Send className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                            <span className="text-xs">Broadcast:</span>
                          </div>
                          <Input
                            value={broadcastCommand}
                            onChange={(e) => setBroadcastCommand(e.target.value)}
                            onKeyPress={handleBroadcastKeyPress}
                            placeholder="Command for all terminals..."
                            className="flex-1 h-7 text-xs"
                          />
                          <Button
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleBroadcastCommand}
                            disabled={!broadcastCommand.trim()}
                          >
                            <Send className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                          </Button>
                        </div>
                      </div>
                    )}


                    {/* View Modes */}
                    {viewMode === 'tabs' ? (
                      <Tabs value={activeTerminalId || undefined} onValueChange={setActiveTerminalId} className="flex-1 flex flex-col">
                        <div className="border-b bg-muted/30">
                          <div className="px-2 py-1">
                            <TabsList className="h-auto p-0 bg-transparent justify-start overflow-x-auto flex gap-1">
                              {terminals.map(terminal => {
                                const isActive = activeTerminalId === terminal.id
                                return (
                                  <div key={terminal.id} className="relative inline-flex">
                                    <TabsTrigger
                                      value={terminal.id}
                                      className={cn(
                                        "relative flex items-center gap-2 min-w-fit pr-8 px-3 py-1.5 rounded-t-md border border-b-0",
                                        "bg-muted/50 hover:bg-muted/70 transition-colors",
                                        "data-[state=active]:bg-background data-[state=active]:border-border",
                                        "data-[state=active]:shadow-sm data-[state=active]:z-10",
                                        "data-[state=inactive]:border-transparent"
                                      )}
                                    >
                                      <Terminal className={cn(
                                        "text-orange-500 dark:text-orange-400",
                                        "h-3 w-3",
                                        isActive ? "text-foreground" : "text-muted-foreground"
                                      )} />
                                      <span className={cn(
                                        "text-xs truncate max-w-[150px]",
                                        isActive && "font-medium"
                                      )}>
                                        {terminal.title}
                                      </span>
                                    </TabsTrigger>
                                    <button
                                      className={cn(
                                        "absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 rounded flex items-center justify-center group transition-colors",
                                        isActive 
                                          ? "hover:bg-destructive/20 bg-muted/50" 
                                          : "hover:bg-destructive/20"
                                      )}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        closeTerminal(terminal.id)
                                      }}
                                    >
                                      <X className={cn(
                                        "h-3 w-3 transition-colors",
                                        isActive 
                                          ? "text-muted-foreground group-hover:text-destructive" 
                                          : "text-muted-foreground/70 group-hover:text-destructive"
                                      )} />
                                    </button>
                                  </div>
                                )
                              })}
                            </TabsList>
                          </div>
                        </div>
                        
                        <div className="flex-1 overflow-hidden relative">
                          {terminals.map(terminal => {
                            const isActive = activeTerminalId === terminal.id
                            return (
                              <div
                                key={terminal.id}
                                className="absolute inset-0 p-4"
                                style={{
                                  visibility: isActive ? 'visible' : 'hidden',
                                  pointerEvents: isActive ? 'auto' : 'none'
                                }}
                              >
                                <div className="h-full flex flex-col">
                                  <div className="flex items-center justify-between pb-2">
                                    <div className="text-xs text-muted-foreground space-x-4">
                                      <span>Cluster: <strong>{terminal.cluster}</strong></span>
                                      <span>Namespace: <strong>{terminal.namespace}</strong></span>
                                      <span>Pod: <strong>{terminal.podName}</strong></span>
                                      <span>Container: <strong>{terminal.containerName}</strong></span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 bg-black overflow-hidden">
                                    <ManagedTerminal
                                      key={terminal.id}
                                      id={terminal.id}
                                      cluster={terminal.cluster}
                                      namespace={terminal.namespace}
                                      podName={terminal.podName}
                                      containerName={terminal.containerName}
                                      isVisible={isActive}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </Tabs>
                      ) : (
                        /* Grid View */
                        <div className="flex-1 overflow-auto p-4">
                          <div className={cn(
                            "grid gap-4 h-full auto-rows-fr",
                            terminals.length === 1 && "grid-cols-1",
                            terminals.length === 2 && "grid-cols-2",
                            terminals.length === 3 && "grid-cols-2 grid-rows-2",
                            terminals.length >= 4 && "grid-cols-2 grid-rows-2",
                          )}
                          style={{
                            gridAutoColumns: '1fr',
                            gridAutoRows: '1fr'
                          }}>
                            {terminals.map((terminal, index) => {
                              const shouldShow = index < 4
                              return (
                                <div
                                  key={terminal.id}
                                  className="border rounded-lg flex flex-col bg-background overflow-hidden min-w-0"
                                  style={{
                                    display: shouldShow ? 'flex' : 'none',
                                    minWidth: 0
                                  }}
                                >
                                  {/* Terminal Header with Close Button */}
                                  <div className="border-b px-3 py-2 flex items-center justify-between bg-muted/30">
                                    <div className="flex items-center gap-2">
                                      <Terminal className="h-3 w-3 text-orange-500 dark:text-orange-400" />
                                      <span className="text-xs font-medium truncate">
                                        {terminal.title}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => closeTerminal(terminal.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  
                                  {/* Terminal Context Info - Same as list view */}
                                  <div className="px-3 py-2 border-b">
                                    <div className="text-xs text-muted-foreground space-x-4">
                                      <span>Cluster: <strong>{terminal.cluster}</strong></span>
                                      <span>Namespace: <strong>{terminal.namespace}</strong></span>
                                      <span>Pod: <strong>{terminal.podName}</strong></span>
                                      <span>Container: <strong>{terminal.containerName}</strong></span>
                                    </div>
                                  </div>
                                  
                                  {/* Terminal Content */}
                                  <div className="flex-1 bg-black w-full" style={{ minHeight: '200px', minWidth: 0 }}>
                                    <ManagedTerminal
                                      key={terminal.id}
                                      id={terminal.id}
                                      cluster={terminal.cluster}
                                      namespace={terminal.namespace}
                                      podName={terminal.podName}
                                      containerName={terminal.containerName}
                                      isVisible={shouldShow}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            
                            {terminals.length > 4 && (
                              <div className="border rounded-lg flex items-center justify-center bg-muted/10 col-span-2">
                                <p className="text-sm text-muted-foreground">
                                  +{terminals.length - 4} more terminals
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      
      {/* Close All Terminals Dialog */}
      <AlertDialog open={showCloseAllDialog} onOpenChange={setShowCloseAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close All Terminals</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close all {terminals.length} terminal{terminals.length !== 1 ? 's' : ''}? 
              This will terminate the shell processes in the containers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                terminalManager.closeAllTerminals()
                setTerminals([])
                setActiveTerminalId(null)
                setShowCloseAllDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}