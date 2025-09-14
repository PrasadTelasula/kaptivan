import React from 'react'
import {
  Container,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertCircle,
  Box,
  Clock,
  Server,
  Layers
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface ContainerInfo {
  name: string
  image: string
  ready: boolean
  restartCount: number
  state: string
  resources?: {
    requests?: {
      cpu?: string
      memory?: string
    }
    limits?: {
      cpu?: string
      memory?: string
    }
  }
  usage?: {
    cpu?: string
    memory?: string
    cpuPercentage?: number
    memoryPercentage?: number
  }
}

interface PodInfoWindowProps {
  podName: string
  namespace: string
  nodeName?: string
  phase: string
  containers: ContainerInfo[]
  onClose: () => void
}

const PodInfoWindow: React.FC<PodInfoWindowProps> = ({
  podName,
  namespace,
  nodeName,
  phase,
  containers,
  onClose
}) => {
  const getPhaseVariant = (phase: string): "default" | "success" | "destructive" | "secondary" | "outline" => {
    switch (phase) {
      case 'Running': return 'success'
      case 'Pending': return 'secondary'
      case 'Failed': return 'destructive'
      case 'Succeeded': return 'default'
      default: return 'outline'
    }
  }

  const getStateVariant = (state: string): "default" | "success" | "destructive" | "secondary" | "outline" => {
    switch (state.toLowerCase()) {
      case 'running': return 'success'
      case 'waiting': return 'secondary'
      case 'terminated': return 'destructive'
      default: return 'outline'
    }
  }

  // Calculate total resources
  const totalCpuRequests = containers.reduce((total, container) => {
    const cpu = container.resources?.requests?.cpu || '0'
    const value = parseInt(cpu.replace('m', ''))
    return total + (isNaN(value) ? 0 : value)
  }, 0)

  const totalMemoryRequests = containers.reduce((total, container) => {
    const memory = container.resources?.requests?.memory || '0'
    const value = parseInt(memory.replace(/Mi|Gi/, ''))
    return total + (isNaN(value) ? 0 : value)
  }, 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Pod Information
          </DialogTitle>
          <DialogDescription className="text-sm">
            {podName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pod Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Namespace</p>
                  <p className="font-medium">{namespace}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phase</p>
                  <Badge variant={getPhaseVariant(phase)}>
                    {phase}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Node</p>
                  <p className="font-medium flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    {nodeName || 'Unknown'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Containers</p>
                  <p className="font-medium flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {containers.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Containers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Container className="h-4 w-4" />
                Containers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {containers.map((container, index) => (
                <div key={index}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">{container.name}</h4>
                        <Badge variant={container.ready ? 'success' : 'secondary'}>
                          {container.state}
                        </Badge>
                        {container.ready && (
                          <Badge variant="outline" className="text-green-600">
                            Ready
                          </Badge>
                        )}
                      </div>
                      {container.restartCount > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <RefreshCw className="h-3 w-3" />
                          <span className="text-sm">{container.restartCount}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {container.image || 'Unknown'}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Cpu className="h-3 w-3 text-blue-500" />
                          <span className="font-medium">CPU</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Request: </span>
                            <span>{container.resources?.requests?.cpu || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Limit: </span>
                            <span>{container.resources?.limits?.cpu || 'Not set'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <HardDrive className="h-3 w-3 text-purple-500" />
                          <span className="font-medium">Memory</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Request: </span>
                            <span>{container.resources?.requests?.memory || 'Not set'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Limit: </span>
                            <span>{container.resources?.limits?.memory || 'Not set'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {container.restartCount > 5 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          High restart count detected ({container.restartCount} times). Check logs for issues.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Resource Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resource Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total CPU Requests</p>
                  <p className="font-medium">
                    {totalCpuRequests > 0 ? `${totalCpuRequests}m` : '0m'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Memory Requests</p>
                  <p className="font-medium">
                    {totalMemoryRequests > 0 ? `${totalMemoryRequests}Mi` : '0Mi'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PodInfoWindow