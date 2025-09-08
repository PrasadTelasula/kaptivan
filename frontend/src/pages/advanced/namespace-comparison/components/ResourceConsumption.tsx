import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Cpu, 
  MemoryStick,
  HardDrive,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface ResourceDetails {
  name: string
  status?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  details?: any
}

interface ResourceConsumptionProps {
  resourcesData: Record<string, ResourceDetails[]>
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
  resourceType: string
}

export function ResourceConsumption({ 
  resourcesData, 
  selections,
  resourceType
}: ResourceConsumptionProps) {
  
  // Calculate total resource consumption per namespace
  const namespaceConsumption = useMemo(() => {
    const consumption: Record<string, {
      totalCpuRequests: number
      totalCpuLimits: number
      totalMemoryRequests: number
      totalMemoryLimits: number
      containerCount: number
      podCount: number
      volumeCount: number
    }> = {}

    Object.entries(resourcesData).forEach(([key, resources]) => {
      let totalCpuRequests = 0
      let totalCpuLimits = 0
      let totalMemoryRequests = 0
      let totalMemoryLimits = 0
      let containerCount = 0
      let podCount = 0
      let volumeCount = 0

      resources.forEach(resource => {
        if (resourceType === 'pods' && resource.details?.containers) {
          podCount++
          volumeCount += (resource.details.volumes?.length || 0)
          
          resource.details.containers.forEach((container: any) => {
            containerCount++
            
            // Parse CPU values (convert m to cores)
            if (container.requests?.cpu) {
              const cpuValue = parseCpuValue(container.requests.cpu)
              totalCpuRequests += cpuValue
            }
            if (container.limits?.cpu) {
              const cpuValue = parseCpuValue(container.limits.cpu)
              totalCpuLimits += cpuValue
            }
            
            // Parse Memory values (convert to bytes)
            if (container.requests?.memory) {
              const memValue = parseMemoryValue(container.requests.memory)
              totalMemoryRequests += memValue
            }
            if (container.limits?.memory) {
              const memValue = parseMemoryValue(container.limits.memory)
              totalMemoryLimits += memValue
            }
          })
        }
      })

      consumption[key] = {
        totalCpuRequests,
        totalCpuLimits,
        totalMemoryRequests,
        totalMemoryLimits,
        containerCount,
        podCount,
        volumeCount
      }
    })

    return consumption
  }, [resourcesData, resourceType])

  // Helper function to parse CPU values
  const parseCpuValue = (cpu: string): number => {
    if (!cpu) return 0
    if (cpu.endsWith('m')) {
      return parseFloat(cpu.slice(0, -1)) / 1000
    }
    return parseFloat(cpu)
  }

  // Helper function to parse memory values
  const parseMemoryValue = (memory: string): number => {
    if (!memory) return 0
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000,
    }
    
    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseFloat(memory.slice(0, -unit.length)) * multiplier
      }
    }
    return parseFloat(memory)
  }

  // Format CPU value for display
  const formatCpuValue = (cores: number): string => {
    if (cores === 0) return '0'
    if (cores < 1) return `${(cores * 1000).toFixed(0)}m`
    return `${cores.toFixed(2)}`
  }

  // Format memory value for display
  const formatMemoryValue = (bytes: number): string => {
    if (bytes === 0) return '0'
    const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti']
    const base = 1024
    const index = Math.floor(Math.log(bytes) / Math.log(base))
    return `${(bytes / Math.pow(base, index)).toFixed(2)} ${units[index]}`
  }

  // Get max values for percentage calculations
  const maxValues = useMemo(() => {
    const values = Object.values(namespaceConsumption)
    return {
      cpuRequests: Math.max(...values.map(v => v.totalCpuRequests)),
      cpuLimits: Math.max(...values.map(v => v.totalCpuLimits)),
      memoryRequests: Math.max(...values.map(v => v.totalMemoryRequests)),
      memoryLimits: Math.max(...values.map(v => v.totalMemoryLimits)),
      containers: Math.max(...values.map(v => v.containerCount)),
      pods: Math.max(...values.map(v => v.podCount)),
      volumes: Math.max(...values.map(v => v.volumeCount))
    }
  }, [namespaceConsumption])

  if (resourceType !== 'pods') {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <div className="text-center">
          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Resource consumption analysis is currently available only for Pods</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[500px] w-full">
      <div className="space-y-6 p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                CPU Usage Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selections.map((selection) => {
                const key = `${selection.cluster}/${selection.namespace}`
                const data = namespaceConsumption[key]
                const cpuPercentage = maxValues.cpuLimits > 0 
                  ? (data.totalCpuLimits / maxValues.cpuLimits) * 100 
                  : 0
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{key}</span>
                      <Badge variant="secondary">
                        {formatCpuValue(data.totalCpuLimits)} cores
                      </Badge>
                    </div>
                    <Progress value={cpuPercentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Requests: {formatCpuValue(data.totalCpuRequests)}</span>
                      <span>Limits: {formatCpuValue(data.totalCpuLimits)}</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MemoryStick className="h-4 w-4" />
                Memory Usage Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selections.map((selection) => {
                const key = `${selection.cluster}/${selection.namespace}`
                const data = namespaceConsumption[key]
                const memPercentage = maxValues.memoryLimits > 0 
                  ? (data.totalMemoryLimits / maxValues.memoryLimits) * 100 
                  : 0
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{key}</span>
                      <Badge variant="secondary">
                        {formatMemoryValue(data.totalMemoryLimits)}
                      </Badge>
                    </div>
                    <Progress value={memPercentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Requests: {formatMemoryValue(data.totalMemoryRequests)}</span>
                      <span>Limits: {formatMemoryValue(data.totalMemoryLimits)}</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detailed Resource Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namespace</TableHead>
                  <TableHead className="text-center">Pods</TableHead>
                  <TableHead className="text-center">Containers</TableHead>
                  <TableHead className="text-center">CPU Requests</TableHead>
                  <TableHead className="text-center">CPU Limits</TableHead>
                  <TableHead className="text-center">Memory Requests</TableHead>
                  <TableHead className="text-center">Memory Limits</TableHead>
                  <TableHead className="text-center">Volumes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selections.map((selection) => {
                  const key = `${selection.cluster}/${selection.namespace}`
                  const data = namespaceConsumption[key]
                  
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className={cn(
                              "w-2 h-2 rounded-full",
                              selection.color.replace('text-', 'bg-').replace('/10', '')
                            )} 
                          />
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={data.podCount === maxValues.pods ? "default" : "outline"}>
                          {data.podCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={data.containerCount === maxValues.containers ? "default" : "outline"}>
                          {data.containerCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-sm",
                          data.totalCpuRequests === maxValues.cpuRequests && data.totalCpuRequests > 0 && "font-semibold text-orange-600"
                        )}>
                          {formatCpuValue(data.totalCpuRequests)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-sm",
                          data.totalCpuLimits === maxValues.cpuLimits && data.totalCpuLimits > 0 && "font-semibold text-red-600"
                        )}>
                          {formatCpuValue(data.totalCpuLimits)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-sm",
                          data.totalMemoryRequests === maxValues.memoryRequests && data.totalMemoryRequests > 0 && "font-semibold text-orange-600"
                        )}>
                          {formatMemoryValue(data.totalMemoryRequests)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-sm",
                          data.totalMemoryLimits === maxValues.memoryLimits && data.totalMemoryLimits > 0 && "font-semibold text-red-600"
                        )}>
                          {formatMemoryValue(data.totalMemoryLimits)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={data.volumeCount === maxValues.volumes && data.volumeCount > 0 ? "default" : "outline"}>
                          {data.volumeCount}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Resource Efficiency Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Resource Efficiency Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selections.map((selection) => {
                const key = `${selection.cluster}/${selection.namespace}`
                const data = namespaceConsumption[key]
                
                // Calculate efficiency metrics
                const cpuEfficiency = data.totalCpuLimits > 0 
                  ? (data.totalCpuRequests / data.totalCpuLimits) * 100 
                  : 0
                const memoryEfficiency = data.totalMemoryLimits > 0 
                  ? (data.totalMemoryRequests / data.totalMemoryLimits) * 100 
                  : 0
                
                const getEfficiencyIcon = (efficiency: number) => {
                  if (efficiency >= 80) return <CheckCircle2 className="h-4 w-4 text-green-600" />
                  if (efficiency >= 50) return <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  return <XCircle className="h-4 w-4 text-red-600" />
                }
                
                const getEfficiencyLabel = (efficiency: number) => {
                  if (efficiency >= 80) return "Optimal"
                  if (efficiency >= 50) return "Moderate"
                  return "Low"
                }
                
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg border space-y-2"
                  >
                    <div className="font-medium text-sm">{key}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        {getEfficiencyIcon(cpuEfficiency)}
                        <span className="text-sm">
                          CPU: {cpuEfficiency.toFixed(1)}% ({getEfficiencyLabel(cpuEfficiency)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEfficiencyIcon(memoryEfficiency)}
                        <span className="text-sm">
                          Memory: {memoryEfficiency.toFixed(1)}% ({getEfficiencyLabel(memoryEfficiency)})
                        </span>
                      </div>
                    </div>
                    {cpuEfficiency < 50 && (
                      <p className="text-xs text-muted-foreground">
                        Consider increasing CPU requests to improve resource allocation
                      </p>
                    )}
                    {memoryEfficiency < 50 && (
                      <p className="text-xs text-muted-foreground">
                        Consider increasing memory requests to improve resource allocation
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}