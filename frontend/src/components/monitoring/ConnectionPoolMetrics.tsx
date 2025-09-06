import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Database, 
  Heart, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface PoolMetrics {
  connectionsCreated: number
  connectionsEvicted: number
  connectionErrors: number
  reconnections: number
  hits: number
  misses: number
  hitRate: number
  healthCheckSuccess: number
  healthCheckFailure: number
  healthCheckSuccessRate: number
  avgConnectionTime: number
  avgRequestTime: number
  uptime: number
}

interface ConnectionStats {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  healthyConnections: number
  unhealthyConnections: number
}

interface ConnectionPoolMetricsProps {
  metrics?: PoolMetrics
  stats?: ConnectionStats
  className?: string
  refreshInterval?: number
  onRefresh?: () => void
}

export const ConnectionPoolMetrics: React.FC<ConnectionPoolMetricsProps> = ({
  metrics,
  stats,
  className,
  refreshInterval = 30000,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  useEffect(() => {
    if (!onRefresh || !refreshInterval) return
    
    const interval = setInterval(() => {
      handleRefresh()
    }, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval, onRefresh])
  
  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true)
      await onRefresh()
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }
  
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }
  
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {/* Connection Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-bold">{stats?.totalConnections || 0}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3 text-green-500" />
                  Active
                </span>
                <span>{stats?.activeConnections || 0}</span>
              </div>
              <Progress 
                value={(stats?.activeConnections || 0) / Math.max(stats?.totalConnections || 1, 1) * 100} 
                className="h-1"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  Idle
                </span>
                <span>{stats?.idleConnections || 0}</span>
              </div>
              <Progress 
                value={(stats?.idleConnections || 0) / Math.max(stats?.totalConnections || 1, 1) * 100} 
                className="h-1"
              />
            </div>
            
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                {stats?.healthyConnections || 0} Healthy
              </Badge>
              {(stats?.unhealthyConnections || 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {stats.unhealthyConnections} Unhealthy
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Performance Metrics Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Hit Rate</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold">{metrics?.hitRate?.toFixed(1) || 0}%</span>
                {(metrics?.hitRate || 0) > 80 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
              </div>
            </div>
            <Progress value={metrics?.hitRate || 0} className="h-1" />
            
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hits</p>
                <p className="text-sm font-medium">{metrics?.hits || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Misses</p>
                <p className="text-sm font-medium">{metrics?.misses || 0}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Avg Connect</p>
                <p className="text-sm font-medium">
                  {formatDuration(metrics?.avgConnectionTime || 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Avg Request</p>
                <p className="text-sm font-medium">
                  {formatDuration(metrics?.avgRequestTime || 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Health Check Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Health Checks</CardTitle>
          <Heart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Success Rate</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold">
                  {metrics?.healthCheckSuccessRate?.toFixed(1) || 0}%
                </span>
                {(metrics?.healthCheckSuccessRate || 0) > 95 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                )}
              </div>
            </div>
            <Progress 
              value={metrics?.healthCheckSuccessRate || 0} 
              className={cn(
                "h-1",
                (metrics?.healthCheckSuccessRate || 0) < 95 && "bg-yellow-100"
              )}
            />
            
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Success</p>
                <p className="text-sm font-medium text-green-600">
                  {metrics?.healthCheckSuccess || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-sm font-medium text-red-600">
                  {metrics?.healthCheckFailure || 0}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-muted-foreground">Reconnections</span>
              </div>
              <span className="text-sm font-medium">{metrics?.reconnections || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Lifecycle Stats Card */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lifecycle Stats</CardTitle>
          <RefreshCw 
            className={cn(
              "h-4 w-4 text-muted-foreground",
              isRefreshing && "animate-spin"
            )}
            onClick={handleRefresh}
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <span className="text-sm font-medium">
                {formatUptime(metrics?.uptime || 0)}
              </span>
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Created</span>
                <Badge variant="outline" className="text-xs">
                  {metrics?.connectionsCreated || 0}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Evicted</span>
                <Badge variant="outline" className="text-xs">
                  {metrics?.connectionsEvicted || 0}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Errors</span>
                <Badge 
                  variant={(metrics?.connectionErrors || 0) > 0 ? "destructive" : "outline"} 
                  className="text-xs"
                >
                  {metrics?.connectionErrors || 0}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Connection Pool Health Summary */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Connection Pool Health</CardTitle>
          <CardDescription className="text-xs">
            Overall system performance and reliability metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className={cn(
                "mx-auto h-2 w-2 rounded-full mb-1",
                (metrics?.hitRate || 0) > 80 ? "bg-green-500" : "bg-yellow-500"
              )} />
              <p className="text-xs text-muted-foreground">Cache</p>
              <p className="text-sm font-medium">{metrics?.hitRate?.toFixed(0) || 0}%</p>
            </div>
            
            <div className="text-center">
              <div className={cn(
                "mx-auto h-2 w-2 rounded-full mb-1",
                (metrics?.healthCheckSuccessRate || 0) > 95 ? "bg-green-500" : "bg-yellow-500"
              )} />
              <p className="text-xs text-muted-foreground">Health</p>
              <p className="text-sm font-medium">{metrics?.healthCheckSuccessRate?.toFixed(0) || 0}%</p>
            </div>
            
            <div className="text-center">
              <div className={cn(
                "mx-auto h-2 w-2 rounded-full mb-1",
                (stats?.unhealthyConnections || 0) === 0 ? "bg-green-500" : "bg-red-500"
              )} />
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium">
                {(stats?.unhealthyConnections || 0) === 0 ? "Healthy" : "Issues"}
              </p>
            </div>
            
            <div className="text-center">
              <div className={cn(
                "mx-auto h-2 w-2 rounded-full mb-1",
                (metrics?.connectionErrors || 0) === 0 ? "bg-green-500" : "bg-red-500"
              )} />
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="text-sm font-medium">{metrics?.connectionErrors || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}