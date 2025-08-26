import { useState, useEffect } from 'react'
import { type ColumnDef } from "@tanstack/react-table"
import { useClusterStore } from '@/stores/cluster.store'
import { DataTableAdvanced } from "@/components/ui/data-table-advanced"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw, AlertCircle, Filter, X, Trash2, Edit, Network } from 'lucide-react'
import { servicesService, type ServiceInfo, type ServiceDetail } from '@/services/services.service'
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

export default function Services() {
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [filteredServices, setFilteredServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namespace, setNamespace] = useState('all')
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [selectedClustersFilter, setSelectedClustersFilter] = useState<string[]>([])
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null)
  const [serviceDetail, setServiceDetail] = useState<ServiceDetail | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
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

  const fetchServices = async () => {
    if (contextsToFetch.length === 0) {
      setError('No cluster selected')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const allServices: ServiceInfo[] = []
      
      // Fetch services from all selected clusters
      await Promise.all(
        contextsToFetch.map(async (context) => {
          try {
            const namespacesToFetch = namespace === 'all' ? undefined : [namespace]
            const data = await servicesService.listServices([context], namespacesToFetch)
            // Add cluster context to each service for identification
            const servicesWithCluster = data.map(service => ({
              ...service,
              cluster: context
            }))
            allServices.push(...servicesWithCluster)
          } catch (err) {
            console.error(`Failed to fetch services from ${context}:`, err)
          }
        })
      )
      
      setServices(allServices)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters to services
  const applyFilters = () => {
    let filtered = [...services]
    
    // Filter by name
    if (nameFilter) {
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(nameFilter.toLowerCase())
      )
    }
    
    // Filter by selected clusters
    if (selectedClustersFilter.length > 0) {
      filtered = filtered.filter(service => 
        service.cluster && selectedClustersFilter.includes(service.cluster)
      )
    }
    
    // Filter by service type
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(service => 
        selectedTypes.includes(service.type)
      )
    }
    
    setFilteredServices(filtered)
  }

  useEffect(() => {
    fetchServices()
    fetchNamespaces()
  }, [selectedContexts, currentContext, namespace])
  
  useEffect(() => {
    applyFilters()
  }, [services, selectedClustersFilter, selectedTypes, nameFilter])
  
  // Get unique service types from services
  const availableTypes = Array.from(new Set(services.map(s => s.type).filter(Boolean)))

  const handleServiceClick = async (service: ServiceInfo) => {
    setSelectedService(service)
    
    // Fetch detailed service info
    try {
      const cluster = service.cluster || contextsToFetch[0]
      const detail = await servicesService.getService(
        cluster,
        service.namespace,
        service.name
      )
      setServiceDetail(detail)
      setDrawerOpen(true)
    } catch (err) {
      console.error('Failed to fetch service details:', err)
      // Still open drawer with basic info
      setDrawerOpen(true)
    }
  }
  
  const handleNextService = () => {
    if (!selectedService || !filteredServices) return
    const currentIndex = filteredServices.findIndex(s => 
      s.name === selectedService.name && s.namespace === selectedService.namespace
    )
    if (currentIndex < filteredServices.length - 1) {
      handleServiceClick(filteredServices[currentIndex + 1])
    }
  }
  
  const handlePreviousService = () => {
    if (!selectedService || !filteredServices) return
    const currentIndex = filteredServices.findIndex(s => 
      s.name === selectedService.name && s.namespace === selectedService.namespace
    )
    if (currentIndex > 0) {
      handleServiceClick(filteredServices[currentIndex - 1])
    }
  }

  const handleDelete = async () => {
    if (!selectedService) return

    try {
      const cluster = selectedService.cluster || contextsToFetch[0]
      await servicesService.deleteService(
        cluster,
        selectedService.namespace,
        selectedService.name
      )
      setDeleteDialogOpen(false)
      setDrawerOpen(false)
      fetchServices() // Refresh the list
    } catch (error) {
      console.error('Failed to delete service:', error)
    }
  }

  const getServiceTypeVariant = (type: string) => {
    switch (type) {
      case 'ClusterIP':
        return 'default'
      case 'NodePort':
        return 'secondary'
      case 'LoadBalancer':
        return 'outline'
      case 'ExternalName':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const columns: ColumnDef<ServiceInfo>[] = [
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
        const service = row.original
        return (
          <span className="font-medium">
            {service.name}
          </span>
        )
      },
    },
    {
      accessorKey: "namespace",
      header: "Namespace",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string
        return (
          <Badge variant={getServiceTypeVariant(type) as any} className="text-xs">
            {type}
          </Badge>
        )
      },
    },
    {
      accessorKey: "clusterIP",
      header: "Cluster IP",
      cell: ({ row }) => {
        const ip = row.getValue("clusterIP") as string
        return ip === 'None' ? (
          <span className="text-xs text-muted-foreground">None (Headless)</span>
        ) : (
          <span className="font-mono text-xs">{ip || '-'}</span>
        )
      },
    },
    {
      accessorKey: "externalIP",
      header: "External IP",
      cell: ({ row }) => {
        const ip = row.original.externalIP
        return ip ? (
          <span className="font-mono text-xs">{ip}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: "ports",
      header: "Ports",
      cell: ({ row }) => {
        const ports = row.getValue("ports") as string[]
        if (!ports || ports.length === 0) {
          return <span className="text-xs text-muted-foreground">-</span>
        }
        return (
          <div className="max-w-[200px]">
            <span className="text-xs font-mono">
              {ports.slice(0, 2).join(', ')}
              {ports.length > 2 && ` +${ports.length - 2} more`}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "age",
      header: "Age",
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const service = row.original
        
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
                onClick={() => handleServiceClick(service)}
              >
                <Network className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedService(service)
                  // TODO: Open edit dialog
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedService(service)
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
          <h2 className="text-lg font-semibold">Services</h2>
          <p className="text-xs text-muted-foreground">
            Showing {filteredServices?.length || 0} of {services?.length || 0} services
          </p>
        </div>
        <Button 
          onClick={() => {
            fetchServices()
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
        
        {/* Service Type Filter */}
        {availableTypes.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <Filter className="h-3 w-3 mr-1" />
                Type
                {selectedTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-3 px-1 text-xs">
                    {selectedTypes.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by Type</h4>
                {availableTypes.map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTypes([...selectedTypes, type])
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type))
                        }
                      }}
                    />
                    <Label
                      htmlFor={`type-${type}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {/* Clear Filters */}
        {(selectedClustersFilter.length > 0 || selectedTypes.length > 0 || nameFilter || namespace !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => {
              setSelectedClustersFilter([])
              setSelectedTypes([])
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
                Please select a cluster from the dropdown above to view services
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <DataTableAdvanced 
            columns={columns} 
            data={filteredServices || []}
            onRowClick={handleServiceClick}
            showColumnVisibility={true}
            showPagination={true}
          />
        </div>
      )}

      {/* Resource Details Drawer */}
      <ResourceDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resource={serviceDetail || selectedService}
        resourceType="service"
        context={selectedService?.cluster || currentContext}
        onNext={handleNextService}
        onPrevious={handlePreviousService}
        hasNext={selectedService && filteredServices ? 
          filteredServices.findIndex(s => 
            s.name === selectedService.name && s.namespace === selectedService.namespace
          ) < filteredServices.length - 1 : false}
        hasPrevious={selectedService && filteredServices ? 
          filteredServices.findIndex(s => 
            s.name === selectedService.name && s.namespace === selectedService.namespace
          ) > 0 : false}
        currentIndex={selectedService && filteredServices ? 
          filteredServices.findIndex(s => 
            s.name === selectedService.name && s.namespace === selectedService.namespace
          ) + 1 : 0}
        totalCount={filteredServices?.length || 0}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedService?.name} from {selectedService?.namespace}?
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