import { useEffect, useState } from 'react'
import { type ColumnDef } from "@tanstack/react-table"
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { DataTableAdvanced } from "@/components/ui/data-table-advanced"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, Filter, X, Terminal, MoreHorizontal, Trash2, FileText } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { resourcesService, type PodInfo, type NamespaceInfo } from '@/services/resources.service'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ResourceDetailsDrawer } from '@/components/resource-details-drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PodTerminalWebSocket } from '@/components/pod-terminal-websocket'
import { podsService } from '@/services/pods.service'

export function PodsPage() {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [filteredPods, setFilteredPods] = useState<PodInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namespace, setNamespace] = useState('all')  // 'all' means all namespaces
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [labelFilter, setLabelFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [selectedClustersFilter, setSelectedClustersFilter] = useState<string[]>([])
  const [selectedPod, setSelectedPod] = useState<PodInfo | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalPod, setTerminalPod] = useState<PodInfo | null>(null)
  
  const { currentContext, selectedContexts, clusters } = useClusterStore()
  
  // Use selected contexts if available, otherwise fall back to current context
  const contextsToFetch = selectedContexts.length > 0 ? selectedContexts : (currentContext ? [currentContext] : [])

  const fetchNamespaces = async () => {
    if (contextsToFetch.length === 0) return
    
    try {
      const allNamespaces: NamespaceInfo[] = []
      
      await Promise.all(
        contextsToFetch.map(async (context) => {
          try {
            const response = await resourcesService.listNamespaces(context)
            allNamespaces.push(...response.items)
          } catch (err) {
            console.error(`Failed to fetch namespaces from ${context}:`, err)
          }
        })
      )
      
      // Remove duplicates by name
      const uniqueNamespaces = Array.from(
        new Map(allNamespaces.map(ns => [ns.name, ns])).values()
      )
      setNamespaces(uniqueNamespaces)
    } catch (err) {
      console.error('Failed to fetch namespaces:', err)
    }
  }

  const fetchPods = async () => {
    console.log('fetchPods called with contextsToFetch:', contextsToFetch)
    console.log('selectedContexts:', selectedContexts)
    console.log('currentContext:', currentContext)
    
    if (contextsToFetch.length === 0) {
      setError('No cluster selected')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const allPods: PodInfo[] = []
      
      // Fetch pods from all selected clusters
      await Promise.all(
        contextsToFetch.map(async (context) => {
          try {
            const response = await resourcesService.listPods({ 
              context,
              namespace: namespace === 'all' ? undefined : namespace
            })
            // Add cluster context to each pod for identification
            const podsWithCluster = response.items.map(pod => ({
              ...pod,
              cluster: context
            }))
            allPods.push(...podsWithCluster)
          } catch (err) {
            console.error(`Failed to fetch pods from ${context}:`, err)
          }
        })
      )
      
      setPods(allPods)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pods')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters to pods
  const applyFilters = () => {
    let filtered = [...pods]
    
    // Filter by name
    if (nameFilter) {
      filtered = filtered.filter(pod => 
        pod.name.toLowerCase().includes(nameFilter.toLowerCase())
      )
    }
    
    // Filter by selected clusters
    if (selectedClustersFilter.length > 0) {
      filtered = filtered.filter(pod => 
        pod.cluster && selectedClustersFilter.includes(pod.cluster)
      )
    }
    
    // Filter by status
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(pod => 
        selectedStatuses.includes(pod.status)
      )
    }
    
    // Filter by label
    if (labelFilter) {
      filtered = filtered.filter(pod => {
        const labelString = Object.entries(pod.labels || {})
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
        return labelString.toLowerCase().includes(labelFilter.toLowerCase())
      })
    }
    
    setFilteredPods(filtered)
  }

  useEffect(() => {
    fetchPods()
    fetchNamespaces()
  }, [selectedContexts, currentContext, namespace])
  
  useEffect(() => {
    applyFilters()
  }, [pods, selectedClustersFilter, selectedStatuses, labelFilter, nameFilter])
  
  // Get unique statuses from pods
  const availableStatuses = Array.from(new Set(pods.map(pod => pod.status)))

  const handlePodClick = (pod: PodInfo) => {
    setSelectedPod(pod)
    setDrawerOpen(true)
  }
  
  const handleNextPod = () => {
    if (!selectedPod || !filteredPods) return
    const currentIndex = filteredPods.findIndex(p => p.name === selectedPod.name && p.namespace === selectedPod.namespace)
    if (currentIndex < filteredPods.length - 1) {
      setSelectedPod(filteredPods[currentIndex + 1])
    }
  }
  
  const handlePreviousPod = () => {
    if (!selectedPod || !filteredPods) return
    const currentIndex = filteredPods.findIndex(p => p.name === selectedPod.name && p.namespace === selectedPod.namespace)
    if (currentIndex > 0) {
      setSelectedPod(filteredPods[currentIndex - 1])
    }
  }

  const columns: ColumnDef<PodInfo>[] = [
    {
      accessorKey: "cluster",
      header: "Cluster",
      cell: ({ row }) => {
        const cluster = row.getValue("cluster") as string
        return <Badge variant="outline" className="text-xs">{cluster}</Badge>
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const pod = row.original
        return (
          <span className="font-medium">
            {pod.name}
          </span>
        )
      },
    },
    {
      accessorKey: "namespace",
      header: "Namespace",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const variant = status === "Running" ? "default" : 
                       status === "Pending" ? "secondary" : 
                       status === "Failed" ? "destructive" : "outline"
        return <Badge variant={variant}>{status}</Badge>
      },
    },
    {
      accessorKey: "ready",
      header: "Ready",
    },
    {
      accessorKey: "restarts",
      header: "Restarts",
    },
    {
      accessorKey: "age",
      header: "Age",
    },
    {
      accessorKey: "ip",
      header: "IP",
    },
    {
      accessorKey: "node",
      header: "Node",
    },
    {
      id: 'actions',
      header: "Actions",
      cell: ({ row }) => {
        const pod = row.original
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setTerminalPod(pod)
                  setTerminalOpen(true)
                }}
              >
                <Terminal className="mr-2 h-4 w-4" />
                Open Terminal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handlePodClick(pod)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (confirm(`Delete pod ${pod.name}?`)) {
                    try {
                      await podsService.deletePod(
                        pod.cluster || currentContext || '',
                        pod.namespace,
                        pod.name
                      )
                      fetchPods()
                    } catch (error) {
                      console.error('Failed to delete pod:', error)
                    }
                  }
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          <div className="flex flex-col space-y-2">
            {/* Header with title and refresh */}
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-semibold">Pods</h2>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredPods?.length || 0} of {pods?.length || 0} pods
                </p>
              </div>
              <Button 
                onClick={() => {
                  fetchPods()
                  fetchNamespaces()
                }}
                disabled={loading}
                size="sm"
                className="h-7"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {/* Compact Filters Row */}
            <div className="flex items-center gap-2 mb-2">
              {/* Name Search - moved here from DataTable */}
              <Input
                placeholder="Filter name..."
                className="w-[150px] h-7 text-xs"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
              
              {/* Namespace Filter */}
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
                  <SelectValue placeholder="Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Namespaces</SelectItem>
                  {namespaces.map(ns => (
                    <SelectItem key={ns.name} value={ns.name}>
                      {ns.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Cluster Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                    <Filter className="h-3 w-3 mr-1" />
                    Clusters
                    {selectedClustersFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-3 px-1 text-xs">
                        {selectedClustersFilter.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Filter by Cluster</h4>
                    {contextsToFetch.map(context => (
                      <div key={context} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cluster-${context}`}
                          checked={selectedClustersFilter.includes(context)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedClustersFilter([...selectedClustersFilter, context])
                            } else {
                              setSelectedClustersFilter(selectedClustersFilter.filter(c => c !== context))
                            }
                          }}
                        />
                        <Label
                          htmlFor={`cluster-${context}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {context}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Status Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                    <Filter className="h-3 w-3 mr-1" />
                    Status
                    {selectedStatuses.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-3 px-1 text-xs">
                        {selectedStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Filter by Status</h4>
                    {availableStatuses.map(status => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={selectedStatuses.includes(status)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStatuses([...selectedStatuses, status])
                            } else {
                              setSelectedStatuses(selectedStatuses.filter(s => s !== status))
                            }
                          }}
                        />
                        <Label
                          htmlFor={`status-${status}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {status}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Label Filter */}
              <Input
                placeholder="Filter by labels (e.g., app=nginx)"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                className="w-[200px] h-7 text-xs"
              />
              
              {/* Clear Filters */}
              {(selectedClustersFilter.length > 0 || selectedStatuses.length > 0 || labelFilter || nameFilter || namespace !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    setSelectedClustersFilter([])
                    setSelectedStatuses([])
                    setLabelFilter('')
                    setNameFilter('')
                    setNamespace('all')
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {error ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                </CardContent>
              </Card>
            ) : contextsToFetch.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">No cluster selected</p>
                    <p className="text-sm text-muted-foreground">
                      Please select a cluster from the dropdown above to view pods
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div>
                <DataTableAdvanced 
                  columns={columns} 
                  data={filteredPods || []}
                  onRowClick={handlePodClick}
                  showColumnVisibility={true}
                  showPagination={true}
                />
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Resource Details Drawer */}
      <ResourceDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resource={selectedPod}
        resourceType="pod"
        context={selectedPod?.cluster || currentContext}
        onNext={handleNextPod}
        onPrevious={handlePreviousPod}
        hasNext={selectedPod && filteredPods ? filteredPods.findIndex(p => p.name === selectedPod.name && p.namespace === selectedPod.namespace) < filteredPods.length - 1 : false}
        hasPrevious={selectedPod && filteredPods ? filteredPods.findIndex(p => p.name === selectedPod.name && p.namespace === selectedPod.namespace) > 0 : false}
        currentIndex={selectedPod && filteredPods ? filteredPods.findIndex(p => p.name === selectedPod.name && p.namespace === selectedPod.namespace) + 1 : 0}
        totalCount={filteredPods?.length || 0}
      />
      
      {/* Pod Terminal */}
      {terminalPod && (
        <PodTerminalWebSocket
          open={terminalOpen}
          onOpenChange={setTerminalOpen}
          cluster={terminalPod.cluster || currentContext || ''}
          namespace={terminalPod.namespace}
          podName={terminalPod.name}
          containers={terminalPod.containers}
        />
      )}
    </div>
  )
}