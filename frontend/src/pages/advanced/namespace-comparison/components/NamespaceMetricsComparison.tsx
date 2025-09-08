import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  Zap,
  Network,
  Shield,
  HardDrive,
  Lock
} from 'lucide-react'

interface NamespaceSelection {
  cluster: string
  namespace: string
}

interface NamespaceMetricsComparisonProps {
  selections: NamespaceSelection[]
}

interface NamespaceSnapshot {
  cluster: string
  namespace: string
  capacity?: {
    cpuRequests: number
    cpuUsage: number
    memoryRequests: number
    memoryUsage: number
    cpuHeadroom: number
    memoryHeadroom: number
  }
  stability?: {
    crashLoops24h: number
    restarts24h: number
    pendingOver5m: number
  }
  exposure?: {
    clusterIPServices: number
    nodePortServices: number
    loadBalancerServices: number
    ingressHosts: number
    hasNetworkPolicy: boolean
  }
  quotas?: {
    hasResourceQuota: boolean
    hasLimitRange: boolean
  }
  storage?: {
    pvcCount: number
    requestedStorage: string
    unboundPVCs: number
    orphanedPVCs: number
  }
  rbac?: {
    adminBindings: number
    wildcardRules: number
    serviceAccounts: number
  }
}

export function NamespaceMetricsComparison({ selections }: NamespaceMetricsComparisonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, NamespaceSnapshot>>({})

  useEffect(() => {
    if (selections && selections.length > 0) {
      fetchNamespaceSnapshots()
    }
  }, [selections])

  const fetchNamespaceSnapshots = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const snapshotData: Record<string, NamespaceSnapshot> = {}
      
      for (const selection of selections) {
        const response = await fetch(
          `http://localhost:8080/api/v1/namespaces/snapshot?` +
          `cluster=${encodeURIComponent(selection.cluster)}` +
          `&namespace=${encodeURIComponent(selection.namespace)}`
        )
        
        if (!response.ok) {
          throw new Error(`Failed to fetch snapshot for ${selection.cluster}/${selection.namespace}`)
        }
        
        const data = await response.json()
        const key = `${selection.cluster}/${selection.namespace}`
        snapshotData[key] = data.snapshot || data
      }
      
      setSnapshots(snapshotData)
    } catch (err) {
      console.error('Failed to fetch namespace snapshots:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch namespace snapshots')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: 'ok' | 'warn' | 'crit') => {
    switch (severity) {
      case 'ok': return 'text-green-600'
      case 'warn': return 'text-yellow-600'
      case 'crit': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getSeverityIcon = (severity: 'ok' | 'warn' | 'crit') => {
    switch (severity) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'crit': return <XCircle className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading namespace metrics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!selections || selections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please select namespaces to compare metrics
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare metrics rows
  const metricsData = [
    {
      category: 'Capacity',
      icon: <Cpu className="h-4 w-4" />,
      metrics: [
        {
          name: 'CPU Requests',
          getValue: (s: NamespaceSnapshot) => s.capacity?.cpuRequests ? `${s.capacity.cpuRequests}m` : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.cpuRequests || 0
            return val > 5000 ? 'crit' : val > 2000 ? 'warn' : 'ok'
          }
        },
        {
          name: 'CPU Usage',
          getValue: (s: NamespaceSnapshot) => s.capacity?.cpuUsage ? `${s.capacity.cpuUsage}m` : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.cpuUsage || 0
            return val > 4000 ? 'crit' : val > 1500 ? 'warn' : 'ok'
          }
        },
        {
          name: 'CPU Headroom',
          getValue: (s: NamespaceSnapshot) => s.capacity?.cpuHeadroom ? formatPercentage(s.capacity.cpuHeadroom) : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.cpuHeadroom || 0
            return val < 20 ? 'crit' : val < 40 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Memory Requests',
          getValue: (s: NamespaceSnapshot) => s.capacity?.memoryRequests ? formatStorage(s.capacity.memoryRequests) : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.memoryRequests || 0
            return val > 10737418240 ? 'crit' : val > 5368709120 ? 'warn' : 'ok' // 10GB, 5GB
          }
        },
        {
          name: 'Memory Usage',
          getValue: (s: NamespaceSnapshot) => s.capacity?.memoryUsage ? formatStorage(s.capacity.memoryUsage) : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.memoryUsage || 0
            return val > 8589934592 ? 'crit' : val > 4294967296 ? 'warn' : 'ok' // 8GB, 4GB
          }
        },
        {
          name: 'Memory Headroom',
          getValue: (s: NamespaceSnapshot) => s.capacity?.memoryHeadroom ? formatPercentage(s.capacity.memoryHeadroom) : '-',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.capacity?.memoryHeadroom || 0
            return val < 20 ? 'crit' : val < 40 ? 'warn' : 'ok'
          }
        }
      ]
    },
    {
      category: 'Stability',
      icon: <Zap className="h-4 w-4" />,
      metrics: [
        {
          name: '24h CrashLoops',
          getValue: (s: NamespaceSnapshot) => s.stability?.crashLoops24h?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.stability?.crashLoops24h || 0
            return val > 10 ? 'crit' : val > 0 ? 'warn' : 'ok'
          }
        },
        {
          name: '24h Restarts',
          getValue: (s: NamespaceSnapshot) => s.stability?.restarts24h?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.stability?.restarts24h || 0
            return val > 20 ? 'crit' : val > 5 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Pending &gt;5m',
          getValue: (s: NamespaceSnapshot) => s.stability?.pendingOver5m?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.stability?.pendingOver5m || 0
            return val > 5 ? 'crit' : val > 0 ? 'warn' : 'ok'
          }
        }
      ]
    },
    {
      category: 'Exposure',
      icon: <Network className="h-4 w-4" />,
      metrics: [
        {
          name: 'ClusterIP Services',
          getValue: (s: NamespaceSnapshot) => s.exposure?.clusterIPServices?.toString() || '0',
          getSeverity: () => 'ok' as const
        },
        {
          name: 'NodePort Services',
          getValue: (s: NamespaceSnapshot) => s.exposure?.nodePortServices?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.exposure?.nodePortServices || 0
            return val > 5 ? 'warn' : 'ok'
          }
        },
        {
          name: 'LoadBalancer Services',
          getValue: (s: NamespaceSnapshot) => s.exposure?.loadBalancerServices?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.exposure?.loadBalancerServices || 0
            return val > 3 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Ingress Hosts',
          getValue: (s: NamespaceSnapshot) => s.exposure?.ingressHosts?.toString() || '0',
          getSeverity: () => 'ok' as const
        },
        {
          name: 'Network Policy',
          getValue: (s: NamespaceSnapshot) => s.exposure?.hasNetworkPolicy ? 'Yes' : 'No',
          getSeverity: (s: NamespaceSnapshot) => s.exposure?.hasNetworkPolicy ? 'ok' : 'warn'
        }
      ]
    },
    {
      category: 'Quotas',
      icon: <Shield className="h-4 w-4" />,
      metrics: [
        {
          name: 'Resource Quota',
          getValue: (s: NamespaceSnapshot) => s.quotas?.hasResourceQuota ? 'Yes' : 'No',
          getSeverity: (s: NamespaceSnapshot) => s.quotas?.hasResourceQuota ? 'ok' : 'warn'
        },
        {
          name: 'Limit Range',
          getValue: (s: NamespaceSnapshot) => s.quotas?.hasLimitRange ? 'Yes' : 'No',
          getSeverity: (s: NamespaceSnapshot) => s.quotas?.hasLimitRange ? 'ok' : 'warn'
        }
      ]
    },
    {
      category: 'Storage',
      icon: <HardDrive className="h-4 w-4" />,
      metrics: [
        {
          name: 'PVC Count',
          getValue: (s: NamespaceSnapshot) => s.storage?.pvcCount?.toString() || '0',
          getSeverity: () => 'ok' as const
        },
        {
          name: 'Requested Storage',
          getValue: (s: NamespaceSnapshot) => s.storage?.requestedStorage || '-',
          getSeverity: () => 'ok' as const
        },
        {
          name: 'Unbound PVCs',
          getValue: (s: NamespaceSnapshot) => s.storage?.unboundPVCs?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.storage?.unboundPVCs || 0
            return val > 2 ? 'crit' : val > 0 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Orphaned PVCs',
          getValue: (s: NamespaceSnapshot) => s.storage?.orphanedPVCs?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.storage?.orphanedPVCs || 0
            return val > 0 ? 'warn' : 'ok'
          }
        }
      ]
    },
    {
      category: 'RBAC',
      icon: <Lock className="h-4 w-4" />,
      metrics: [
        {
          name: 'Admin Bindings',
          getValue: (s: NamespaceSnapshot) => s.rbac?.adminBindings?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.rbac?.adminBindings || 0
            return val > 5 ? 'crit' : val > 2 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Wildcard Rules',
          getValue: (s: NamespaceSnapshot) => s.rbac?.wildcardRules?.toString() || '0',
          getSeverity: (s: NamespaceSnapshot) => {
            const val = s.rbac?.wildcardRules || 0
            return val > 0 ? 'warn' : 'ok'
          }
        },
        {
          name: 'Service Accounts',
          getValue: (s: NamespaceSnapshot) => s.rbac?.serviceAccounts?.toString() || '0',
          getSeverity: () => 'ok' as const
        }
      ]
    }
  ]

  return (
    <div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Category</TableHead>
                <TableHead className="w-[200px]">Metric</TableHead>
                {selections.map(s => (
                  <TableHead key={`${s.cluster}/${s.namespace}`} className="text-center min-w-[150px]">
                    <div className="font-medium">{s.namespace}</div>
                    <div className="text-xs text-muted-foreground">{s.cluster}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricsData.map((category, categoryIdx) => (
                <>
                  {category.metrics.map((metric, metricIdx) => {
                    const isFirstInCategory = metricIdx === 0
                    return (
                      <TableRow key={`${category.category}-${metric.name}`}>
                        {isFirstInCategory && (
                          <TableCell 
                            rowSpan={category.metrics.length} 
                            className="font-medium bg-muted/30 align-top"
                          >
                            <div className="flex items-center gap-2">
                              {category.icon}
                              <span>{category.category}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          {metric.name}
                        </TableCell>
                        {selections.map(s => {
                          const key = `${s.cluster}/${s.namespace}`
                          const snapshot = snapshots[key]
                          const value = snapshot ? metric.getValue(snapshot) : '-'
                          const severity = snapshot ? metric.getSeverity(snapshot) : 'ok'
                          
                          return (
                            <TableCell key={key} className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className={getSeverityColor(severity)}>
                                  {value}
                                </span>
                                {severity !== 'ok' && getSeverityIcon(severity)}
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                  {categoryIdx < metricsData.length - 1 && (
                    <TableRow className="h-2">
                      <TableCell colSpan={selections.length + 2} className="p-0 bg-muted/10"></TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  )
}