import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Loader2, AlertCircle } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { apiUrls } from '@/utils/api-urls'
import Editor from '@monaco-editor/react'
import { useTheme } from '@/components/theme-provider'

interface ResourceFetcherProps {
  onResourceFetched: (yaml: string, namespace?: string, kind?: string, name?: string) => void
  onLint: (yaml: string, namespace?: string, kind?: string) => void
  isLinting: boolean
  currentYaml: string
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

export function ResourceFetcher({ onResourceFetched, onLint, isLinting, currentYaml }: ResourceFetcherProps) {
  const { theme } = useTheme()
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)
  
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
        onResourceFetched(yaml, resource.namespace, resource.kind, resource.name)
      }
    } catch (error) {
      console.error('Failed to fetch manifest:', error)
    } finally {
      setIsFetchingManifest(false)
    }
  }

  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  if (!selectedClusters.length) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No clusters are selected. Please select a cluster from the sidebar first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fetch from Cluster</CardTitle>
          <CardDescription>
            Select cluster resources to fetch and lint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Simple Dropdowns */}
          <div className="grid grid-cols-3 gap-3">
            <Select value={selectedCluster} onValueChange={setSelectedCluster}>
              <SelectTrigger>
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

            <Select 
              value={selectedNamespace} 
              onValueChange={setSelectedNamespace}
              disabled={!selectedCluster}
            >
              <SelectTrigger>
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

            <Select 
              value={selectedResourceType?.kind || ''} 
              onValueChange={(value) => {
                const type = RESOURCE_TYPES.find(t => t.kind === value)
                setSelectedResourceType(type || null)
              }}
              disabled={!selectedNamespace}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select resource type" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.kind} value={type.kind}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resources List */}
          {selectedResourceType && resources.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Available {selectedResourceType.name}</div>
              <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
                {resources.map((resource) => (
                  <div
                    key={resource.uid || resource.name}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded"
                  >
                    <span className="font-medium">{resource.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => fetchManifest(resource)}
                      disabled={isFetchingManifest && selectedResource?.name === resource.name}
                    >
                      {isFetchingManifest && selectedResource?.name === resource.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Fetch'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoadingResources && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* YAML Display */}
      {currentYaml && selectedResource && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedResource.kind}: {selectedResource.name}</CardTitle>
            <CardDescription>Review and lint the manifest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden h-[300px]">
              <Editor
                height="100%"
                language="yaml"
                theme={getMonacoTheme()}
                value={currentYaml}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                }}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => onLint(currentYaml, selectedResource?.namespace, selectedResource?.kind)}
                disabled={isLinting}
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
          </CardContent>
        </Card>
      )}

    </div>
  )
}