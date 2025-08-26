import { useState, useEffect } from 'react'
import { type ColumnDef } from "@tanstack/react-table"
import { useClusterStore } from '@/stores/cluster.store'
import { DataTableAdvanced } from "@/components/ui/data-table-advanced"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw, AlertCircle, Filter, X, Scale, RotateCw, Trash2 } from 'lucide-react'
import { deploymentsService, type DeploymentInfo, type DeploymentDetail } from '@/services/deployments.service'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from 'lucide-react'
import { resourcesService, type NamespaceInfo } from '@/services/resources.service'
import { ResourceDetailsDrawer } from '@/components/resource-details-drawer'

export default function Deployments() {
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [filteredDeployments, setFilteredDeployments] = useState<DeploymentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namespace, setNamespace] = useState('all')
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([])
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [selectedClustersFilter, setSelectedClustersFilter] = useState<string[]>([])
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentInfo | null>(null)
  const [deploymentDetail, setDeploymentDetail] = useState<DeploymentDetail | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newReplicas, setNewReplicas] = useState<number>(1)
  
  const { currentContext, selectedContexts } = useClusterStore()
  
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

  const fetchDeployments = async () => {
    if (contextsToFetch.length === 0) {
      setError('No cluster selected')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const allDeployments: DeploymentInfo[] = []
      
      // Fetch deployments from all selected clusters
      await Promise.all(
        contextsToFetch.map(async (context) => {
          try {
            const namespacesToFetch = namespace === 'all' ? undefined : [namespace]
            const data = await deploymentsService.listDeployments([context], namespacesToFetch)
            // Add cluster context to each deployment for identification
            const deploymentsWithCluster = data.map(deployment => ({
              ...deployment,
              cluster: context
            }))
            allDeployments.push(...deploymentsWithCluster)
          } catch (err) {
            console.error(`Failed to fetch deployments from ${context}:`, err)
          }
        })
      )
      
      setDeployments(allDeployments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deployments')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters to deployments
  const applyFilters = () => {
    let filtered = [...deployments]
    
    // Filter by name
    if (nameFilter) {
      filtered = filtered.filter(deployment => 
        deployment.name.toLowerCase().includes(nameFilter.toLowerCase())
      )
    }
    
    // Filter by selected clusters
    if (selectedClustersFilter.length > 0) {
      filtered = filtered.filter(deployment => 
        deployment.cluster && selectedClustersFilter.includes(deployment.cluster)
      )
    }
    
    // Filter by strategy
    if (selectedStrategies.length > 0) {
      filtered = filtered.filter(deployment => 
        selectedStrategies.includes(deployment.strategy)
      )
    }
    
    setFilteredDeployments(filtered)
  }

  useEffect(() => {
    fetchDeployments()
    fetchNamespaces()
  }, [selectedContexts, currentContext, namespace])
  
  useEffect(() => {
    applyFilters()
  }, [deployments, selectedClustersFilter, selectedStrategies, nameFilter])
  
  // Get unique strategies from deployments
  const availableStrategies = Array.from(new Set(deployments.map(d => d.strategy).filter(Boolean)))

  const handleDeploymentClick = async (deployment: DeploymentInfo) => {
    setSelectedDeployment(deployment)
    
    // Fetch detailed deployment info
    try {
      const cluster = deployment.cluster || contextsToFetch[0]
      const detail = await deploymentsService.getDeployment(
        cluster,
        deployment.namespace,
        deployment.name
      )
      setDeploymentDetail(detail)
      setDrawerOpen(true)
    } catch (err) {
      console.error('Failed to fetch deployment details:', err)
      // Still open drawer with basic info
      setDrawerOpen(true)
    }
  }
  
  const handleNextDeployment = () => {
    if (!selectedDeployment || !filteredDeployments) return
    const currentIndex = filteredDeployments.findIndex(d => 
      d.name === selectedDeployment.name && d.namespace === selectedDeployment.namespace
    )
    if (currentIndex < filteredDeployments.length - 1) {
      handleDeploymentClick(filteredDeployments[currentIndex + 1])
    }
  }
  
  const handlePreviousDeployment = () => {
    if (!selectedDeployment || !filteredDeployments) return
    const currentIndex = filteredDeployments.findIndex(d => 
      d.name === selectedDeployment.name && d.namespace === selectedDeployment.namespace
    )
    if (currentIndex > 0) {
      handleDeploymentClick(filteredDeployments[currentIndex - 1])
    }
  }

  const handleScale = async () => {
    if (!selectedDeployment) return

    try {
      const cluster = selectedDeployment.cluster || contextsToFetch[0]
      await deploymentsService.scaleDeployment(
        cluster,
        selectedDeployment.namespace,
        selectedDeployment.name,
        newReplicas
      )
      setScaleDialogOpen(false)
      fetchDeployments() // Refresh the list
    } catch (error) {
      console.error('Failed to scale deployment:', error)
    }
  }

  const handleRestart = async (deployment: DeploymentInfo) => {
    try {
      const cluster = deployment.cluster || contextsToFetch[0]
      await deploymentsService.restartDeployment(
        cluster,
        deployment.namespace,
        deployment.name
      )
      fetchDeployments() // Refresh the list
    } catch (error) {
      console.error('Failed to restart deployment:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedDeployment) return

    try {
      const cluster = selectedDeployment.cluster || contextsToFetch[0]
      await deploymentsService.deleteDeployment(
        cluster,
        selectedDeployment.namespace,
        selectedDeployment.name
      )
      setDeleteDialogOpen(false)
      setDrawerOpen(false)
      fetchDeployments() // Refresh the list
    } catch (error) {
      console.error('Failed to delete deployment:', error)
    }
  }

  const columns: ColumnDef<DeploymentInfo>[] = [
    {
      accessorKey: "cluster",
      header: "Cluster",
      cell: ({ row }) => {
        const cluster = row.getValue("cluster") as string
        return cluster ? <Badge variant="outline" className="text-xs">{cluster}</Badge> : null
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const deployment = row.original
        return (
          <span className="font-medium">
            {deployment.name}
          </span>
        )
      },
    },
    {
      accessorKey: "namespace",
      header: "Namespace",
    },
    {
      accessorKey: "replicas",
      header: "Replicas",
      cell: ({ row }) => {
        const replicas = row.getValue("replicas") as string
        if (!replicas) return <span className="text-muted-foreground">-</span>
        
        const [ready, desired] = replicas.split('/')
        const isHealthy = ready === desired
        return (
          <Badge variant={isHealthy ? 'default' : 'destructive'}>
            {replicas}
          </Badge>
        )
      },
    },
    {
      accessorKey: "images",
      header: "Images",
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          {row.original.images?.slice(0, 1).map((image, i) => (
            <div key={i} className="text-xs text-muted-foreground truncate" title={image}>
              {image.split('/').pop()?.split(':')[0]}
            </div>
          )) || <span className="text-xs text-muted-foreground">-</span>}
        </div>
      ),
    },
    {
      accessorKey: "strategy",
      header: "Strategy",
      cell: ({ row }) => {
        const strategy = row.getValue("strategy") as string
        return strategy ? (
          <Badge variant="secondary" className="text-xs">{strategy}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: "age",
      header: "Age",
    },
    {
      accessorKey: "conditions",
      header: "Conditions",
      cell: ({ row }) => {
        const conditions = row.original.conditions
        if (!conditions || conditions.length === 0) {
          return <span className="text-xs text-muted-foreground">-</span>
        }
        
        const hasProgressing = conditions.includes('Progressing')
        const hasAvailable = conditions.includes('Available')
        
        if (hasProgressing && hasAvailable) {
          return <Badge variant="default" className="text-xs">Healthy</Badge>
        } else if (hasProgressing) {
          return <Badge variant="secondary" className="text-xs">Progressing</Badge>
        } else {
          return <Badge variant="outline" className="text-xs">{conditions[0]}</Badge>
        }
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const deployment = row.original
        
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
                  setSelectedDeployment(deployment)
                  const [ready] = deployment.replicas?.split('/') || ['1']
                  setNewReplicas(parseInt(ready) || 1)
                  setScaleDialogOpen(true)
                }}
              >
                <Scale className="mr-2 h-4 w-4" />
                Scale
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRestart(deployment)}>
                <RotateCw className="mr-2 h-4 w-4" />
                Restart
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedDeployment(deployment)
                  setDeleteDialogOpen(true)
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
    <div className="flex flex-col space-y-2">
      {/* Header with title and refresh */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-lg font-semibold">Deployments</h2>
          <p className="text-xs text-muted-foreground">
            Showing {filteredDeployments?.length || 0} of {deployments?.length || 0} deployments
          </p>
        </div>
        <Button 
          onClick={() => {
            fetchDeployments()
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
        {/* Name Search */}
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
        {contextsToFetch.length > 1 && (
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
        )}
        
        {/* Strategy Filter */}
        {availableStrategies.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <Filter className="h-3 w-3 mr-1" />
                Strategy
                {selectedStrategies.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-3 px-1 text-xs">
                    {selectedStrategies.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by Strategy</h4>
                {availableStrategies.map(strategy => (
                  <div key={strategy} className="flex items-center space-x-2">
                    <Checkbox
                      id={`strategy-${strategy}`}
                      checked={selectedStrategies.includes(strategy)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStrategies([...selectedStrategies, strategy])
                        } else {
                          setSelectedStrategies(selectedStrategies.filter(s => s !== strategy))
                        }
                      }}
                    />
                    <Label
                      htmlFor={`strategy-${strategy}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {strategy}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {/* Clear Filters */}
        {(selectedClustersFilter.length > 0 || selectedStrategies.length > 0 || nameFilter || namespace !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => {
              setSelectedClustersFilter([])
              setSelectedStrategies([])
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
                Please select a cluster from the dropdown above to view deployments
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <DataTableAdvanced 
            columns={columns} 
            data={filteredDeployments || []}
            onRowClick={handleDeploymentClick}
            showColumnVisibility={true}
            showPagination={true}
          />
        </div>
      )}

      {/* Resource Details Drawer */}
      <ResourceDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resource={deploymentDetail || selectedDeployment}
        resourceType="deployment"
        context={selectedDeployment?.cluster || currentContext}
        onNext={handleNextDeployment}
        onPrevious={handlePreviousDeployment}
        hasNext={selectedDeployment && filteredDeployments ? 
          filteredDeployments.findIndex(d => 
            d.name === selectedDeployment.name && d.namespace === selectedDeployment.namespace
          ) < filteredDeployments.length - 1 : false}
        hasPrevious={selectedDeployment && filteredDeployments ? 
          filteredDeployments.findIndex(d => 
            d.name === selectedDeployment.name && d.namespace === selectedDeployment.namespace
          ) > 0 : false}
        currentIndex={selectedDeployment && filteredDeployments ? 
          filteredDeployments.findIndex(d => 
            d.name === selectedDeployment.name && d.namespace === selectedDeployment.namespace
          ) + 1 : 0}
        totalCount={filteredDeployments?.length || 0}
      />

      {/* Scale Dialog */}
      <Dialog open={scaleDialogOpen} onOpenChange={setScaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scale Deployment</DialogTitle>
            <DialogDescription>
              Scale {selectedDeployment?.name} in {selectedDeployment?.namespace}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replicas" className="text-right">
                Replicas
              </Label>
              <Input
                id="replicas"
                type="number"
                min="0"
                value={newReplicas}
                onChange={(e) => setNewReplicas(parseInt(e.target.value) || 0)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScale}>Scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deployment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedDeployment?.name} from {selectedDeployment?.namespace}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}