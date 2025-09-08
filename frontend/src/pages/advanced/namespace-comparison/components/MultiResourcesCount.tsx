import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  Box, 
  Server, 
  Database, 
  Network, 
  Shield, 
  Key,
  HardDrive,
  Globe,
  Clock,
  Layers,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ResourceDiffDialog } from './ResourceDiffDialog'

interface ResourceCount {
  pods: number
  services: number
  deployments: number
  statefulSets: number
  daemonSets: number
  replicaSets: number
  jobs: number
  cronJobs: number
  configMaps: number
  secrets: number
  pvcs: number
  ingresses: number
  networkPolicies: number
  serviceAccounts: number
  roles: number
  roleBindings: number
}

interface NamespaceResources {
  namespace: string
  cluster: string
  resources: ResourceCount
  total: number
  color?: string
}

interface MultiResourcesCountProps {
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
}

const resourceCategories = [
  {
    title: 'Workloads',
    icon: Box,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    resources: [
      { key: 'pods', label: 'Pods', icon: Box },
      { key: 'deployments', label: 'Deployments', icon: Layers },
      { key: 'statefulSets', label: 'StatefulSets', icon: Database },
      { key: 'daemonSets', label: 'DaemonSets', icon: Server },
      { key: 'replicaSets', label: 'ReplicaSets', icon: Layers },
      { key: 'jobs', label: 'Jobs', icon: Activity },
      { key: 'cronJobs', label: 'CronJobs', icon: Clock },
    ]
  },
  {
    title: 'Networking',
    icon: Network,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    resources: [
      { key: 'services', label: 'Services', icon: Network },
      { key: 'ingresses', label: 'Ingresses', icon: Globe },
      { key: 'networkPolicies', label: 'Network Policies', icon: Shield },
    ]
  },
  {
    title: 'Configuration',
    icon: Database,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    resources: [
      { key: 'configMaps', label: 'ConfigMaps', icon: Database },
      { key: 'secrets', label: 'Secrets', icon: Key },
    ]
  },
  {
    title: 'Storage',
    icon: HardDrive,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    resources: [
      { key: 'pvcs', label: 'PVCs', icon: HardDrive },
    ]
  },
  {
    title: 'Security',
    icon: Shield,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    resources: [
      { key: 'serviceAccounts', label: 'Service Accounts', icon: Key },
      { key: 'roles', label: 'Roles', icon: Shield },
      { key: 'roleBindings', label: 'Role Bindings', icon: Shield },
    ]
  }
]

export function MultiResourcesCount({ selections }: MultiResourcesCountProps) {
  const [resourcesData, setResourcesData] = useState<NamespaceResources[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    resourceCategories.map(cat => cat.title)
  )
  const [diffDialog, setDiffDialog] = useState<{ open: boolean; resourceType: string | null }>({
    open: false,
    resourceType: null
  })

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const promises = selections.map(async (selection) => {
          const response = await fetch(
            `http://localhost:8080/api/v1/namespace-resources/single?context=${encodeURIComponent(selection.cluster)}&namespace=${encodeURIComponent(selection.namespace)}`
          )
          
          if (!response.ok) {
            throw new Error('Failed to fetch namespace resources')
          }
          
          const data = await response.json()
          return {
            ...data,
            color: selection.color
          }
        })

        const results = await Promise.all(promises)
        setResourcesData(results)
      } catch (err) {
        console.error('Failed to fetch resources:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch resources')
      } finally {
        setLoading(false)
      }
    }

    if (selections.length > 0) {
      fetchResources()
    }
  }, [selections])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getResourceValue = (data: NamespaceResources, key: string): number => {
    return (data.resources as any)[key] || 0
  }

  const getMaxValue = (key: string): number => {
    return Math.max(...resourcesData.map(d => getResourceValue(d, key)))
  }

  const getMinValue = (key: string): number => {
    return Math.min(...resourcesData.map(d => getResourceValue(d, key)))
  }

  const getAverageValue = (key: string): number => {
    const sum = resourcesData.reduce((acc, d) => acc + getResourceValue(d, key), 0)
    return resourcesData.length > 0 ? sum / resourcesData.length : 0
  }

  const getVariance = (key: string): 'high' | 'medium' | 'low' => {
    const values = resourcesData.map(d => getResourceValue(d, key))
    const max = Math.max(...values)
    const min = Math.min(...values)
    
    // If there's any difference at all, it's at least medium variance
    if (max === min) return 'low'
    
    const range = max - min
    const avg = getAverageValue(key)
    const variance = avg > 0 ? (range / avg) * 100 : 0
    
    // Adjusted thresholds to be more sensitive to differences
    if (variance > 30) return 'high'
    if (variance > 0) return 'medium'  // Any difference triggers medium
    return 'low'
  }

  const handleResourceClick = (resourceType: string) => {
    // Always allow viewing detailed comparison
    setDiffDialog({ open: true, resourceType })
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (resourcesData.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Ultra-Compact Summary */}
      <div className="flex flex-wrap gap-2">
        {resourcesData.map((data, index) => (
          <motion.div
            key={`${data.cluster}-${data.namespace}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md border",
              data.color || "border-border"
            )}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">{data.cluster}</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-medium">{data.namespace}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{data.total}</span>
              <span className="text-[10px] text-muted-foreground">resources</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detailed Comparison by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {resourceCategories.map((category) => {
              const CategoryIcon = category.icon
              const isExpanded = expandedCategories.includes(category.title)
              
              return (
                <Collapsible
                  key={category.title}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(category.title)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      "flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b",
                      isExpanded && category.bgColor
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", category.bgColor)}>
                          <CategoryIcon className={cn("h-4 w-4", category.color)} />
                        </div>
                        <span className="font-semibold">{category.title}</span>
                        <Badge variant="secondary" className="ml-2">
                          {category.resources.length} types
                        </Badge>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ScrollArea className="w-full">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[200px]">Resource Type</TableHead>
                                  {resourcesData.map((data) => (
                                    <TableHead 
                                      key={`${data.cluster}-${data.namespace}`}
                                      className="text-center min-w-[120px]"
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-xs truncate">{data.cluster}</span>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {data.namespace}
                                        </span>
                                      </div>
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-center">Variance</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {category.resources.map((resource) => {
                                  const ResourceIcon = resource.icon
                                  const maxValue = getMaxValue(resource.key)
                                  const minValue = getMinValue(resource.key)
                                  const variance = getVariance(resource.key)
                                  // Always allow clicking to see detailed comparison
                                  const isClickable = true
                                  
                                  return (
                                    <TableRow 
                                      key={resource.key}
                                      className={cn(
                                        "cursor-pointer hover:bg-muted/50 transition-colors"
                                      )}
                                      onClick={() => handleResourceClick(resource.key)}
                                    >
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                                          {resource.label}
                                          <Eye className="h-3 w-3 text-muted-foreground ml-auto" />
                                        </div>
                                      </TableCell>
                                      {resourcesData.map((data) => {
                                        const value = getResourceValue(data, resource.key)
                                        const isMax = value === maxValue && value > 0
                                        const isMin = value === minValue && maxValue !== minValue
                                        
                                        return (
                                          <TableCell 
                                            key={`${data.cluster}-${data.namespace}`}
                                            className="text-center"
                                          >
                                            <motion.div
                                              initial={{ scale: 0.8 }}
                                              animate={{ scale: 1 }}
                                              className={cn(
                                                "inline-flex items-center justify-center px-2 py-1 rounded",
                                                isMax && "bg-green-500/10 text-green-600 font-semibold",
                                                isMin && value > 0 && "bg-orange-500/10 text-orange-600",
                                                value === 0 && "text-muted-foreground"
                                              )}
                                            >
                                              {value}
                                              {isMax && value > 0 && (
                                                <TrendingUp className="ml-1 h-3 w-3" />
                                              )}
                                              {isMin && value > 0 && maxValue !== minValue && (
                                                <TrendingDown className="ml-1 h-3 w-3" />
                                              )}
                                            </motion.div>
                                          </TableCell>
                                        )
                                      })}
                                      <TableCell className="text-center">
                                        <Badge 
                                          variant={
                                            variance === 'high' ? 'destructive' :
                                            variance === 'medium' ? 'secondary' :
                                            'outline'
                                          }
                                        >
                                          {variance}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
          
          {/* Total Row */}
          <div className="border-t-2 bg-muted/50">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold w-[200px]">Total Resources</TableCell>
                  {resourcesData.map((data) => (
                    <TableCell 
                      key={`${data.cluster}-${data.namespace}`}
                      className="text-center font-bold"
                    >
                      <span className="text-lg">{data.total}</span>
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {Math.max(...resourcesData.map(d => d.total)) - 
                       Math.min(...resourcesData.map(d => d.total))} diff
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resource Diff Dialog */}
      {diffDialog.resourceType && (
        <ResourceDiffDialog
          isOpen={diffDialog.open}
          onClose={() => setDiffDialog({ open: false, resourceType: null })}
          resourceType={diffDialog.resourceType}
          selections={selections}
        />
      )}
    </div>
  )
}