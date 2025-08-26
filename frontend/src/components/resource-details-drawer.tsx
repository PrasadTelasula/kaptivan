import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useTheme } from '@/components/theme-provider'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  Clock, 
  Server, 
  Network, 
  Tag, 
  Container,
  HardDrive,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Layers,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Shield,
  GitBranch,
  Cpu,
  MemoryStick,
  Zap,
  Share2,
  FileText,
  Settings,
  Database,
  Key,
  Globe,
  Box,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import { type PodInfo, resourcesService } from '@/services/resources.service'
import { type ServiceInfo, type ServiceDetail } from '@/services/services.service'
import { type DeploymentInfo, type DeploymentDetail } from '@/services/deployments.service'

// Register YAML language
SyntaxHighlighter.registerLanguage('yaml', yaml)

interface ResourceDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource: PodInfo | ServiceInfo | ServiceDetail | DeploymentInfo | DeploymentDetail | null
  resourceType: 'pod' | 'deployment' | 'service' | 'node'
  context?: string
  onNext?: () => void
  onPrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
  currentIndex?: number
  totalCount?: number
}

export function ResourceDetailsDrawer({
  open,
  onOpenChange,
  resource,
  resourceType,
  context,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  currentIndex,
  totalCount
}: ResourceDetailsDrawerProps) {
  const [podDetails, setPodDetails] = useState<any>(null)
  const [podEvents, setPodEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [drawerWidth, setDrawerWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  
  // Determine if we should use dark mode
  const isDarkMode = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  const fetchPodDetails = useCallback(async () => {
    if (!resource || !context) return
    
    setLoading(true)
    try {
      // Fetch pod details
      const details = await resourcesService.getPod(context, resource.namespace, resource.name)
      setPodDetails(details)
      
      // Fetch pod events
      const eventsResponse = await resourcesService.getPodEvents(context, resource.namespace, resource.name)
      setPodEvents(eventsResponse.events || [])
    } catch (error) {
      console.error('Failed to fetch pod details:', error)
    } finally {
      setLoading(false)
    }
  }, [resource, context])
  
  useEffect(() => {
    if (open && resource && context) {
      fetchPodDetails()
    }
  }, [open, resource, context, fetchPodDetails])
  
  const pod = resource as PodInfo

  const getStatusIcon = (status: string | undefined) => {
    if (!status) return <Info className="h-4 w-4 text-gray-500" />
    
    switch (status.toLowerCase()) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusVariant = (status: string | undefined) => {
    if (!status) return 'outline' as const
    
    switch (status.toLowerCase()) {
      case 'running':
        return 'default' as const
      case 'pending':
        return 'secondary' as const
      case 'failed':
      case 'error':
        return 'destructive' as const
      default:
        return 'outline' as const
    }
  }
  
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])
  
  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])
  
  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= 400 && newWidth <= 1200) {
      setDrawerWidth(newWidth)
    }
  }, [isResizing])
  
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize)
      document.addEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    return () => {
      document.removeEventListener('mousemove', resize)
      document.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  if (!resource) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          className="p-0 border-l bg-background font-sans"
          style={{ width: `${drawerWidth}px`, maxWidth: `${drawerWidth}px` }}
        >
        {/* Navigation Controls - improved bubble design */}
        {(onNext || onPrevious) && (
          <div className="absolute top-6 -left-16">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="group relative bg-background/95 backdrop-blur border-2 border-primary/20 hover:border-primary/40 rounded-full p-2 shadow-sm hover:shadow-md hover:scale-105 hover:bg-primary/5 disabled:opacity-40 disabled:border-border/30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent transition-all duration-200"
                title="Previous pod"
              >
                <ChevronUp className="h-4 w-4 text-foreground/70 group-hover:text-primary" />
              </button>
              
              {currentIndex && totalCount && (
                <div className="bg-background/95 backdrop-blur border-2 border-accent/20 rounded-full px-2.5 py-1.5 shadow-sm min-w-[48px] text-center">
                  <div className="text-xs font-medium text-foreground/80">
                    {currentIndex}
                    <span className="text-muted-foreground mx-0.5">/</span>
                    {totalCount}
                  </div>
                </div>
              )}
              
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="group relative bg-background/95 backdrop-blur border-2 border-primary/20 hover:border-primary/40 rounded-full p-2 shadow-sm hover:shadow-md hover:scale-105 hover:bg-primary/5 disabled:opacity-40 disabled:border-border/30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent transition-all duration-200"
                title="Next pod"
              >
                <ChevronDown className="h-4 w-4 text-foreground/70 group-hover:text-primary" />
              </button>
            </div>
          </div>
        )}
        
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-50 group"
          onMouseDown={startResizing}
          style={{
            backgroundColor: isResizing ? 'hsl(var(--primary) / 0.3)' : undefined
          }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-3 w-2.5 text-muted-foreground" />
          </div>
        </div>
        
        <div className="h-full flex flex-col bg-background">
          <div className="px-4 py-3 border-b bg-background">
            <div className="flex items-center gap-2">
              <Container className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-semibold truncate">{resource?.name || 'Unknown'}</h2>
                {context && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <Badge variant="outline" className="text-xs px-2 py-0">
                      <Server className="h-3 w-3 mr-1" />
                      {context}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pod details and configuration
            </p>
          </div>
        
        {/* Vertical Tabs Layout */}
        <Tabs defaultValue="overview" className="flex h-full" orientation="vertical">
          {/* Vertical Tab List - Collapsible */}
          <div className={`${isSidebarCollapsed ? 'w-12' : 'w-48'} border-r bg-muted/30 flex flex-col transition-all duration-300`}>
            {/* Collapse Toggle Button */}
            <div className="p-2 border-b">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full flex items-center justify-center p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <TabsList className="flex flex-col h-auto bg-transparent p-2 gap-1">
              <TabsTrigger 
                value="overview" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "Overview" : undefined}
              >
                <Info className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "Overview"}
              </TabsTrigger>
              {resourceType === 'pod' && (
                <TabsTrigger 
                  value="containers" 
                  className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                  title={isSidebarCollapsed ? "Containers" : undefined}
                >
                  <Container className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                  {!isSidebarCollapsed && "Containers"}
                </TabsTrigger>
              )}
              {resourceType === 'deployment' && (
                <TabsTrigger 
                  value="podtemplate" 
                  className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                  title={isSidebarCollapsed ? "Pod Template" : undefined}
                >
                  <Layers className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                  {!isSidebarCollapsed && "Pod Template"}
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="metadata" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "Metadata" : undefined}
              >
                <Tag className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "Metadata"}
              </TabsTrigger>
              <TabsTrigger 
                value="network" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "Network" : undefined}
              >
                <Network className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "Network"}
              </TabsTrigger>
              <TabsTrigger 
                value="env" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "Environment" : undefined}
              >
                <Settings className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "Environment"}
              </TabsTrigger>
              <TabsTrigger 
                value="yaml" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "YAML" : undefined}
              >
                <FileCode className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "YAML"}
              </TabsTrigger>
              <TabsTrigger 
                value="events" 
                className={`w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-2.5 text-xs font-medium rounded-lg hover:bg-muted/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all`}
                title={isSidebarCollapsed ? "Events" : undefined}
              >
                <Zap className={`h-4 w-4 ${isSidebarCollapsed ? '' : 'mr-2'}`} />
                {!isSidebarCollapsed && "Events"}
              </TabsTrigger>
            </TabsList>
            
            {/* Resource info at bottom - hide when collapsed */}
            {!isSidebarCollapsed && (
              <div className="mt-auto p-3 border-t">
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium mb-1">Resource</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      <span className="capitalize">{resourceType || 'Resource'}</span>
                    </div>
                    <div className="truncate" title={resource?.namespace}>
                      {resource?.namespace || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Tab Content Area */}
          <ScrollArea className="flex-1 bg-background">
            {loading && (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">Loading pod details...</div>
              </div>
            )}

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-4 space-y-4 mt-0">
              <div className="grid gap-4">
                {/* Status Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Status Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {resourceType === 'service' ? (
                      // Service status
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Type</span>
                            <Badge variant="default" className="text-xs">
                              {(resource as any)?.type || 'ClusterIP'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Cluster IP</span>
                            <span className="text-xs font-mono">
                              {(resource as any)?.clusterIP || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">External IP</span>
                            <span className="text-xs font-mono">
                              {(resource as any)?.externalIP || (resource as any)?.loadBalancerIP || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Session Affinity</span>
                            <Badge variant="secondary" className="text-xs">
                              {(resource as any)?.sessionAffinity || 'None'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">IP Families</span>
                            <span className="text-xs font-medium">
                              {(resource as any)?.ipFamilies?.join(', ') || 'IPv4'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Age</span>
                            <span className="text-xs font-medium">
                              {(resource as any)?.age || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : resourceType === 'deployment' ? (
                      // Deployment status
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Replicas</span>
                            <Badge variant="default" className="text-xs">
                              {(resource as any)?.replicas || (resource as any)?.statusReplicas || '-'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Updated</span>
                            <span className="text-xs font-medium">
                              {(resource as any)?.updatedReplicas || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Available</span>
                            <span className="text-xs font-medium">
                              {(resource as any)?.availableReplicas || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Strategy</span>
                            <Badge variant="secondary" className="text-xs">
                              {(resource as any)?.strategy?.type || (resource as any)?.strategy || 'RollingUpdate'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Generation</span>
                            <span className="text-xs font-medium">
                              {(resource as any)?.generation || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Pod status
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Phase</span>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(podDetails?.phase || pod?.status)}
                              <Badge variant={getStatusVariant(podDetails?.phase || pod?.status)} className="text-xs">
                                {podDetails?.phase || pod?.status || '-'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Ready</span>
                            <span className="text-xs font-medium">
                              {podDetails?.containerStatuses ? 
                                `${podDetails.containerStatuses.filter((c: any) => c.ready).length}/${podDetails.containerStatuses.length}` 
                                : pod?.ready || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Restarts</span>
                            <Badge variant={pod?.restarts > 0 ? "secondary" : "outline"} className="text-xs">
                              {podDetails?.containerStatuses ? 
                                podDetails.containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0)
                                : pod?.restarts || 0}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Age</span>
                            <span className="text-xs font-medium">{pod?.age || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">QoS Class</span>
                            <Badge variant="outline" className="text-xs">{podDetails?.qosClass || 'BestEffort'}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Priority</span>
                            <span className="text-xs font-medium">{podDetails?.priority || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resource Allocation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      Resource Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {podDetails?.containers?.map((container: any, idx: number) => {
                        const resources = container.resources || {}
                        return (
                          <div key={idx} className="space-y-2">
                            {idx > 0 && <Separator />}
                            <p className="text-xs font-medium">{container.name}</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">CPU Request</p>
                                <p className="text-xs font-medium">{resources.requests?.cpu || 'Not set'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">CPU Limit</p>
                                <p className="text-xs font-medium">{resources.limits?.cpu || 'Not set'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Memory Request</p>
                                <p className="text-xs font-medium">{resources.requests?.memory || 'Not set'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Memory Limit</p>
                                <p className="text-xs font-medium">{resources.limits?.memory || 'Not set'}</p>
                              </div>
                            </div>
                          </div>
                        )
                      }) || (
                        <div className="text-xs text-muted-foreground">No resource information available</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Node Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Node Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Node Name</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{podDetails?.nodeName || pod?.node || '-'}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Host IP</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{podDetails?.hostIP || 'N/A'}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Pod IP</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{podDetails?.podIP || pod?.ip || 'N/A'}</code>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Containers Tab */}
            <TabsContent value="containers" className="p-4 space-y-4 mt-0">
              {(podDetails?.containers || pod?.containers)?.map((container: any, index: number) => {
                const containerStatus = podDetails?.containerStatuses?.find((cs: any) => 
                  cs.name === (typeof container === 'string' ? container : container.name)
                )
                const containerName = typeof container === 'string' ? container : container.name
                
                return (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Container className="h-4 w-4" />
                      {containerName}
                    </CardTitle>
                    <CardDescription className="text-xs">Container Details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Image</p>
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                              {container.image || containerStatus?.image || 'N/A'}
                            </code>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Image Pull Policy</p>
                            <Badge variant="outline" className="text-xs">
                              {container.imagePullPolicy || 'IfNotPresent'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">State</p>
                            <Badge variant={containerStatus?.ready ? "default" : "secondary"} className="text-xs">
                              {containerStatus?.state ? Object.keys(containerStatus.state)[0] : 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Started At</p>
                            <p className="text-xs">
                              {containerStatus?.state?.running?.startedAt || 
                               containerStatus?.state?.terminated?.startedAt || 
                               'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Restart Count</p>
                            <Badge variant={(containerStatus?.restartCount || 0) > 0 ? "secondary" : "outline"} className="text-xs">
                              {containerStatus?.restartCount || 0}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Container ID</p>
                            <code className="text-xs font-['JetBrains_Mono'] truncate block">
                              {containerStatus?.containerID ? 
                                containerStatus.containerID.substring(0, 20) + '...' : 
                                'N/A'}
                            </code>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <p className="text-xs font-medium mb-2">Ports</p>
                        <div className="space-y-1">
                          {container.ports && container.ports.length > 0 ? (
                            container.ports.map((port: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {port.containerPort}/{port.protocol || 'TCP'}
                                </Badge>
                                {port.name && (
                                  <span className="text-xs text-muted-foreground">→ {port.name}</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No ports exposed</span>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium mb-2">Volume Mounts</p>
                        <div className="space-y-1">
                          {container.volumeMounts && container.volumeMounts.length > 0 ? (
                            <div className="text-xs space-y-1">
                              {container.volumeMounts.map((mount: any, idx: number) => (
                                <div key={idx} className="flex justify-between">
                                  <code className="bg-muted px-1 rounded font-['JetBrains_Mono']">{mount.mountPath}</code>
                                  <span className="text-muted-foreground">→ {mount.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No volume mounts</span>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-medium mb-2">Probes</p>
                        <div className="space-y-2">
                          {container.livenessProbe && (
                            <div>
                              <p className="text-xs text-muted-foreground">Liveness</p>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                                {container.livenessProbe.httpGet ? 
                                  `HTTP GET :${container.livenessProbe.httpGet.port}${container.livenessProbe.httpGet.path}` :
                                  container.livenessProbe.exec ? 
                                    `Exec: ${container.livenessProbe.exec.command?.join(' ')}` :
                                    container.livenessProbe.tcpSocket ?
                                      `TCP :${container.livenessProbe.tcpSocket.port}` :
                                      'Configured'}
                              </code>
                            </div>
                          )}
                          {container.readinessProbe && (
                            <div>
                              <p className="text-xs text-muted-foreground">Readiness</p>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                                {container.readinessProbe.httpGet ? 
                                  `HTTP GET :${container.readinessProbe.httpGet.port}${container.readinessProbe.httpGet.path}` :
                                  container.readinessProbe.exec ? 
                                    `Exec: ${container.readinessProbe.exec.command?.join(' ')}` :
                                    container.readinessProbe.tcpSocket ?
                                      `TCP :${container.readinessProbe.tcpSocket.port}` :
                                      'Configured'}
                              </code>
                            </div>
                          )}
                          {!container.livenessProbe && !container.readinessProbe && (
                            <span className="text-xs text-muted-foreground">No probes configured</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )
              }) || (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-sm text-muted-foreground text-center">No container information available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Pod Template Tab for Deployments */}
            {resourceType === 'deployment' && (
              <TabsContent value="podtemplate" className="p-4 space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Container className="h-4 w-4" />
                      Containers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(resource as any)?.podTemplate?.containers?.map((container: any, index: number) => (
                        <div key={index} className="space-y-3 pb-3 border-b last:border-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{container.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {container.imagePullPolicy || 'IfNotPresent'}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-muted-foreground min-w-[60px]">Image:</span>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded break-all">
                                {container.image}
                              </code>
                            </div>
                            
                            {container.ports?.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground min-w-[60px]">Ports:</span>
                                <div className="flex gap-2 flex-wrap">
                                  {container.ports.map((port: any, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {port.name ? `${port.name}: ` : ''}{port.containerPort}/{port.protocol || 'TCP'}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {container.env?.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground min-w-[60px]">Env:</span>
                                <div className="space-y-1">
                                  {container.env.slice(0, 3).map((env: any, i: number) => (
                                    <div key={i} className="text-xs">
                                      <span className="font-mono">{env.name}</span>
                                      {env.value && <span className="text-muted-foreground"> = {env.value}</span>}
                                    </div>
                                  ))}
                                  {container.env.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{container.env.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {(container.resources?.limits || container.resources?.requests) && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground min-w-[60px]">Resources:</span>
                                <div className="space-y-1 text-xs">
                                  {container.resources?.requests && (
                                    <div>
                                      <span className="text-muted-foreground">Requests:</span>
                                      {container.resources.requests.cpu && <span> CPU: {container.resources.requests.cpu}</span>}
                                      {container.resources.requests.memory && <span> Memory: {container.resources.requests.memory}</span>}
                                    </div>
                                  )}
                                  {container.resources?.limits && (
                                    <div>
                                      <span className="text-muted-foreground">Limits:</span>
                                      {container.resources.limits.cpu && <span> CPU: {container.resources.limits.cpu}</span>}
                                      {container.resources.limits.memory && <span> Memory: {container.resources.limits.memory}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {container.volumeMounts?.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground min-w-[60px]">Mounts:</span>
                                <div className="space-y-1">
                                  {container.volumeMounts.map((mount: any, i: number) => (
                                    <div key={i} className="text-xs">
                                      <span className="font-mono">{mount.mountPath}</span>
                                      <span className="text-muted-foreground"> ← {mount.name}</span>
                                      {mount.readOnly && <Badge variant="outline" className="ml-1 text-xs h-4 px-1">RO</Badge>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )) || (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No container information available
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Volumes */}
                {(resource as any)?.podTemplate?.volumes?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Volumes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(resource as any).podTemplate.volumes.map((volume: any, index: number) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{volume.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {Object.keys(volume.source || {})[0] || 'Unknown'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Node Selector */}
                {(resource as any)?.podTemplate?.nodeSelector && Object.keys((resource as any).podTemplate.nodeSelector).length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Node Selector
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {Object.entries((resource as any).podTemplate.nodeSelector).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-mono">{key}</span>
                            <span className="text-muted-foreground"> = </span>
                            <span className="font-mono">{value as string}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {/* Metadata Tab */}
            <TabsContent value="metadata" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Labels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {resource?.labels && Object.keys(resource.labels).length > 0 ? (
                      Object.entries(resource.labels).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}={value}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No labels defined</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Annotations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {podDetails?.annotations && Object.keys(podDetails.annotations).length > 0 ? (
                      <div className="text-xs space-y-1">
                        {Object.entries(podDetails.annotations).slice(0, 10).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <code className="text-muted-foreground font-['JetBrains_Mono'] truncate flex-1">{key}</code>
                            <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono'] truncate max-w-[200px]">
                              {String(value)}
                            </code>
                          </div>
                        ))}
                        {Object.keys(podDetails.annotations).length > 10 && (
                          <p className="text-xs text-muted-foreground">... and {Object.keys(podDetails.annotations).length - 10} more</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No annotations defined</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Object Meta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{resource?.name || '-'}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Namespace</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{resource?.namespace || '-'}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UID</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono'] truncate">
                        {podDetails?.uid || 'N/A'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resource Version</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                        {podDetails?.resourceVersion || 'N/A'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Generation</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                        {podDetails?.generation || '0'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creation Timestamp</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                        {podDetails?.creationTimestamp || (resource as any)?.age || '-'}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Owner References
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {podDetails?.ownerReferences && podDetails.ownerReferences.length > 0 ? (
                      podDetails.ownerReferences.map((owner: any, idx: number) => (
                        <div key={idx} className="border rounded p-2">
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Kind</span>
                              <Badge variant="outline" className="text-xs">{owner.kind}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name</span>
                              <code className="text-xs font-['JetBrains_Mono']">{owner.name}</code>
                            </div>
                            {owner.controller !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Controller</span>
                                <Badge variant={owner.controller ? "default" : "secondary"} className="text-xs">
                                  {String(owner.controller)}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No owner references</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Network Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Pod IP</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                        {podDetails?.podIP || pod?.ip || 'Pending'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Pod IPs</span>
                      <div className="flex flex-col gap-1">
                        {podDetails?.podIPs?.map((ip: any, idx: number) => (
                          <code key={idx} className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                            {ip.ip}
                          </code>
                        )) || (
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                            {podDetails?.podIP || pod?.ip || 'N/A'}
                          </code>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">DNS Policy</span>
                      <Badge variant="outline" className="text-xs">
                        {podDetails?.dnsPolicy || 'ClusterFirst'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Hostname</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">
                        {podDetails?.hostname || resource?.name || '-'}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="border rounded p-2">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">nginx-service</span>
                          <Badge variant="secondary" className="text-xs">ClusterIP</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cluster IP</span>
                          <code className="font-['JetBrains_Mono']">10.96.0.1</code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Port</span>
                          <code className="font-['JetBrains_Mono']">80:31234/TCP</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Topology
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zone</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">us-east-1a</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Region</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">us-east-1</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node</span>
                      <code className="bg-muted px-2 py-0.5 rounded font-['JetBrains_Mono']">{pod?.node || '-'}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Environment Tab */}
            <TabsContent value="env" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Environment Variables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {podDetails?.containers?.map((container: any, cidx: number) => (
                      <div key={cidx} className="space-y-2">
                        {cidx > 0 && <Separator />}
                        <p className="text-xs font-medium">{container.name}</p>
                        {container.env && container.env.length > 0 ? (
                          <div className="font-['JetBrains_Mono'] text-xs space-y-1">
                            {container.env.slice(0, 20).map((envVar: any, idx: number) => (
                              <div key={idx} className="flex justify-between p-1 hover:bg-muted rounded">
                                <span className="text-primary truncate flex-1">{envVar.name}</span>
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {envVar.value || envVar.valueFrom ? '(from source)' : 'N/A'}
                                </span>
                              </div>
                            ))}
                            {container.env.length > 20 && (
                              <p className="text-xs text-muted-foreground">... and {container.env.length - 20} more</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No environment variables</span>
                        )}
                      </div>
                    )) || (
                      <span className="text-xs text-muted-foreground">No environment variables available</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    ConfigMaps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="border rounded p-2">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">app-config</span>
                          <Badge variant="outline" className="text-xs">Mounted</Badge>
                        </div>
                        <div className="text-muted-foreground">
                          <p>Keys: database.url, api.key, feature.flags</p>
                          <p className="mt-1">Mount Path: /etc/config</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Secrets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="border rounded p-2">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">default-token-xyz</span>
                          <Badge variant="outline" className="text-xs">ServiceAccount</Badge>
                        </div>
                        <div className="text-muted-foreground">
                          <p>Type: kubernetes.io/service-account-token</p>
                          <p>Mount Path: /var/run/secrets/kubernetes.io/serviceaccount</p>
                        </div>
                      </div>
                    </div>
                    <div className="border rounded p-2">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">tls-secret</span>
                          <Badge variant="outline" className="text-xs">TLS</Badge>
                        </div>
                        <div className="text-muted-foreground">
                          <p>Type: kubernetes.io/tls</p>
                          <p>Keys: tls.crt, tls.key</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* YAML Tab */}
            <TabsContent value="yaml" className="p-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Pod Manifest
                  </CardTitle>
                  <CardDescription className="text-xs">Full YAML configuration (without managedFields)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language="yaml"
                      style={isDarkMode ? atomOneDark : atomOneLight}
                      customStyle={{
                        margin: 0,
                        fontSize: '0.75rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        maxHeight: '600px',
                        overflow: 'auto',
                        backgroundColor: isDarkMode ? '#282c34' : '#fafafa',
                      }}
                      showLineNumbers={true}
                      lineNumberStyle={{ 
                        color: isDarkMode ? '#6b7280' : '#9ca3af', 
                        fontSize: '0.7rem' 
                      }}
                    >
                      {podDetails?.yaml || (resource as any)?.yaml || `# Loading YAML...
apiVersion: v1
kind: ${resourceType === 'deployment' ? 'Deployment' : 'Pod'}
metadata:
  name: ${resource?.name || 'resource-name'}
  namespace: ${resource?.namespace || 'default'}
spec:
  ${resourceType === 'deployment' ? `replicas: ${(resource as any)?.replicas || 1}` : `containers:
  - name: ${pod?.containers?.[0] || 'container'}
    image: pending
  nodeName: ${pod?.node || 'node-name'}`}
status:
  ${resourceType === 'deployment' ? `replicas: ${(resource as any)?.statusReplicas || 0}` : `phase: ${pod?.status || 'Unknown'}
  podIP: ${pod?.ip || 'null'}`}`}
                    </SyntaxHighlighter>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="p-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Recent Events
                  </CardTitle>
                  <CardDescription className="text-xs">Pod lifecycle events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {podEvents && podEvents.length > 0 ? (
                      podEvents.map((event: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded border">
                          <Badge 
                            variant={event.type === 'Normal' ? 'default' : 'destructive'} 
                            className="text-xs mt-0.5"
                          >
                            {event.type}
                          </Badge>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{event.reason}</span>
                              <span className="text-xs text-muted-foreground">
                                • {event.firstTimestamp || event.eventTime || event.age || 'Recently'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{event.message}</p>
                            {event.count > 1 && (
                              <p className="text-xs text-muted-foreground">
                                Count: {event.count} | Last seen: {event.lastTimestamp || 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No events available for this pod
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}