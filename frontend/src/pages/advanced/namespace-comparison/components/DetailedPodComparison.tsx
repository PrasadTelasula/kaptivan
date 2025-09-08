import { useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Container, 
  Tag, 
  FileText, 
  HardDrive,
  Cpu,
  MemoryStick,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Server,
  Package
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContainerDetails {
  name: string
  image: string
  requests?: {
    cpu?: string
    memory?: string
  }
  limits?: {
    cpu?: string
    memory?: string
  }
  envCount?: number
  volumeMounts?: string[]
}

interface PodDetails {
  name: string
  status?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  details?: {
    containers?: ContainerDetails[]
    containersCount?: number
    nodeName?: string
    ready?: boolean
    volumes?: string[]
    nodeSelector?: Record<string, string>
    tolerations?: number
    serviceAccount?: string
    restartPolicy?: string
  }
}

interface DetailedPodComparisonProps {
  resourcesData: Record<string, PodDetails[]>
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
}

export function DetailedPodComparison({ 
  resourcesData, 
  selections 
}: DetailedPodComparisonProps) {
  
  // Get all unique pod names
  const allPodNames = useMemo(() => {
    const names = new Set<string>()
    Object.values(resourcesData).forEach(pods => {
      pods.forEach(pod => names.add(pod.name))
    })
    return Array.from(names).sort()
  }, [resourcesData])

  // Compare containers between pods
  const compareContainers = (podName: string) => {
    const containers: Record<string, ContainerDetails[]> = {}
    
    selections.forEach(selection => {
      const key = `${selection.cluster}/${selection.namespace}`
      const pod = resourcesData[key]?.find(p => p.name === podName)
      if (pod?.details?.containers) {
        containers[key] = pod.details.containers as ContainerDetails[]
      }
    })
    
    return containers
  }

  // Compare labels between pods
  const compareLabels = (podName: string) => {
    const allLabels = new Map<string, Set<string>>()
    
    selections.forEach(selection => {
      const key = `${selection.cluster}/${selection.namespace}`
      const pod = resourcesData[key]?.find(p => p.name === podName)
      
      if (pod?.labels) {
        Object.entries(pod.labels).forEach(([labelKey, labelValue]) => {
          if (!allLabels.has(labelKey)) {
            allLabels.set(labelKey, new Set())
          }
          allLabels.get(labelKey)!.add(labelValue)
        })
      }
    })
    
    return allLabels
  }

  // Get differences in container images
  const getImageDifferences = (containers: Record<string, ContainerDetails[]>) => {
    const imagesByContainer = new Map<string, Set<string>>()
    
    Object.values(containers).forEach(containerList => {
      containerList.forEach(container => {
        if (!imagesByContainer.has(container.name)) {
          imagesByContainer.set(container.name, new Set())
        }
        imagesByContainer.get(container.name)!.add(container.image)
      })
    })
    
    const differences: Array<{
      containerName: string
      images: string[]
      hasDifference: boolean
    }> = []
    
    imagesByContainer.forEach((images, containerName) => {
      differences.push({
        containerName,
        images: Array.from(images),
        hasDifference: images.size > 1
      })
    })
    
    return differences
  }

  return (
    <ScrollArea className="h-[500px] w-full">
      <div className="space-y-4 p-4">
        <Accordion type="multiple" className="w-full">
          {allPodNames.map((podName) => {
            const containers = compareContainers(podName)
            const labels = compareLabels(podName)
            const imageDiffs = getImageDifferences(containers)
            const hasImageDifferences = imageDiffs.some(d => d.hasDifference)
            
            return (
              <AccordionItem key={podName} value={podName}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="font-medium">{podName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasImageDifferences && (
                        <Badge variant="destructive" className="text-xs">
                          Image Diff
                        </Badge>
                      )}
                      {labels.size > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {labels.size} labels
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Container Images Comparison */}
                    {imageDiffs.length > 0 && (
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Container className="h-4 w-4" />
                            Container Images
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Container</TableHead>
                                {selections.map(s => (
                                  <TableHead key={`${s.cluster}/${s.namespace}`} className="text-xs">
                                    {s.cluster}/{s.namespace}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {imageDiffs.map(diff => (
                                <TableRow key={diff.containerName}>
                                  <TableCell className="font-medium text-xs">
                                    {diff.containerName}
                                  </TableCell>
                                  {selections.map(selection => {
                                    const key = `${selection.cluster}/${selection.namespace}`
                                    const container = containers[key]?.find(
                                      c => c.name === diff.containerName
                                    )
                                    return (
                                      <TableCell key={key} className="text-xs">
                                        {container ? (
                                          <span className={cn(
                                            diff.hasDifference && "text-orange-600 font-medium"
                                          )}>
                                            {container.image.split(':')[1] || 'latest'}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Resource Limits Comparison */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Cpu className="h-4 w-4" />
                          Resource Limits & Requests
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="space-y-3">
                          {selections.map(selection => {
                            const key = `${selection.cluster}/${selection.namespace}`
                            const containerList = containers[key] || []
                            
                            return (
                              <div key={key} className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {key}
                                </div>
                                {containerList.map(container => (
                                  <div key={container.name} className="pl-3 space-y-1">
                                    <div className="text-xs font-medium">{container.name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Requests: </span>
                                        {container.requests?.cpu && (
                                          <Badge variant="outline" className="text-xs mr-1">
                                            CPU: {container.requests.cpu}
                                          </Badge>
                                        )}
                                        {container.requests?.memory && (
                                          <Badge variant="outline" className="text-xs">
                                            Mem: {container.requests.memory}
                                          </Badge>
                                        )}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Limits: </span>
                                        {container.limits?.cpu && (
                                          <Badge variant="outline" className="text-xs mr-1">
                                            CPU: {container.limits.cpu}
                                          </Badge>
                                        )}
                                        {container.limits?.memory && (
                                          <Badge variant="outline" className="text-xs">
                                            Mem: {container.limits.memory}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Labels Comparison */}
                    {labels.size > 0 && (
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            Labels Comparison
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Label Key</TableHead>
                                {selections.map(s => (
                                  <TableHead key={`${s.cluster}/${s.namespace}`} className="text-xs">
                                    {s.cluster}/{s.namespace}
                                  </TableHead>
                                ))}
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Array.from(labels.entries()).map(([labelKey, values]) => {
                                const hasDifference = values.size > 1
                                return (
                                  <TableRow key={labelKey}>
                                    <TableCell className="font-medium text-xs">
                                      {labelKey}
                                    </TableCell>
                                    {selections.map(selection => {
                                      const key = `${selection.cluster}/${selection.namespace}`
                                      const pod = resourcesData[key]?.find(p => p.name === podName)
                                      const labelValue = pod?.labels?.[labelKey]
                                      
                                      return (
                                        <TableCell key={key} className="text-xs">
                                          {labelValue ? (
                                            <span className={cn(
                                              hasDifference && "text-orange-600"
                                            )}>
                                              {labelValue}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                      )
                                    })}
                                    <TableCell>
                                      {hasDifference ? (
                                        <Badge variant="outline" className="text-xs text-orange-600">
                                          Different
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs text-green-600">
                                          Same
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Volumes Comparison */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <HardDrive className="h-4 w-4" />
                          Volumes & Mounts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          {selections.map(selection => {
                            const key = `${selection.cluster}/${selection.namespace}`
                            const pod = resourcesData[key]?.find(p => p.name === podName)
                            const volumes = pod?.details?.volumes || []
                            
                            return (
                              <div key={key} className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {key}
                                </div>
                                <div className="pl-3 flex flex-wrap gap-1">
                                  {volumes.length > 0 ? (
                                    volumes.map(vol => (
                                      <Badge key={vol} variant="secondary" className="text-xs">
                                        {vol}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No volumes</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Node & Service Account Info */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          Node & Service Account
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Namespace</TableHead>
                              <TableHead className="text-xs">Node</TableHead>
                              <TableHead className="text-xs">Service Account</TableHead>
                              <TableHead className="text-xs">Restart Policy</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selections.map(selection => {
                              const key = `${selection.cluster}/${selection.namespace}`
                              const pod = resourcesData[key]?.find(p => p.name === podName)
                              
                              return (
                                <TableRow key={key}>
                                  <TableCell className="text-xs font-medium">
                                    {key}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {pod?.details?.nodeName || '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {pod?.details?.serviceAccount || 'default'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {pod?.details?.restartPolicy || '-'}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </ScrollArea>
  )
}