import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Layers,
  Box,
  Network,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Server,
  Clock,
  HardDrive,
  Shield,
  Key,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NamespaceMetricsComparison } from './NamespaceMetricsComparison'

interface DetailedResourceComparisonProps {
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
}

interface DeploymentDetails {
  name: string
  replicas: number
  availableReplicas?: number
  strategy: string
  maxSurge?: string | number
  maxUnavailable?: string | number
  labels?: Record<string, string>
  selector?: Record<string, string>
}

interface PodDetails {
  name: string
  status: string
  nodeName?: string
  containers: Array<{
    name: string
    image: string
    resources?: {
      requests?: { cpu?: string; memory?: string }
      limits?: { cpu?: string; memory?: string }
    }
    ports?: Array<{ containerPort: number; protocol?: string }>
    livenessProbe?: any
    readinessProbe?: any
  }>
  initContainers?: Array<{
    name: string
    image: string
  }>
  restartCount: number
  qosClass?: string
}

interface ServiceDetails {
  name: string
  type: string
  clusterIP?: string
  ports: Array<{
    name?: string
    port: number
    targetPort: number | string
    protocol?: string
    nodePort?: number
  }>
  selector?: Record<string, string>
  externalIPs?: string[]
  loadBalancerIP?: string
}

interface ConfigMapDetails {
  name: string
  dataKeys: string[]
  size: number
  labels?: Record<string, string>
}

interface SecretDetails {
  name: string
  type: string
  dataKeys: number // Changed to number to match backend response
  labels?: Record<string, string>
}

interface IngressDetails {
  name: string
  hosts: string[]
  paths: Array<{
    path: string
    backend: string
  }>
  tls?: boolean
}

export function DetailedResourceComparison({ selections }: DetailedResourceComparisonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resourceData, setResourceData] = useState<Record<string, any>>({})
  const [activeResourceType, setActiveResourceType] = useState('deployments')

  useEffect(() => {
    if (selections && selections.length > 0 && activeResourceType !== 'metrics') {
      fetchDetailedResources()
    }
  }, [selections, activeResourceType])

  const fetchDetailedResources = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data: Record<string, any> = {}
      
      for (const selection of selections) {
        const key = `${selection.cluster}/${selection.namespace}`
        
        const response = await fetch(
          `http://localhost:8080/api/v1/namespace-resources/resource-details?` +
          `context=${encodeURIComponent(selection.cluster)}` +
          `&namespace=${encodeURIComponent(selection.namespace)}` +
          `&resourceType=${encodeURIComponent(activeResourceType)}`
        )
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${activeResourceType} details`)
        }
        
        const result = await response.json()
        console.log(`Fetched ${activeResourceType} for ${key}:`, result)
        
        // Log the first item to see its structure
        if (result.items && result.items.length > 0) {
          console.log(`First item structure for ${activeResourceType}:`, result.items[0])
          console.log(`First item keys:`, Object.keys(result.items[0]))
        } else if (Array.isArray(result) && result.length > 0) {
          console.log(`Direct array - first item structure:`, result[0])
          console.log(`First item keys:`, Object.keys(result[0]))
        }
        
        // Handle different response structures
        let itemsToProcess = []
        if (result.items && Array.isArray(result.items)) {
          itemsToProcess = result.items
        } else if (Array.isArray(result)) {
          itemsToProcess = result
        } else if (result.data && Array.isArray(result.data)) {
          itemsToProcess = result.data
        }
        
        const processedData = processResourceData(itemsToProcess, activeResourceType)
        console.log(`Processed ${activeResourceType} for ${key}:`, processedData)
        data[key] = processedData
      }
      
      console.log('Final resourceData:', data)
      setResourceData(data)
    } catch (err) {
      console.error('Failed to fetch resource details:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch resource details')
    } finally {
      setLoading(false)
    }
  }

  const processResourceData = (items: any[], resourceType: string) => {
    if (!items || !Array.isArray(items)) {
      console.log(`Warning: items is not an array for ${resourceType}:`, items)
      return []
    }
    
    console.log(`Processing ${items.length} items for ${resourceType}`)
    
    switch (resourceType) {
      case 'deployments':
        return items.map(item => {
          // Handle backend's structured format
          const name = item?.name || item?.metadata?.name || item?.Name
          if (!name) return null
          
          const details = item?.details || {}
          const spec = item?.spec || {}
          const status = item?.status || {}
          
          return {
            name: name,
            replicas: details?.replicas || spec?.replicas || 0,
            availableReplicas: details?.readyReplicas || details?.availableReplicas || status?.readyReplicas || 0,
            strategy: details?.strategy || spec?.strategy?.type || 'RollingUpdate',
            maxSurge: details?.maxSurge || spec?.strategy?.rollingUpdate?.maxSurge,
            maxUnavailable: details?.maxUnavailable || spec?.strategy?.rollingUpdate?.maxUnavailable,
            labels: item?.labels || item?.metadata?.labels || {},
            selector: details?.selector || spec?.selector?.matchLabels || {}
          }
        }).filter(Boolean)
      
      case 'pods':
        return items.map(item => {
          const name = item?.name || item?.metadata?.name || item?.Name
          if (!name) return null
          
          const details = item?.details || {}
          const containers = details?.containers || item?.spec?.containers || item?.Containers || []
          const initContainers = item?.spec?.initContainers || item?.InitContainers || []
          const containerStatuses = item?.status?.containerStatuses || item?.ContainerStatuses || []
          
          return {
            name: name,
            status: item?.status || item?.Status || details?.status || 'Unknown',
            nodeName: details?.nodeName || item?.spec?.nodeName || item?.NodeName,
            containers: Array.isArray(containers) ? containers.map((c: any) => ({
              name: c?.name || c?.Name,
              image: c?.image || c?.Image,
              resources: c?.resources || c?.Resources || {
                requests: c?.requests || {},
                limits: c?.limits || {}
              },
              ports: c?.ports || c?.Ports || [],
              livenessProbe: c?.livenessProbe || c?.LivenessProbe,
              readinessProbe: c?.readinessProbe || c?.ReadinessProbe
            })) : [],
            initContainers: initContainers.map((c: any) => ({
              name: c?.name || c?.Name,
              image: c?.image || c?.Image
            })),
            restartCount: details?.restartCount || containerStatuses.reduce(
              (sum: number, cs: any) => sum + ((cs?.restartCount || cs?.RestartCount) || 0), 0
            ),
            qosClass: details?.qosClass || item?.status?.qosClass || item?.QosClass
          }
        }).filter(Boolean)
      
      case 'services':
        return items.map(item => {
          const name = item?.name || item?.metadata?.name || item?.Name
          if (!name) return null
          
          const details = item?.details || {}
          const ports = details?.ports || item?.spec?.ports || item?.Ports || []
          const processedPorts = Array.isArray(ports) ? ports.map((p: any) => ({
            name: p?.name || p?.Name,
            port: p?.port || p?.Port,
            targetPort: p?.targetPort || p?.TargetPort,
            protocol: p?.protocol || p?.Protocol || 'TCP',
            nodePort: p?.nodePort || p?.NodePort
          })) : []
          
          return {
            name: name,
            type: details?.type || item?.spec?.type || item?.Type || 'ClusterIP',
            clusterIP: details?.clusterIP || item?.spec?.clusterIP || item?.ClusterIP,
            ports: processedPorts,
            selector: details?.selector || item?.spec?.selector || item?.Selector || {},
            externalIPs: details?.externalIPs || item?.spec?.externalIPs || item?.ExternalIPs,
            loadBalancerIP: details?.loadBalancerIP || item?.spec?.loadBalancerIP || item?.LoadBalancerIP
          }
        }).filter(Boolean)
      
      case 'configmaps':
        return items.map(item => {
          const name = item?.metadata?.name || item?.Name || item?.name
          if (!name) return null
          
          const details = item?.details || {}
          const data = item?.data || item?.Data || {}
          
          return {
            name: name,
            dataKeys: details?.dataKeys || Object.keys(data).length,
            size: details?.size || JSON.stringify(data).length,
            labels: item?.metadata?.labels || item?.Labels || item?.labels || {}
          }
        }).filter(Boolean)
      
      case 'secrets':
        return items.map(item => {
          const name = item?.metadata?.name || item?.Name || item?.name
          if (!name) return null
          
          // Handle both direct response and k8s object format
          const details = item?.details || item?.Details || {}
          const dataKeysCount = details?.dataKeys !== undefined ? details.dataKeys :
                               (item?.data || item?.Data) ? Object.keys(item.data || item.Data).length : 0
          const secretType = details?.type || item?.type || item?.Type || 'Opaque'
          
          return {
            name: name,
            type: secretType,
            dataKeys: dataKeysCount, // Now a number matching backend response
            labels: item?.metadata?.labels || item?.Labels || item?.labels || {}
          }
        }).filter(Boolean)
      
      case 'ingresses':
        return items.map(item => {
          const name = item?.metadata?.name || item?.Name || item?.name
          if (!name) return null
          
          const hosts = new Set<string>()
          const paths: any[] = []
          
          const rules = item?.spec?.rules || item?.Rules || []
          rules.forEach((rule: any) => {
            const host = rule?.host || rule?.Host
            if (host) hosts.add(host)
            
            const httpPaths = rule?.http?.paths || rule?.HTTP?.Paths || rule?.Paths || []
            httpPaths.forEach((p: any) => {
              paths.push({
                path: p?.path || p?.Path || '/',
                backend: p?.backend?.service?.name || p?.backend?.serviceName || 
                         p?.Backend?.Service?.Name || p?.Backend?.ServiceName || ''
              })
            })
          })
          
          return {
            name: name,
            hosts: Array.from(hosts),
            paths,
            tls: !!(item?.spec?.tls || item?.TLS)
          }
        }).filter(Boolean)
      
      default:
        return items
    }
  }

  const renderDeploymentComparison = () => {
    const allDeployments = new Set<string>()
    Object.values(resourceData).forEach((resources: DeploymentDetails[]) => {
      resources?.forEach(r => r && allDeployments.add(r.name))
    })

    if (allDeployments.size === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No deployments found in selected namespaces
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {Array.from(allDeployments).sort().map(deploymentName => (
          <Card key={deploymentName} className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {deploymentName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Configuration</TableHead>
                    {selections.map(s => (
                      <TableHead key={`${s.cluster}/${s.namespace}`}>
                        {s.cluster}/{s.namespace}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment ? (
                            <Badge variant="default" className="bg-green-600">
                              Exists
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Found</Badge>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Replicas</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment ? `${deployment.availableReplicas}/${deployment.replicas}` : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Strategy</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment ? deployment.strategy : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Max Surge</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment?.maxSurge || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Max Unavailable</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment?.maxUnavailable || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Labels</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment?.labels ? (
                            <div className="text-xs space-y-1">
                              {Object.entries(deployment.labels).slice(0, 3).map(([k, v]) => (
                                <div key={k} className="truncate" title={`${k}=${v}`}>
                                  {k}={v}
                                </div>
                              ))}
                              {Object.keys(deployment.labels).length > 3 && (
                                <div className="text-muted-foreground">
                                  +{Object.keys(deployment.labels).length - 3} more
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Selector</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const deployment = resourceData[key]?.find((d: DeploymentDetails) => d.name === deploymentName)
                      return (
                        <TableCell key={key}>
                          {deployment?.selector ? (
                            <div className="text-xs space-y-1">
                              {Object.entries(deployment.selector).map(([k, v]) => (
                                <div key={k} className="truncate" title={`${k}=${v}`}>
                                  {k}={v}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderPodComparison = () => {
    const allPods = new Set<string>()
    Object.values(resourceData).forEach((resources: PodDetails[]) => {
      resources?.forEach(r => r && allPods.add(r.name))
    })

    if (allPods.size === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No pods found in selected namespaces
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {Array.from(allPods).sort().map(podName => (
          <Card key={podName} className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Box className="h-4 w-4" />
                {podName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Configuration</TableHead>
                    {selections.map(s => (
                      <TableHead key={`${s.cluster}/${s.namespace}`}>
                        {s.cluster}/{s.namespace}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod ? (
                            <Badge 
                              variant={pod.status === 'Running' ? 'default' : 'secondary'}
                              className={pod.status === 'Running' ? 'bg-green-600' : ''}
                            >
                              {pod.status}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Found</Badge>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Node</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key} className="text-xs">
                          {pod?.nodeName || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Containers</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod && pod.containers && pod.containers.length > 0 ? (
                            <div className="space-y-1">
                              {pod.containers.map((c, idx) => (
                                <div key={idx} className="text-xs">
                                  <div className="font-medium">{c.name}:</div>
                                  <div className="text-muted-foreground truncate" title={c.image}>
                                    {c.image.split('/').pop()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Init Containers</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod?.initContainers?.length || 0}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Resource Requests</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod && pod.containers && pod.containers.length > 0 ? (
                            <div className="space-y-1 text-xs">
                              {pod.containers.map((c, idx) => (
                                <div key={idx}>
                                  {c.resources?.requests && (
                                    <>
                                      {c.name}: 
                                      {c.resources.requests.cpu && ` CPU: ${c.resources.requests.cpu}`}
                                      {c.resources.requests.memory && ` Mem: ${c.resources.requests.memory}`}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Resource Limits</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod && pod.containers && pod.containers.length > 0 ? (
                            <div className="space-y-1 text-xs">
                              {pod.containers.map((c, idx) => (
                                <div key={idx}>
                                  {c.resources?.limits && (
                                    <>
                                      {c.name}: 
                                      {c.resources.limits.cpu && ` CPU: ${c.resources.limits.cpu}`}
                                      {c.resources.limits.memory && ` Mem: ${c.resources.limits.memory}`}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Probes</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod && pod.containers && pod.containers.length > 0 ? (
                            <div className="space-y-1 text-xs">
                              {pod.containers.map((c, idx) => (
                                <div key={idx}>
                                  {c.name}: 
                                  {c.livenessProbe && ' L✓'}
                                  {c.readinessProbe && ' R✓'}
                                  {!c.livenessProbe && !c.readinessProbe && ' None'}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Restarts</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod?.restartCount || '0'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">QoS Class</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const pod = resourceData[key]?.find((p: PodDetails) => p.name === podName)
                      return (
                        <TableCell key={key}>
                          {pod?.qosClass || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderServiceComparison = () => {
    const allServices = new Set<string>()
    Object.values(resourceData).forEach((resources: ServiceDetails[]) => {
      resources?.forEach(r => r && allServices.add(r.name))
    })

    if (allServices.size === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No services found in selected namespaces
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {Array.from(allServices).sort().map(serviceName => (
          <Card key={serviceName} className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="h-4 w-4" />
                {serviceName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Configuration</TableHead>
                    {selections.map(s => (
                      <TableHead key={`${s.cluster}/${s.namespace}`}>
                        {s.cluster}/{s.namespace}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Type</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key}>
                          {service ? (
                            <Badge variant="outline">{service.type}</Badge>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Cluster IP</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key} className="text-xs">
                          {service?.clusterIP || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Ports</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key}>
                          {service && service.ports && service.ports.length > 0 ? (
                            <div className="space-y-1">
                              {service.ports.map((p, idx) => (
                                <div key={idx} className="text-xs">
                                  {p.name && <span className="font-medium">{p.name}: </span>}
                                  {p.port}→{p.targetPort}
                                  {p.nodePort && ` (NodePort: ${p.nodePort})`}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Selector</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key}>
                          {service?.selector ? (
                            <div className="space-y-1">
                              {Object.entries(service.selector).map(([k, v]) => (
                                <div key={k} className="text-xs">
                                  {k}={v}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">External IPs</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key}>
                          {service?.externalIPs && service.externalIPs.length > 0 ? (
                            <div className="space-y-1">
                              {service.externalIPs.map((ip, idx) => (
                                <div key={idx} className="text-xs">
                                  {ip}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Load Balancer IP</TableCell>
                    {selections.map(s => {
                      const key = `${s.cluster}/${s.namespace}`
                      const service = resourceData[key]?.find((svc: ServiceDetails) => svc.name === serviceName)
                      return (
                        <TableCell key={key} className="text-xs">
                          {service?.loadBalancerIP || '-'}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderConfigMapComparison = () => {
    const allConfigMaps: Record<string, ConfigMapDetails[]> = {}
    
    // Collect all unique ConfigMap names across all namespaces
    const allConfigMapNames = new Set<string>()
    
    Object.entries(resourceData).forEach(([key, data]) => {
      // The data is already the array of configmaps
      if (Array.isArray(data)) {
        allConfigMaps[key] = data
        data.forEach((cm: ConfigMapDetails) => {
          allConfigMapNames.add(cm.name)
        })
      }
    })
    
    if (allConfigMapNames.size === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No ConfigMaps found in selected namespaces
        </div>
      )
    }
    
    const sortedConfigMapNames = Array.from(allConfigMapNames).sort()
    
    // Prepare data for single table format
    const tableData = sortedConfigMapNames.flatMap(configMapName => {
      const configMapsAcrossNamespaces = selections.map(selection => {
        const key = `${selection.cluster}/${selection.namespace}`
        const namespaceCMs = allConfigMaps[key] || []
        return namespaceCMs.find(cm => cm.name === configMapName)
      })
      
      // Skip if this ConfigMap doesn't exist in any namespace
      if (!configMapsAcrossNamespaces.some(cm => cm)) {
        return []
      }
      
      return [
        { configMapName, property: 'Status', data: configMapsAcrossNamespaces },
        { configMapName, property: 'Data Keys', data: configMapsAcrossNamespaces },
        { configMapName, property: 'Size', data: configMapsAcrossNamespaces },
        { configMapName, property: 'Labels', data: configMapsAcrossNamespaces }
      ]
    })
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">ConfigMap</TableHead>
              <TableHead className="w-[150px]">Property</TableHead>
              {selections.map(s => (
                <TableHead key={`${s.cluster}/${s.namespace}`} className="text-center min-w-[150px]">
                  <div>
                    <div className="font-medium">{s.namespace}</div>
                    <div className="text-xs text-muted-foreground">{s.cluster}</div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedConfigMapNames.map((configMapName, configMapIdx) => {
              const rows = tableData.filter(row => row.configMapName === configMapName)
              if (rows.length === 0) return null
              
              return (
                <>
                  {rows.map((row, rowIdx) => {
                    const isFirstRow = rowIdx === 0
                    return (
                      <TableRow key={`${configMapName}-${row.property}`}>
                        {isFirstRow && (
                          <TableCell 
                            rowSpan={4}
                            className="font-medium bg-muted/30 align-top"
                          >
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <span>{configMapName}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{row.property}</TableCell>
                        {row.data.map((cm, idx) => {
                          const key = `${selections[idx].cluster}/${selections[idx].namespace}`
                          
                          if (row.property === 'Status') {
                            return (
                              <TableCell key={key} className="text-center">
                                {cm ? (
                                  <Badge variant="outline" className="border-green-500/50 dark:border-green-500/30">
                                    <CheckCircle2 className="mr-1 h-3 w-3 text-green-600 dark:text-green-400" />
                                    <span className="text-green-700 dark:text-green-300">Present</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-muted-foreground/50">
                                    <XCircle className="mr-1 h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Not Found</span>
                                  </Badge>
                                )}
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Data Keys') {
                            return (
                              <TableCell key={key} className="text-center">
                                <span className={cm?.dataKeys ? 'text-foreground' : 'text-muted-foreground'}>
                                  {cm?.dataKeys || '-'}
                                </span>
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Size') {
                            return (
                              <TableCell key={key} className="text-center">
                                <span className={cm?.size ? 'text-foreground' : 'text-muted-foreground'}>
                                  {cm?.size ? `${cm.size} bytes` : '-'}
                                </span>
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Labels') {
                            return (
                              <TableCell key={key} className="text-center">
                                {cm?.labels && Object.keys(cm.labels).length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {Object.entries(cm.labels).slice(0, 2).map(([k, v]) => (
                                      <Badge key={k} variant="secondary" className="text-xs">
                                        {k}={v}
                                      </Badge>
                                    ))}
                                    {Object.keys(cm.labels).length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{Object.keys(cm.labels).length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          }
                          
                          return <TableCell key={key} className="text-center">-</TableCell>
                        })}
                      </TableRow>
                    )
                  })}
                  {configMapIdx < sortedConfigMapNames.length - 1 && (
                    <TableRow className="h-2">
                      <TableCell colSpan={selections.length + 2} className="p-0 bg-muted/10"></TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderSecretComparison = () => {
    const allSecrets: Record<string, SecretDetails[]> = {}
    
    // Collect all secrets from each namespace
    selections.forEach(selection => {
      const key = `${selection.cluster}/${selection.namespace}`
      const namespaceData = resourceData[key]
      
      if (namespaceData && Array.isArray(namespaceData)) {
        const secrets = namespaceData.filter((item: any) => 
          item?.details?.type !== undefined || item?.type || item?.Type
        ).map((item: any) => ({
          name: item.name || item.Name,
          type: item.details?.type || item.type || 'Opaque',
          dataKeys: item.details?.dataKeys !== undefined ? item.details.dataKeys : 0,
          labels: item.labels || {}
        }))
        allSecrets[key] = secrets
      } else {
        allSecrets[key] = []
      }
    })
    
    // Get unique secret names across all namespaces
    const allSecretNames = new Set<string>()
    Object.values(allSecrets).forEach(secrets => {
      secrets.forEach(secret => allSecretNames.add(secret.name))
    })
    
    const sortedSecretNames = Array.from(allSecretNames).sort()
    
    if (sortedSecretNames.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No Secrets found in selected namespaces
        </div>
      )
    }
    
    // Prepare data for single table format
    const tableData = sortedSecretNames.flatMap(secretName => {
      const secretsAcrossNamespaces = selections.map(selection => {
        const key = `${selection.cluster}/${selection.namespace}`
        const namespaceSecrets = allSecrets[key] || []
        return namespaceSecrets.find(s => s.name === secretName)
      })
      
      // Skip if this Secret doesn't exist in any namespace
      if (!secretsAcrossNamespaces.some(s => s)) {
        return []
      }
      
      return [
        { secretName, property: 'Status', data: secretsAcrossNamespaces },
        { secretName, property: 'Type', data: secretsAcrossNamespaces },
        { secretName, property: 'Data Keys', data: secretsAcrossNamespaces },
        { secretName, property: 'Labels', data: secretsAcrossNamespaces }
      ]
    })
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Secret</TableHead>
              <TableHead className="w-[150px]">Property</TableHead>
              {selections.map(s => (
                <TableHead key={`${s.cluster}/${s.namespace}`} className="text-center min-w-[150px]">
                  <div>
                    <div className="font-medium">{s.namespace}</div>
                    <div className="text-xs text-muted-foreground">{s.cluster}</div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSecretNames.map((secretName, secretIdx) => {
              const rows = tableData.filter(row => row.secretName === secretName)
              if (rows.length === 0) return null
              
              return (
                <React.Fragment key={secretName}>
                  {rows.map((row, rowIdx) => {
                    const isFirstRow = rowIdx === 0
                    return (
                      <TableRow key={`${secretName}-${row.property}`}>
                        {isFirstRow && (
                          <TableCell 
                            rowSpan={4}
                            className="font-medium bg-muted/30 align-top"
                          >
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4 text-muted-foreground" />
                              <span>{secretName}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{row.property}</TableCell>
                        {row.data.map((secret, idx) => {
                          const key = `${selections[idx].cluster}/${selections[idx].namespace}`
                          
                          if (row.property === 'Status') {
                            return (
                              <TableCell key={key} className="text-center">
                                {secret ? (
                                  <Badge variant="outline" className="border-green-500/50 dark:border-green-500/30">
                                    <CheckCircle2 className="mr-1 h-3 w-3 text-green-600 dark:text-green-400" />
                                    <span className="text-green-700 dark:text-green-300">Present</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-muted-foreground/50">
                                    <XCircle className="mr-1 h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Not Found</span>
                                  </Badge>
                                )}
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Type') {
                            return (
                              <TableCell key={key} className="text-center">
                                {secret?.type ? (
                                  <Badge variant="secondary">
                                    {secret.type}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Data Keys') {
                            return (
                              <TableCell key={key} className="text-center">
                                <span className={secret?.dataKeys ? 'text-foreground' : 'text-muted-foreground'}>
                                  {secret?.dataKeys || '-'}
                                </span>
                              </TableCell>
                            )
                          }
                          
                          if (row.property === 'Labels') {
                            return (
                              <TableCell key={key} className="text-center">
                                {secret?.labels && Object.keys(secret.labels).length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {Object.entries(secret.labels).slice(0, 2).map(([k, v]) => (
                                      <Badge key={k} variant="secondary" className="text-xs">
                                        {k}={v}
                                      </Badge>
                                    ))}
                                    {Object.keys(secret.labels).length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{Object.keys(secret.labels).length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          }
                          
                          return <TableCell key={key} className="text-center">-</TableCell>
                        })}
                      </TableRow>
                    )
                  })}
                  {secretIdx < sortedSecretNames.length - 1 && (
                    <TableRow className="h-2">
                      <TableCell colSpan={selections.length + 2} className="p-0 bg-muted/10"></TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  const resourceTypes = [
    { value: 'deployments', label: 'Deployments', icon: Layers },
    { value: 'pods', label: 'Pods', icon: Box },
    { value: 'services', label: 'Services', icon: Network },
    { value: 'configmaps', label: 'ConfigMaps', icon: Database },
    { value: 'secrets', label: 'Secrets', icon: Key },
    { value: 'ingresses', label: 'Ingresses', icon: Globe },
    { value: 'metrics', label: 'Metrics', icon: Activity }
  ]

  if (!selections || selections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please select namespaces to compare
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Resource Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeResourceType} onValueChange={setActiveResourceType}>
          <TabsList className="grid grid-cols-7 w-full">
            {resourceTypes.map(type => {
              const Icon = type.icon
              return (
                <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {type.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
          
          <ScrollArea className="h-[600px] mt-4">
            <TabsContent value="deployments">
              {renderDeploymentComparison()}
            </TabsContent>
            <TabsContent value="pods">
              {renderPodComparison()}
            </TabsContent>
            <TabsContent value="services">
              {renderServiceComparison()}
            </TabsContent>
            <TabsContent value="configmaps">
              {renderConfigMapComparison()}
            </TabsContent>
            <TabsContent value="secrets">
              {renderSecretComparison()}
            </TabsContent>
            <TabsContent value="ingresses">
              <div className="text-center text-muted-foreground py-8">
                Ingress comparison coming soon...
              </div>
            </TabsContent>
            <TabsContent value="metrics">
              <NamespaceMetricsComparison selections={selections} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  )
}