import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { 
  Activity,
  Network,
  Share2,
  Globe,
  Shield,
  Database,
  Server,
  Info,
  FileCode,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { type ServiceInfo, type ServiceDetail, servicesService } from '@/services/services.service'
import { useTheme } from '@/components/theme-provider'

// Register YAML language
SyntaxHighlighter.registerLanguage('yaml', yaml)

interface ServiceDetailsProps {
  service: ServiceInfo | ServiceDetail
  context?: string
}

export function ServiceDetails({ service, context }: ServiceDetailsProps) {
  const [serviceDetail, setServiceDetail] = useState<ServiceDetail | null>(null)
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  
  const isDarkMode = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Check if we have detailed data
  const isDetailedData = 'uid' in service

  useEffect(() => {
    const fetchDetails = async () => {
      if (!isDetailedData && context) {
        setLoading(true)
        try {
          const detail = await servicesService.getService(
            context,
            service.namespace,
            service.name
          )
          setServiceDetail(detail)
          
          // Fetch endpoints
          const endpointsData = await servicesService.getServiceEndpoints(
            context,
            service.namespace,
            service.name
          )
          setEndpoints(endpointsData)
        } catch (error) {
          console.error('Failed to fetch service details:', error)
        } finally {
          setLoading(false)
        }
      } else if (isDetailedData) {
        setServiceDetail(service as ServiceDetail)
        setEndpoints((service as ServiceDetail).endpoints || [])
      }
    }

    fetchDetails()
  }, [service, context, isDetailedData])

  const data = serviceDetail || service

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ports">Ports</TabsTrigger>
        <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
        <TabsTrigger value="selectors">Selectors</TabsTrigger>
        <TabsTrigger value="yaml">YAML</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Service Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <Badge variant="default" className="text-xs">
                    {data.type || 'ClusterIP'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Cluster IP</span>
                  <span className="text-xs font-mono">
                    {data.clusterIP || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">External IP</span>
                  <span className="text-xs font-mono">
                    {(data as ServiceInfo).externalIP || (data as ServiceDetail).loadBalancerIP || '-'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Session Affinity</span>
                  <Badge variant="secondary" className="text-xs">
                    {(data as ServiceDetail).sessionAffinity || 'None'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">IP Families</span>
                  <span className="text-xs font-medium">
                    {(data as ServiceDetail).ipFamilies?.join(', ') || 'IPv4'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Age</span>
                  <span className="text-xs font-medium">
                    {(data as ServiceInfo).age || '-'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Load Balancer Status (if applicable) */}
        {data.type === 'LoadBalancer' && (data as ServiceDetail).status?.ingress && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Load Balancer Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data as ServiceDetail).status?.ingress?.map((ingress, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      {ingress.hostname ? 'Hostname' : 'IP'}
                    </span>
                    <span className="text-xs font-mono">
                      {ingress.hostname || ingress.ip || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Labels */}
        {data.labels && Object.keys(data.labels).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Labels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(data.labels).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Ports Tab */}
      <TabsContent value="ports" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Service Ports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data as ServiceInfo).ports?.length > 0 || (data as ServiceDetail).ports?.length > 0 ? (
              <div className="space-y-3">
                {((data as ServiceDetail).ports || (data as ServiceInfo).ports?.map(p => ({ 
                  port: parseInt(p.split(':')[0]), 
                  targetPort: p.split(':')[1] || p.split(':')[0],
                  protocol: p.includes('/') ? p.split('/')[1] : 'TCP',
                  name: p.includes('(') ? p.split('(')[1].replace(')', '') : undefined
                })))?.map((port: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    {idx > 0 && <Separator />}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Port</p>
                        <p className="text-xs font-mono">{port.port || port}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Target Port</p>
                        <p className="text-xs font-mono">{port.targetPort || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Protocol</p>
                        <Badge variant="outline" className="text-xs">{port.protocol || 'TCP'}</Badge>
                      </div>
                      {port.nodePort && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Node Port</p>
                          <p className="text-xs font-mono">{port.nodePort}</p>
                        </div>
                      )}
                      {port.name && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="text-xs">{port.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No ports configured</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Endpoints Tab */}
      <TabsContent value="endpoints" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" />
              Service Endpoints
            </CardTitle>
            <CardDescription className="text-xs">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} backing this service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {endpoints.length > 0 ? (
              <div className="space-y-2">
                {endpoints.map((endpoint, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {endpoint.ready ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs font-mono">{endpoint.ip}</span>
                      {endpoint.podName && (
                        <Badge variant="outline" className="text-xs">
                          {endpoint.podName}
                        </Badge>
                      )}
                    </div>
                    {endpoint.nodeName && (
                      <span className="text-xs text-muted-foreground">
                        Node: {endpoint.nodeName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                No endpoints available
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Selectors Tab */}
      <TabsContent value="selectors" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Pod Selectors
            </CardTitle>
            <CardDescription className="text-xs">
              Labels used to select pods for this service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.selectors && Object.keys(data.selectors).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(data.selectors).map(([key, value]) => (
                  <div key={key} className="flex justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-medium">{key}</span>
                    <span className="text-xs font-mono">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No selectors defined (headless service)</p>
            )}
          </CardContent>
        </Card>

        {/* Annotations */}
        {data.annotations && Object.keys(data.annotations).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Annotations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(data.annotations).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-medium">{key}</p>
                    <p className="text-xs text-muted-foreground break-all">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* YAML Tab */}
      <TabsContent value="yaml" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              Service YAML
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full">
              <div className="relative">
                <SyntaxHighlighter
                  language="yaml"
                  style={isDarkMode ? atomOneDark : atomOneLight}
                  customStyle={{
                    fontSize: '0.75rem',
                    lineHeight: '1.5',
                    padding: '1rem',
                    borderRadius: '0.375rem',
                    margin: 0,
                  }}
                  showLineNumbers
                >
                  {(data as ServiceDetail).yaml || `# Loading YAML...
apiVersion: v1
kind: Service
metadata:
  name: ${data.name}
  namespace: ${data.namespace}
spec:
  type: ${data.type || 'ClusterIP'}
  selector:
    ${Object.entries(data.selectors || {}).map(([k, v]) => `${k}: ${v}`).join('\n    ')}
  ports:
    ${(data as ServiceInfo).ports?.map(p => `- port: ${p}`).join('\n    ') || '[]'}`}
                </SyntaxHighlighter>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}