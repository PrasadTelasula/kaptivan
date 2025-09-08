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
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'

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
}

interface ResourcesCountProps {
  clusterA: string
  namespaceA: string
  clusterB: string
  namespaceB: string
}

const resourceCategories = [
  {
    title: 'Workloads',
    icon: Box,
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
    resources: [
      { key: 'services', label: 'Services', icon: Network },
      { key: 'ingresses', label: 'Ingresses', icon: Globe },
      { key: 'networkPolicies', label: 'Network Policies', icon: Shield },
    ]
  },
  {
    title: 'Configuration',
    icon: Database,
    resources: [
      { key: 'configMaps', label: 'ConfigMaps', icon: Database },
      { key: 'secrets', label: 'Secrets', icon: Key },
    ]
  },
  {
    title: 'Storage',
    icon: HardDrive,
    resources: [
      { key: 'pvcs', label: 'PVCs', icon: HardDrive },
    ]
  },
  {
    title: 'Security',
    icon: Shield,
    resources: [
      { key: 'serviceAccounts', label: 'Service Accounts', icon: Key },
      { key: 'roles', label: 'Roles', icon: Shield },
      { key: 'roleBindings', label: 'Role Bindings', icon: Shield },
    ]
  }
]

export function ResourcesCount({
  clusterA,
  namespaceA,
  clusterB,
  namespaceB
}: ResourcesCountProps) {
  const [resourcesA, setResourcesA] = useState<NamespaceResources | null>(null)
  const [resourcesB, setResourcesB] = useState<NamespaceResources | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Fetch resources for both namespaces in parallel
        const [resA, resB] = await Promise.all([
          fetch(`http://localhost:8080/api/v1/namespace-resources/single?context=${encodeURIComponent(clusterA)}&namespace=${encodeURIComponent(namespaceA)}`),
          fetch(`http://localhost:8080/api/v1/namespace-resources/single?context=${encodeURIComponent(clusterB)}&namespace=${encodeURIComponent(namespaceB)}`)
        ])

        if (!resA.ok || !resB.ok) {
          throw new Error('Failed to fetch namespace resources')
        }

        const dataA = await resA.json()
        const dataB = await resB.json()

        setResourcesA(dataA)
        setResourcesB(dataB)
      } catch (err) {
        console.error('Failed to fetch resources:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch resources')
      } finally {
        setLoading(false)
      }
    }

    if (clusterA && namespaceA && clusterB && namespaceB) {
      fetchResources()
    }
  }, [clusterA, namespaceA, clusterB, namespaceB])

  if (loading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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

  if (!resourcesA || !resourcesB) {
    return null
  }

  const getCountA = (key: string): number => {
    return (resourcesA.resources as any)[key] || 0
  }

  const getCountB = (key: string): number => {
    return (resourcesB.resources as any)[key] || 0
  }

  const getDifference = (key: string): number => {
    return getCountB(key) - getCountA(key)
  }

  const getDifferencePercentage = (key: string): number => {
    const countA = getCountA(key)
    const countB = getCountB(key)
    
    if (countA === 0 && countB === 0) return 0
    if (countA === 0) return 100
    
    return Math.round(((countB - countA) / countA) * 100)
  }

  const getProgressValue = (key: string): number => {
    const countA = getCountA(key)
    const countB = getCountB(key)
    const max = Math.max(countA, countB)
    
    if (max === 0) return 0
    return (Math.min(countA, countB) / max) * 100
  }

  const getDifferenceIcon = (diff: number) => {
    if (diff === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />
    } else if (diff > 0) {
      return <ArrowUp className="h-4 w-4 text-blue-500" />
    } else {
      return <ArrowDown className="h-4 w-4 text-red-500" />
    }
  }

  const getDifferenceBadge = (diff: number, percentage: number) => {
    if (diff === 0) {
      return (
        <div className="flex items-center gap-1">
          <Minus className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">Same</span>
        </div>
      )
    }
    
    const variant = diff > 0 ? "default" : "destructive"
    const sign = diff > 0 ? "+" : ""
    
    return (
      <div className="flex items-center gap-2">
        {getDifferenceIcon(diff)}
        <Badge variant={variant} className="font-mono text-xs">
          {sign}{diff}
        </Badge>
        {percentage !== 0 && Math.abs(percentage) !== Infinity && (
          <span className="text-xs text-muted-foreground">
            ({sign}{percentage}%)
          </span>
        )}
      </div>
    )
  }

  const allResources = [
    // Workloads
    { key: 'pods', label: 'Pods', category: 'Workloads', icon: Box },
    { key: 'deployments', label: 'Deployments', category: 'Workloads', icon: Layers },
    { key: 'statefulSets', label: 'StatefulSets', category: 'Workloads', icon: Database },
    { key: 'daemonSets', label: 'DaemonSets', category: 'Workloads', icon: Server },
    { key: 'replicaSets', label: 'ReplicaSets', category: 'Workloads', icon: Layers },
    { key: 'jobs', label: 'Jobs', category: 'Workloads', icon: Activity },
    { key: 'cronJobs', label: 'CronJobs', category: 'Workloads', icon: Clock },
    // Networking
    { key: 'services', label: 'Services', category: 'Networking', icon: Network },
    { key: 'ingresses', label: 'Ingresses', category: 'Networking', icon: Globe },
    { key: 'networkPolicies', label: 'Network Policies', category: 'Networking', icon: Shield },
    // Configuration
    { key: 'configMaps', label: 'ConfigMaps', category: 'Configuration', icon: Database },
    { key: 'secrets', label: 'Secrets', category: 'Configuration', icon: Key },
    // Storage
    { key: 'pvcs', label: 'PVCs', category: 'Storage', icon: HardDrive },
    // Security
    { key: 'serviceAccounts', label: 'Service Accounts', category: 'Security', icon: Key },
    { key: 'roles', label: 'Roles', category: 'Security', icon: Shield },
    { key: 'roleBindings', label: 'Role Bindings', category: 'Security', icon: Shield },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Comparison Summary</CardTitle>
          <CardDescription>
            Comparing resources between {clusterA}/{namespaceA} and {clusterB}/{namespaceB}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Resources</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Namespace A:</span>
                  <span className="text-2xl font-bold">{resourcesA.total}</span>
                </div>
                <div className="text-muted-foreground">vs</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Namespace B:</span>
                  <span className="text-2xl font-bold">{resourcesB.total}</span>
                </div>
              </div>
            </div>
            <div>
              {resourcesA.total === resourcesB.total ? (
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  Equal Count
                </Badge>
              ) : (
                <Badge 
                  variant={resourcesB.total > resourcesA.total ? "default" : "destructive"} 
                  className="text-lg py-1 px-3"
                >
                  {resourcesB.total > resourcesA.total ? '+' : ''}{resourcesB.total - resourcesA.total} Difference
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Resource Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Resource Type</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{clusterA}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{namespaceA}</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{clusterB}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{namespaceB}</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allResources.map((resource) => {
                const countA = getCountA(resource.key)
                const countB = getCountB(resource.key)
                const diff = getDifference(resource.key)
                const percentage = getDifferencePercentage(resource.key)
                const ResourceIcon = resource.icon
                
                // Show all resources, even with 0 counts
                return (
                  <TableRow key={resource.key} className={diff !== 0 ? 'bg-muted/30' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                        {resource.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {resource.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono font-medium">{countA}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono font-medium">{countB}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getDifferenceBadge(diff, percentage)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              
              {/* Total Row */}
              <TableRow className="border-t-2 font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-lg">{resourcesA.total}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-lg">{resourcesB.total}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center">
                    {getDifferenceBadge(
                      resourcesB.total - resourcesA.total,
                      Math.round(((resourcesB.total - resourcesA.total) / resourcesA.total) * 100)
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}