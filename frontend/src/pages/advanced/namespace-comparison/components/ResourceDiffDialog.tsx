import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  AlertCircle, 
  Check, 
  X, 
  MinusCircle,
  PlusCircle,
  ArrowRight,
  Box,
  Database,
  Network,
  Shield,
  Key,
  HardDrive,
  Globe,
  Clock,
  Layers,
  Activity,
  Server
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ResourceDetails {
  name: string
  status?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  details?: any
}

interface ResourceDiffDialogProps {
  isOpen: boolean
  onClose: () => void
  resourceType: string
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
}

const resourceIcons: Record<string, any> = {
  pods: Box,
  deployments: Layers,
  statefulSets: Database,
  daemonSets: Server,
  replicaSets: Layers,
  jobs: Activity,
  cronJobs: Clock,
  services: Network,
  ingresses: Globe,
  networkPolicies: Shield,
  configMaps: Database,
  secrets: Key,
  pvcs: HardDrive,
  serviceAccounts: Key,
  roles: Shield,
  roleBindings: Shield,
}

export function ResourceDiffDialog({ 
  isOpen, 
  onClose, 
  resourceType,
  selections 
}: ResourceDiffDialogProps) {
  const [resourcesData, setResourcesData] = useState<Record<string, ResourceDetails[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (isOpen && resourceType) {
      fetchResourceDetails()
    }
  }, [isOpen, resourceType, selections])

  const fetchResourceDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const promises = selections.map(async (selection) => {
        // Convert camelCase resource types to lowercase for backend
        // Handle special cases where camelCase needs proper conversion
        let backendResourceType = resourceType.toLowerCase()
        
        // Special handling for multi-word resource types
        if (resourceType === 'statefulSets') backendResourceType = 'statefulsets'
        else if (resourceType === 'daemonSets') backendResourceType = 'daemonsets'
        else if (resourceType === 'replicaSets') backendResourceType = 'replicasets'
        else if (resourceType === 'cronJobs') backendResourceType = 'cronjobs'
        else if (resourceType === 'networkPolicies') backendResourceType = 'networkpolicies'
        else if (resourceType === 'serviceAccounts') backendResourceType = 'serviceaccounts'
        else if (resourceType === 'roleBindings') backendResourceType = 'rolebindings'
        else if (resourceType === 'configMaps') backendResourceType = 'configmaps'
        
        const response = await fetch(
          `http://localhost:8080/api/v1/namespace-resources/resource-details?` +
          `context=${encodeURIComponent(selection.cluster)}` +
          `&namespace=${encodeURIComponent(selection.namespace)}` +
          `&resourceType=${encodeURIComponent(backendResourceType)}`
        )
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${resourceType} details`)
        }
        
        const data = await response.json()
        return {
          key: `${selection.cluster}/${selection.namespace}`,
          items: data.items || [],
          color: selection.color
        }
      })

      const results = await Promise.all(promises)
      const dataMap: Record<string, ResourceDetails[]> = {}
      results.forEach(result => {
        dataMap[result.key] = result.items
      })
      setResourcesData(dataMap)
    } catch (err) {
      console.error('Failed to fetch resource details:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch resource details')
    } finally {
      setLoading(false)
    }
  }

  const getAllResourceNames = (): Set<string> => {
    const allNames = new Set<string>()
    Object.values(resourcesData).forEach(resources => {
      resources.forEach(resource => allNames.add(resource.name))
    })
    return allNames
  }

  const getResourceByName = (namespaceKey: string, name: string): ResourceDetails | undefined => {
    return resourcesData[namespaceKey]?.find(r => r.name === name)
  }

  const getDifferences = () => {
    const allNames = getAllResourceNames()
    const differences = {
      common: [] as string[],
      unique: {} as Record<string, string[]>
    }

    // Find common and unique resources
    allNames.forEach(name => {
      const namespacesWithResource = Object.keys(resourcesData).filter(
        key => getResourceByName(key, name)
      )
      
      if (namespacesWithResource.length === Object.keys(resourcesData).length) {
        differences.common.push(name)
      } else {
        namespacesWithResource.forEach(ns => {
          if (!differences.unique[ns]) {
            differences.unique[ns] = []
          }
          differences.unique[ns].push(name)
        })
      }
    })

    return differences
  }

  const ResourceIcon = resourceIcons[resourceType] || Box
  const differences = !loading && !error ? getDifferences() : { common: [], unique: {} }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ResourceIcon className="h-5 w-5" />
            {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Comparison
          </DialogTitle>
          <DialogDescription>
            Detailed comparison of {resourceType} across selected namespaces
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
              <TabsTrigger value="differences">Differences Only</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Common Resources</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{differences.common.length}</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Unique Resources</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {Object.values(differences.unique).flat().length}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Unique</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{getAllResourceNames().size}</p>
                  </div>
                </div>

                {/* Resource Distribution */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Resource Distribution</h3>
                  <div className="space-y-2">
                    {selections.map((selection) => {
                      const key = `${selection.cluster}/${selection.namespace}`
                      const resources = resourcesData[key] || []
                      const uniqueCount = differences.unique[key]?.length || 0
                      
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center gap-2">
                            <div 
                              className={cn(
                                "w-3 h-3 rounded-full",
                                selection.color.replace('text-', 'bg-').replace('/10', '')
                              )} 
                            />
                            <span className="text-sm font-medium">{key}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary">{resources.length} total</Badge>
                            {uniqueCount > 0 && (
                              <Badge variant="outline" className="text-orange-600">
                                {uniqueCount} unique
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="mt-4">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Resource Name</TableHead>
                      {selections.map((selection) => (
                        <TableHead 
                          key={`${selection.cluster}/${selection.namespace}`}
                          className="text-center min-w-[150px]"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs">{selection.cluster}</span>
                            <span className="text-xs text-muted-foreground">{selection.namespace}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(getAllResourceNames()).sort().map((resourceName) => (
                      <TableRow key={resourceName}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {resourceName}
                        </TableCell>
                        {selections.map((selection) => {
                          const key = `${selection.cluster}/${selection.namespace}`
                          const resource = getResourceByName(key, resourceName)
                          
                          return (
                            <TableCell key={key} className="text-center">
                              {resource ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex items-center justify-center"
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                  {resource.status && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {resource.status}
                                    </Badge>
                                  )}
                                </motion.div>
                              ) : (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex items-center justify-center"
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </motion.div>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="differences" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {Object.entries(differences.unique).map(([namespaceKey, resources]) => {
                    const selection = selections.find(
                      s => `${s.cluster}/${s.namespace}` === namespaceKey
                    )
                    
                    if (!resources.length) return null
                    
                    return (
                      <div key={namespaceKey} className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded border">
                          <PlusCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">
                            Only in {namespaceKey}
                          </span>
                          <Badge variant="secondary">{resources.length}</Badge>
                        </div>
                        <div className="pl-6 space-y-1">
                          {resources.map(resourceName => (
                            <div 
                              key={resourceName}
                              className="flex items-center gap-2 text-sm p-1"
                            >
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span>{resourceName}</span>
                              {getResourceByName(namespaceKey, resourceName)?.status && (
                                <Badge variant="outline" className="text-xs">
                                  {getResourceByName(namespaceKey, resourceName)?.status}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Show missing resources */}
                  {selections.map((selection) => {
                    const key = `${selection.cluster}/${selection.namespace}`
                    const existingNames = new Set(
                      resourcesData[key]?.map(r => r.name) || []
                    )
                    const missingNames = Array.from(getAllResourceNames()).filter(
                      name => !existingNames.has(name)
                    )
                    
                    if (missingNames.length === 0) return null
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded border">
                          <MinusCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">
                            Missing in {key}
                          </span>
                          <Badge variant="secondary">{missingNames.length}</Badge>
                        </div>
                        <div className="pl-6 space-y-1">
                          {missingNames.map(resourceName => (
                            <div 
                              key={resourceName}
                              className="flex items-center gap-2 text-sm p-1 text-muted-foreground"
                            >
                              <ArrowRight className="h-3 w-3" />
                              <span>{resourceName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}