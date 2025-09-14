import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { LintResults } from './components/LintResults'
import { linterService } from '@/services/linterService'
import { Shield, Loader2, AlertCircle, FileUp, Copy, Trash2, ChevronLeft, ChevronRight, Settings2, FileCode2, Server, Upload, FileSearch, Database, FolderOpen, Package } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useTheme } from '@/components/theme-provider'
import { useClusterStore } from '@/stores/cluster.store'
import { apiUrls } from '@/utils/api-urls'
import { useRef } from 'react'

export interface LintResult {
  check: string
  severity: string
  message: string
  remediation: string
  object: string
  line: number
  column: number
}

interface ResourceType {
  name: string
  kind: string
  apiVersion: string
}

const RESOURCE_TYPES: ResourceType[] = [
  { name: 'Deployments', kind: 'Deployment', apiVersion: 'apps/v1' },
  { name: 'Pods', kind: 'Pod', apiVersion: 'v1' },
  { name: 'Services', kind: 'Service', apiVersion: 'v1' },
  { name: 'ConfigMaps', kind: 'ConfigMap', apiVersion: 'v1' },
  { name: 'Secrets', kind: 'Secret', apiVersion: 'v1' },
  { name: 'StatefulSets', kind: 'StatefulSet', apiVersion: 'apps/v1' },
  { name: 'DaemonSets', kind: 'DaemonSet', apiVersion: 'apps/v1' },
  { name: 'Jobs', kind: 'Job', apiVersion: 'batch/v1' },
  { name: 'CronJobs', kind: 'CronJob', apiVersion: 'batch/v1' },
  { name: 'Ingresses', kind: 'Ingress', apiVersion: 'networking.k8s.io/v1' },
  { name: 'NetworkPolicies', kind: 'NetworkPolicy', apiVersion: 'networking.k8s.io/v1' },
  { name: 'PersistentVolumeClaims', kind: 'PersistentVolumeClaim', apiVersion: 'v1' },
]

export function LintingPage() {
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)
  
  const [yamlContent, setYamlContent] = useState<string>('')
  const [lintResults, setLintResults] = useState<LintResult[]>([])
  const [isLinting, setIsLinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'manual' | 'fetch'>('manual')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Fetch from cluster states
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [selectedNamespace, setSelectedNamespace] = useState<string>('default')
  const [selectedResourceType, setSelectedResourceType] = useState<ResourceType | null>(null)
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [resources, setResources] = useState<any[]>([])
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false)
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [isFetchingManifest, setIsFetchingManifest] = useState(false)

  useEffect(() => {
    if (selectedClusters.length > 0 && !selectedCluster) {
      setSelectedCluster(selectedClusters[0].context)
    }
  }, [selectedClusters, selectedCluster])

  useEffect(() => {
    if (selectedCluster) {
      fetchNamespaces()
    }
  }, [selectedCluster])

  useEffect(() => {
    if (selectedCluster && selectedNamespace && selectedResourceType) {
      fetchResources()
    }
  }, [selectedCluster, selectedNamespace, selectedResourceType])

  const fetchNamespaces = async () => {
    setIsLoadingNamespaces(true)
    try {
      const response = await fetch(`/api/v1/resources/namespaces?context=${selectedCluster}`)
      if (response.ok) {
        const data = await response.json()
        setNamespaces(data.items?.map((ns: any) => ns.name) || [])
      }
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
    } finally {
      setIsLoadingNamespaces(false)
    }
  }

  const fetchResources = async () => {
    if (!selectedResourceType) return
    
    setIsLoadingResources(true)
    setResources([])
    
    try {
      const response = await fetch(`/api/v1/manifests/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: selectedCluster,
          namespace: selectedNamespace,
          kind: selectedResourceType.kind,
          apiVersion: selectedResourceType.apiVersion,
          enhance: false
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setResources(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error)
    } finally {
      setIsLoadingResources(false)
    }
  }

  const fetchManifest = async (resource: any) => {
    setIsFetchingManifest(true)
    setSelectedResource(resource)
    
    try {
      const endpoint = apiUrls.manifests.get(selectedCluster, resource.name, {
        kind: resource.kind,
        apiVersion: resource.apiVersion || selectedResourceType?.apiVersion,
        namespace: resource.namespace
      })
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const yaml = await response.text()
        setYamlContent(yaml)
        setLintResults([])
        setError(null)
      }
    } catch (error) {
      console.error('Failed to fetch manifest:', error)
    } finally {
      setIsFetchingManifest(false)
    }
  }

  const handleLint = async () => {
    if (!yamlContent.trim()) {
      setError('Please provide YAML content to lint')
      return
    }

    setIsLinting(true)
    setError(null)
    
    try {
      const response = await linterService.lintManifest({ 
        yaml: yamlContent, 
        namespace: selectedResource?.namespace || selectedNamespace,
        kind: selectedResource?.kind || selectedResourceType?.kind
      })
      setLintResults(response.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lint YAML')
      setLintResults([])
    } finally {
      setIsLinting(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setYamlContent(content)
        setLintResults([])
        setError(null)
      }
      reader.readAsText(file)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleClear = () => {
    setYamlContent('')
    setLintResults([])
    setError(null)
    setSelectedResource(null)
  }

  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  const sampleYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 p-4 overflow-hidden">
          {/* Title */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              YAML Linter
            </h2>
            <p className="text-xs text-muted-foreground">
              Validate Kubernetes manifests for best practices and security
            </p>
          </div>

          {/* Layout with Resizable Panels */}
          <div className="flex gap-2 h-[calc(100vh-120px)]">
            {/* Left Sidebar - Collapsible Filters */}
            <div className={cn(
              "transition-all duration-300 ease-in-out border rounded-lg bg-card shrink-0",
              sidebarCollapsed ? "w-12" : "w-64"
            )}>
              <div className="h-full flex flex-col">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-3 border-b">
                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">Input Source</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-auto"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  >
                    {sidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Sidebar Content */}
                {!sidebarCollapsed && (
                  <div className="flex-1 overflow-y-auto">
                    <Accordion 
                      type="single" 
                      collapsible 
                      defaultValue="mode"
                      className="w-full"
                    >
                      {/* Mode Selection */}
                      <AccordionItem value="mode" className="border-none">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <FileSearch className="h-4 w-4" />
                            <span className="text-sm font-medium">Source Type</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          <div className="space-y-2">
                            <div 
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
                                inputMode === 'manual' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                              )}
                              onClick={() => setInputMode('manual')}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2",
                                inputMode === 'manual' ? 'border-primary bg-primary' : 'border-muted-foreground'
                              )}>
                                {inputMode === 'manual' && (
                                  <div className="w-full h-full rounded-full bg-background scale-50" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <FileCode2 className="h-4 w-4" />
                                  <span className="text-sm font-medium">Manual Input</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Paste or type YAML directly
                                </p>
                              </div>
                            </div>
                            
                            <div 
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
                                inputMode === 'fetch' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                              )}
                              onClick={() => setInputMode('fetch')}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2",
                                inputMode === 'fetch' ? 'border-primary bg-primary' : 'border-muted-foreground'
                              )}>
                                {inputMode === 'fetch' && (
                                  <div className="w-full h-full rounded-full bg-background scale-50" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Database className="h-4 w-4" />
                                  <span className="text-sm font-medium">Fetch from Cluster</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Load from running resources
                                </p>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Fetch Options */}
                      {inputMode === 'fetch' && (
                        <AccordionItem value="fetch-options" className="border-none">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              <span className="text-sm font-medium">Cluster Selection</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Cluster</Label>
                              <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select cluster" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedClusters.map((cluster) => (
                                    <SelectItem key={cluster.context} value={cluster.context}>
                                      {cluster.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Namespace</Label>
                              <Select 
                                value={selectedNamespace} 
                                onValueChange={setSelectedNamespace}
                                disabled={!selectedCluster}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select namespace" />
                                </SelectTrigger>
                                <SelectContent>
                                  {namespaces.map((ns) => (
                                    <SelectItem key={ns} value={ns}>
                                      {ns}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Resource Type</Label>
                              <Select 
                                value={selectedResourceType?.kind || ''} 
                                onValueChange={(value) => {
                                  const type = RESOURCE_TYPES.find(t => t.kind === value)
                                  setSelectedResourceType(type || null)
                                }}
                                disabled={!selectedNamespace}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RESOURCE_TYPES.map((type) => (
                                    <SelectItem key={type.kind} value={type.kind}>
                                      <div className="flex items-center gap-2">
                                        <Package className="h-3 w-3" />
                                        {type.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Resources List */}
                            {selectedResourceType && resources.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs">Available Resources ({resources.length})</Label>
                                <div className="border rounded-lg max-h-64 overflow-y-auto">
                                  {resources.map((resource) => (
                                    <div
                                      key={resource.uid || resource.name}
                                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 border-b last:border-0 group"
                                    >
                                      <span className="text-sm truncate">{resource.name}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => fetchManifest(resource)}
                                        disabled={isFetchingManifest && selectedResource?.name === resource.name}
                                      >
                                        {isFetchingManifest && selectedResource?.name === resource.name ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <FileSearch className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isLoadingResources && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* Manual Input Options */}
                      {inputMode === 'manual' && (
                        <AccordionItem value="manual-options" className="border-none">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              <span className="text-sm font-medium">Quick Actions</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => setYamlContent(sampleYaml)}
                            >
                              <FileCode2 className="h-4 w-4 mr-2" />
                              Load Sample YAML
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FileUp className="h-4 w-4 mr-2" />
                              Upload YAML File
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleClear}
                              disabled={!yamlContent}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Clear Content
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </div>
                )}
              </div>
            </div>

            {/* Resizable Panels for YAML Editor and Results */}
            <ResizablePanelGroup 
              direction="horizontal" 
              className="flex-1 rounded-lg"
            >
              <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
                <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {inputMode === 'manual' ? 'YAML Content' : 'Fetched YAML'}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".yaml,.yml"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCopy}
                        disabled={!yamlContent}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleClear}
                        disabled={!yamlContent}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-2">
                  <div className="h-full border rounded-md overflow-hidden">
                    <Editor
                      height="100%"
                      language="yaml"
                      theme={getMonacoTheme()}
                      value={yamlContent}
                      onChange={(val) => {
                        if (inputMode === 'manual') {
                          setYamlContent(val || '')
                          setLintResults([])
                          setError(null)
                        }
                      }}
                      options={{
                        readOnly: inputMode === 'fetch',
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        lineNumbers: 'on',
                      }}
                    />
                  </div>
                  {!yamlContent && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {inputMode === 'manual' ? (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">Paste your YAML or</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="pointer-events-auto"
                            onClick={() => setYamlContent(sampleYaml)}
                          >
                            Load Sample
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a resource from above to fetch its YAML
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
                <div className="border-t p-3">
                  <Button
                    className="w-full"
                    onClick={handleLint}
                    disabled={!yamlContent || isLinting}
                  >
                    {isLinting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Linting...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Run Linter
                      </>
                    )}
                  </Button>
                </div>
                </Card>
              </ResizablePanel>
              
              <ResizableHandle withHandle className="mx-2" />
              
              <ResizablePanel defaultSize={60} minSize={40}>
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Linting Results</CardTitle>
                    {lintResults.length > 0 && (
                      <Badge variant="outline">
                        {lintResults.length} issue{lintResults.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 overflow-auto">
                  {error ? (
                    <Alert className="border-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : lintResults.length > 0 ? (
                    <LintResults 
                      results={lintResults} 
                      error={null}
                      yamlContent={yamlContent}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {yamlContent ? 'Click "Run Linter" to check for issues' : 'Enter YAML content to start linting'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </main>
      </div>
    </div>
  )
}