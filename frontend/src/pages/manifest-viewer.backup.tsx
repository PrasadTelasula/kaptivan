import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClusterStore } from '@/stores/cluster.store'
import { useTabsStore } from '@/stores/tabs.store'
import { cn } from '@/utils/cn'
import Editor from '@monaco-editor/react'
import { ManifestCompareDialog } from '@/components/manifest-compare-dialog'
import { RelatedResourcesPopover } from '@/components/related-resources-popover'
import { MultiSelectDropdown } from '@/components/multi-select-dropdown'
import { YamlOutline } from '@/components/yaml-outline'
import { TabManager } from '@/components/tab-manager'
import {
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Box,
  Layers,
  Package,
  GitBranch,
  Network,
  Cloud,
  Database,
  HardDrive,
  Shield,
  FileCode,
  Users,
  Server,
  Copy,
  Download,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  FileJson,
  Settings,
  Calendar,
  Lock,
  Cpu,
  Activity,
  GitCompare,
  SidebarOpen,
  SidebarClose,
  Info,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ResourceItem {
  name: string
  namespace?: string
  kind: string
  apiVersion: string
  uid?: string
  creationTimestamp?: string
  clusterContext?: string
  clusterName?: string
}

interface ResourceGroup {
  name: string
  icon: React.ElementType
  expanded: boolean
  items: ResourceItem[]
  loading: boolean
  clusters?: Map<string, ResourceItem[]> // Resources per cluster
}

interface ManifestTab {
  id: string
  title: string
  resource: ResourceItem
  content: string
  loading: boolean
}

const resourceCategories = [
  {
    category: 'Workloads',
    groups: [
      { name: 'Deployments', icon: Layers, apiVersion: 'apps/v1', kind: 'Deployment' },
      { name: 'ReplicaSets', icon: Package, apiVersion: 'apps/v1', kind: 'ReplicaSet' },
      { name: 'StatefulSets', icon: Database, apiVersion: 'apps/v1', kind: 'StatefulSet' },
      { name: 'DaemonSets', icon: GitBranch, apiVersion: 'apps/v1', kind: 'DaemonSet' },
      { name: 'Pods', icon: Box, apiVersion: 'v1', kind: 'Pod' },
      { name: 'Jobs', icon: Activity, apiVersion: 'batch/v1', kind: 'Job' },
      { name: 'CronJobs', icon: Calendar, apiVersion: 'batch/v1', kind: 'CronJob' },
    ]
  },
  {
    category: 'Networking',
    groups: [
      { name: 'Services', icon: Network, apiVersion: 'v1', kind: 'Service' },
      { name: 'Ingresses', icon: Cloud, apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
      { name: 'NetworkPolicies', icon: Shield, apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy' },
    ]
  },
  {
    category: 'Configuration',
    groups: [
      { name: 'ConfigMaps', icon: FileCode, apiVersion: 'v1', kind: 'ConfigMap' },
      { name: 'Secrets', icon: Lock, apiVersion: 'v1', kind: 'Secret' },
    ]
  },
  {
    category: 'Storage',
    groups: [
      { name: 'PersistentVolumes', icon: HardDrive, apiVersion: 'v1', kind: 'PersistentVolume' },
      { name: 'PersistentVolumeClaims', icon: HardDrive, apiVersion: 'v1', kind: 'PersistentVolumeClaim' },
      { name: 'StorageClasses', icon: Database, apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass' },
    ]
  },
  {
    category: 'Security',
    groups: [
      { name: 'ServiceAccounts', icon: Users, apiVersion: 'v1', kind: 'ServiceAccount' },
      { name: 'Roles', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role' },
      { name: 'RoleBindings', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding' },
      { name: 'ClusterRoles', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRole' },
      { name: 'ClusterRoleBindings', icon: Shield, apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRoleBinding' },
    ]
  },
  {
    category: 'Cluster',
    groups: [
      { name: 'Nodes', icon: Server, apiVersion: 'v1', kind: 'Node' },
      { name: 'Namespaces', icon: Folder, apiVersion: 'v1', kind: 'Namespace' },
      { name: 'ResourceQuotas', icon: Cpu, apiVersion: 'v1', kind: 'ResourceQuota' },
      { name: 'LimitRanges', icon: Settings, apiVersion: 'v1', kind: 'LimitRange' },
    ]
  }
]

export function ManifestViewerPage() {
  const { selectedContexts, clusters } = useClusterStore()
  const selectedClusters = clusters.filter(c => selectedContexts.includes(c.context) && c.connected)
  const { theme } = useTheme()
  
  // Tab management from store
  const {
    tabs: storeTabs,
    activeTabId: storeActiveTabId,
    addTab: storeAddTab,
    removeTab: storeRemoveTab,
    setActiveTab: storeSetActiveTab,
    nextTab,
    previousTab,
    isTabOpen,
  } = useTabsStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInYaml, setSearchInYaml] = useState(false)
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>([])
  const [resourceGroups, setResourceGroups] = useState<Map<string, ResourceGroup>>(new Map())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Workloads']))
  const [tabs, setTabs] = useState<ManifestTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedNamespace, setSelectedNamespace] = useState('all')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [compareLeft, setCompareLeft] = useState<{ content: string; title: string }>({ content: '', title: '' })
  const [compareRight, setCompareRight] = useState<{ content: string; title: string }>({ content: '', title: '' })
  const [showOutline, setShowOutline] = useState(false)
  const [showTabManager, setShowTabManager] = useState(false)
  const editorRefs = useRef<Map<string, any>>(new Map())

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab / Cmd+Tab - Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        nextTab()
      }
      // Ctrl+Shift+Tab / Cmd+Shift+Tab - Previous tab
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        previousTab()
      }
      // Ctrl+W / Cmd+W - Close current tab
      else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }
      // Ctrl+Shift+T / Cmd+Shift+T - Toggle tab manager
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 't') {
        e.preventDefault()
        setShowTabManager(prev => !prev)
      }
      // Ctrl+1-9 / Cmd+1-9 - Jump to specific tab
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (tabs[index]) {
          setActiveTabId(tabs[index].id)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, nextTab, previousTab])
  
  // Determine Monaco Editor theme based on app theme
  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  // Initialize resource groups
  useEffect(() => {
    const groups = new Map<string, ResourceGroup>()
    resourceCategories.forEach(category => {
      category.groups.forEach(group => {
        groups.set(group.name, {
          name: group.name,
          icon: group.icon,
          expanded: false,
          items: [],
          loading: false
        })
      })
    })
    setResourceGroups(groups)
  }, [])

  // Fetch namespaces - only when selected clusters actually change
  useEffect(() => {
    if (selectedClusters.length > 0) {
      fetchNamespaces()
    }
  }, [selectedClusters.map(c => c.context).join(',')]) // Use stable dependency

  // Track previous selected clusters to detect changes
  const [prevSelectedClusters, setPrevSelectedClusters] = useState<string[]>([])

  // Clear resources from deselected clusters and re-fetch for newly selected clusters
  useEffect(() => {
    const currentContexts = selectedClusters.map(c => c.context)
    const removedClusters = prevSelectedClusters.filter(c => !currentContexts.includes(c))
    const addedClusters = currentContexts.filter(c => !prevSelectedClusters.includes(c))
    
    // Clear resources from removed clusters
    if (removedClusters.length > 0) {
      setResourceGroups(prev => {
        const updated = new Map(prev)
        
        updated.forEach((group) => {
          if (group.items && group.items.length > 0) {
            // Filter items to only include those from selected clusters
            const filteredItems = group.items.filter(item => 
              !item.clusterContext || currentContexts.includes(item.clusterContext)
            )
            
            group.items = filteredItems
            
            // Also update the clusters map if it exists
            if (group.clusters) {
              const newClustersMap = new Map<string, ResourceItem[]>()
              group.clusters.forEach((items, clusterContext) => {
                if (currentContexts.includes(clusterContext)) {
                  newClustersMap.set(clusterContext, items)
                }
              })
              group.clusters = newClustersMap
            }
            
            // If no items left, collapse the group
            if (filteredItems.length === 0) {
              group.expanded = false
            }
          }
        })
        
        return updated
      })
    }
    
    // Store the contexts for next comparison
    setPrevSelectedClusters(currentContexts)
    
    // If clusters were added and we have expanded groups, re-fetch their resources
    // We do this in a timeout to ensure state is updated first
    if (addedClusters.length > 0 && currentContexts.length > 0) {
      setTimeout(() => {
        setResourceGroups(prev => {
          prev.forEach((group, groupName) => {
            if (group.expanded && group.items.length > 0) {
              // Find the resource type for this group
              const resourceType = resourceCategories
                .flatMap(cat => cat.groups)
                .find(g => g.name === groupName)
              
              if (resourceType) {
                // Re-fetch to include new clusters
                fetchResources(groupName, resourceType.kind, resourceType.apiVersion)
              }
            }
          })
          return prev
        })
      }, 100)
    }
  }, [selectedClusters.length]) // Only depend on length to avoid infinite loops

  const fetchNamespaces = async () => {
    try {
      // Fetch namespaces from first selected cluster (namespaces are usually consistent across clusters)
      const response = await fetch(`/api/v1/resources/namespaces?context=${selectedClusters[0]?.context}`)
      if (response.ok) {
        const data = await response.json()
        setNamespaces(data.items?.map((ns: any) => ns.name) || [])
      }
    } catch (error) {
      // Silently handle error
    }
  }

  const fetchResources = async (groupName: string, kind: string, apiVersion: string) => {
    if (selectedClusters.length === 0) {
      return
    }

    setResourceGroups(prev => {
      const updated = new Map(prev)
      const group = updated.get(groupName)
      if (group) {
        group.loading = true
      }
      return updated
    })

    try {
      const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
      
      // Fetch resources from all selected clusters in parallel
      const fetchPromises = selectedClusters.map(async (cluster) => {
        try {
          const response = await fetch(`/api/v1/manifests/list`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: cluster.context,
              namespace: namespace,
              kind: kind,
              apiVersion: apiVersion
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            const items = data.items?.map((item: any) => ({
              name: item.name,
              namespace: item.namespace,
              kind: item.kind,
              apiVersion: item.apiVersion || apiVersion,
              uid: item.uid,
              creationTimestamp: item.creationTimestamp,
              clusterContext: cluster.context,
              clusterName: cluster.name
            })) || []
            
            return { cluster: cluster.context, items }
          }
          return { cluster: cluster.context, items: [] }
        } catch (error) {
          console.error(`Failed to fetch from cluster ${cluster.name}:`, error)
          return { cluster: cluster.context, items: [] }
        }
      })

      const results = await Promise.all(fetchPromises)
      
      // Combine all items and organize by cluster
      const allItems: ResourceItem[] = []
      const clusterMap = new Map<string, ResourceItem[]>()
      
      results.forEach(result => {
        allItems.push(...result.items)
        clusterMap.set(result.cluster, result.items)
      })

      setResourceGroups(prev => {
        const updated = new Map(prev)
        const group = updated.get(groupName)
        if (group) {
          group.items = allItems
          group.clusters = clusterMap
          group.loading = false
          group.expanded = true
        }
        return updated
      })
    } catch (error) {
      setResourceGroups(prev => {
        const updated = new Map(prev)
        const group = updated.get(groupName)
        if (group) {
          group.loading = false
        }
        return updated
      })
    }
  }

  const fetchManifest = async (resource: ResourceItem) => {
    // Use resource's cluster context if available, otherwise use first selected cluster
    const clusterContext = resource.clusterContext || selectedClusters[0]?.context
    if (!clusterContext) return ''

    try {
      const params = new URLSearchParams()
      params.append('kind', resource.kind)
      params.append('apiVersion', resource.apiVersion)
      if (resource.namespace) {
        params.append('namespace', resource.namespace)
      }
      
      const endpoint = `/api/v1/manifests/${clusterContext}/${resource.name}?${params.toString()}`
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const yaml = await response.text()
        return yaml
      }
    } catch (error) {
      // Handle error silently
    }
    return '# Failed to load manifest'
  }

  const openResourceTab = async (resource: ResourceItem) => {
    // Check if tab is already open using the store
    const existingTab = isTabOpen({
      name: resource.name,
      namespace: resource.namespace,
      kind: resource.kind,
      apiVersion: resource.apiVersion,
      clusterContext: resource.clusterContext,
      clusterName: resource.clusterName,
    })
    
    if (existingTab) {
      setActiveTabId(existingTab.id)
      storeSetActiveTab(existingTab.id)
      return
    }

    const clusterPrefix = resource.clusterName ? `${resource.clusterName}-` : ''
    const tabId = `${clusterPrefix}${resource.kind}-${resource.namespace || 'cluster'}-${resource.name}`
    
    // Create new tab
    const newTab: ManifestTab = {
      id: tabId,
      title: `${resource.name}`,
      resource,
      content: '# Loading...',
      loading: true
    }

    // Add to both local state and store
    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
    
    // Add to store for persistence
    storeAddTab({
      title: resource.name,
      resource: {
        name: resource.name,
        namespace: resource.namespace,
        kind: resource.kind,
        apiVersion: resource.apiVersion,
        uid: resource.uid,
        clusterContext: resource.clusterContext,
        clusterName: resource.clusterName,
      }
    })

    // Fetch manifest
    const manifest = await fetchManifest(resource)
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, content: manifest, loading: false }
        : tab
    ))
  }

  const closeTab = (tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }
      return newTabs
    })
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const downloadYaml = (tab: ManifestTab) => {
    const blob = new Blob([tab.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab.resource.kind}-${tab.resource.name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCompareWithTab = (sourceTab: ManifestTab) => {
    // If there are other tabs, compare with the first different one
    const otherTab = tabs.find(t => t.id !== sourceTab.id)
    if (otherTab) {
      setCompareLeft({
        content: sourceTab.content,
        title: `${sourceTab.resource.kind}/${sourceTab.resource.name}`
      })
      setCompareRight({
        content: otherTab.content,
        title: `${otherTab.resource.kind}/${otherTab.resource.name}`
      })
    } else {
      // If no other tabs, allow pasting external content
      setCompareLeft({
        content: sourceTab.content,
        title: `${sourceTab.resource.kind}/${sourceTab.resource.name}`
      })
      setCompareRight({
        content: '',
        title: 'Paste YAML to compare'
      })
    }
    setCompareDialogOpen(true)
  }

  const handleCompareMultiple = () => {
    if (tabs.length >= 2) {
      setCompareLeft({
        content: tabs[0].content,
        title: `${tabs[0].resource.kind}/${tabs[0].resource.name}`
      })
      setCompareRight({
        content: tabs[1].content,
        title: `${tabs[1].resource.kind}/${tabs[1].resource.name}`
      })
      setCompareDialogOpen(true)
    }
  }
  
  // Render tab content (extracted for reuse)
  const renderTabsContent = () => {
    return tabs.map(tab => (
      <TabsContent key={tab.id} value={tab.id} className="m-0 flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {tab.resource.kind}/{tab.resource.apiVersion}
              </Badge>
              {tab.resource.namespace && (
                <Badge variant="secondary">
                  {tab.resource.namespace}
                </Badge>
              )}
              <span className="text-sm font-medium">{tab.resource.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold">Navigation Tips:</p>
                      <div className="space-y-1">
                        <div>• Use minimap for quick navigation</div>
                        <div>• Click fold icons to collapse/expand sections</div>
                        <div>• Toggle outline panel for structure view</div>
                        <div>• Scroll or use outline to jump to sections</div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowOutline(!showOutline)}
                title={showOutline ? "Hide outline" : "Show outline"}
              >
                {showOutline ? (
                  <SidebarClose className="h-3.5 w-3.5" />
                ) : (
                  <SidebarOpen className="h-3.5 w-3.5" />
                )}
              </Button>
              <RelatedResourcesPopover
                clusterContext={tab.resource.clusterContext || selectedClusters[0]?.context || ''}
                resourceName={tab.resource.name}
                resourceKind={tab.resource.kind}
                resourceApiVersion={tab.resource.apiVersion}
                resourceNamespace={tab.resource.namespace}
                clusterName={tab.resource.clusterName || selectedClusters[0]?.name || ''}
                onNavigate={(resource) => {
                  openResourceTab({
                    name: resource.name,
                    namespace: resource.namespace,
                    kind: resource.kind,
                    apiVersion: resource.apiVersion,
                    uid: resource.uid,
                    clusterContext: tab.resource.clusterContext,
                    clusterName: tab.resource.clusterName
                  })
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleCompareWithTab(tab)}
                disabled={tab.loading}
                title="Compare with another manifest"
              >
                <GitCompare className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => copyToClipboard(tab.content)}
                disabled={tab.loading}
                title="Copy to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => downloadYaml(tab)}
                disabled={tab.loading}
                title="Download YAML"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* YAML Content with Outline */}
          <div className="flex-1 min-h-0">
            {showOutline ? (
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                  <YamlOutline
                    content={tab.content}
                    onNavigate={(line) => {
                      const editor = editorRefs.current.get(tab.id)
                      if (editor) {
                        editor.revealLineInCenter(line)
                        editor.setPosition({ lineNumber: line, column: 1 })
                        editor.focus()
                      }
                    }}
                  />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={75}>
                  <Editor
                    height="100%"
                    language="yaml"
                    theme={getMonacoTheme()}
                    value={tab.content}
                    onMount={(editor) => {
                      editorRefs.current.set(tab.id, editor)
                    }}
                    beforeMount={(monaco) => {
                      monaco.languages.setLanguageConfiguration('yaml', {
                        comments: { lineComment: '#' },
                        brackets: [['{', '}'], ['[', ']']],
                        autoClosingPairs: [
                          { open: '{', close: '}' },
                          { open: '[', close: ']' },
                          { open: '"', close: '"' },
                          { open: "'", close: "'" },
                        ],
                        surroundingPairs: [
                          { open: '{', close: '}' },
                          { open: '[', close: ']' },
                          { open: '"', close: '"' },
                          { open: "'", close: "'" },
                        ],
                        folding: {
                          markers: {
                            start: /^(\s*)([\w\-]+):\s*$/,
                            end: /^\s*$/
                          }
                        },
                        indentationRules: {
                          increaseIndentPattern: /^(\s*)([\w\-]+):\s*$/,
                          decreaseIndentPattern: /^\s*$/
                        }
                      })
                    }}
                    options={{
                      readOnly: true,
                      minimap: { 
                        enabled: true,
                        showSlider: 'mouseover',
                        renderCharacters: false,
                        maxColumn: 80,
                        side: 'right'
                      },
                      fontSize: 13,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: 'on',
                      renderLineHighlight: 'none',
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      find: { enabled: false },
                      quickSuggestions: false,
                      suggestOnTriggerCharacters: false,
                      acceptSuggestionOnEnter: 'off',
                      folding: true,
                      foldingStrategy: 'indentation',
                      showFoldingControls: 'mouseover',
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        useShadows: false,
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                      },
                      selectionHighlight: false,
                      occurrencesHighlight: false,
                      copyWithSyntaxHighlighting: false,
                      contextmenu: false,
                      accessibilitySupport: 'off'
                    }}
                    loading={<div className="p-4 text-muted-foreground">Loading editor...</div>}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <Editor
                height="100%"
                language="yaml"
                theme={getMonacoTheme()}
                value={tab.content}
                onMount={(editor) => {
                  editorRefs.current.set(tab.id, editor)
                }}
                beforeMount={(monaco) => {
                  monaco.languages.setLanguageConfiguration('yaml', {
                    comments: { lineComment: '#' },
                    brackets: [['{', '}'], ['[', ']']],
                    autoClosingPairs: [
                      { open: '{', close: '}' },
                      { open: '[', close: ']' },
                      { open: '"', close: '"' },
                      { open: "'", close: "'" },
                    ],
                    surroundingPairs: [
                      { open: '{', close: '}' },
                      { open: '[', close: ']' },
                      { open: '"', close: '"' },
                      { open: "'", close: "'" },
                    ],
                    folding: {
                      markers: {
                        start: /^(\s*)([\w\-]+):\s*$/,
                        end: /^\s*$/
                      }
                    },
                    indentationRules: {
                      increaseIndentPattern: /^(\s*)([\w\-]+):\s*$/,
                      decreaseIndentPattern: /^\s*$/
                    }
                  })
                }}
                options={{
                  readOnly: true,
                  minimap: { 
                    enabled: true,
                    showSlider: 'mouseover',
                    renderCharacters: false,
                    maxColumn: 80,
                    side: 'right'
                  },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'none',
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  find: { enabled: false },
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: 'off',
                  folding: true,
                  foldingStrategy: 'indentation',
                  showFoldingControls: 'mouseover',
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                  selectionHighlight: false,
                  occurrencesHighlight: false,
                  copyWithSyntaxHighlighting: false,
                  contextmenu: false,
                  accessibilitySupport: 'off'
                }}
                loading={<div className="p-4 text-muted-foreground">Loading editor...</div>}
              />
            )}
          </div>
        </div>
      </TabsContent>
    ))
  }
  
  const renderTabContent = () => {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Manifest Viewer</h2>
            {tabs.length > 0 && (
              <Badge variant="secondary" className="h-5 px-2">
                {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowTabManager(!showTabManager)}
                    title="Toggle tab manager"
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-semibold mb-1">Tab Manager</p>
                    <p><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Shift+T</kbd></p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {tabs.length >= 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCompareMultiple}
                title="Compare first two tabs"
              >
                <GitCompare className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Tab content */}
        {tabs.length > 0 ? (
          <Tabs value={activeTabId || undefined} onValueChange={setActiveTabId} className="flex flex-col flex-1 min-h-0">
            <TabsList className="h-auto p-0 bg-transparent border-b rounded-none flex-shrink-0">
              <ScrollArea className="w-full" orientation="horizontal">
                <div className="flex gap-1 p-1">
                  {tabs.map(tab => (
                    <div key={tab.id} className="relative group">
                      <TabsTrigger
                        value={tab.id}
                        className={cn(
                          "relative rounded-t-md h-9 px-3 pr-8",
                          "data-[state=active]:bg-background",
                          "data-[state=active]:shadow-sm",
                          "data-[state=inactive]:bg-muted/50",
                          "border border-b-0",
                          "data-[state=active]:border-border",
                          "data-[state=inactive]:border-transparent"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {selectedClusters.length > 1 && tab.resource.clusterName && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                              {tab.resource.clusterName}
                            </Badge>
                          )}
                          <Badge variant="outline" className="h-5 px-1 text-xs">
                            {tab.resource.kind}
                          </Badge>
                          <span className="text-xs truncate max-w-[150px]">
                            {tab.resource.namespace && (
                              <span className="text-muted-foreground">
                                {tab.resource.namespace}/
                              </span>
                            )}
                            {tab.resource.name}
                          </span>
                        </span>
                      </TabsTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5",
                          "opacity-60 hover:opacity-100 transition-opacity"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsList>
            {renderTabsContent()}
          </Tabs>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <FileJson className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No Manifest Selected</p>
            <p className="text-sm mt-2">
              Select a resource from the tree to view its YAML manifest
            </p>
          </div>
        )}
      </>
    )
  }

  const toggleResourceGroup = (groupName: string, group: any) => {
    const currentGroup = resourceGroups.get(groupName)
    if (!currentGroup) return

    if (!currentGroup.expanded && currentGroup.items.length === 0) {
      fetchResources(groupName, group.kind, group.apiVersion)
    } else {
      setResourceGroups(prev => {
        const updated = new Map(prev)
        const g = updated.get(groupName)
        if (g) {
          g.expanded = !g.expanded
        }
        return updated
      })
    }
  }

  const filteredCategories = useMemo(() => {
    let filtered = resourceCategories

    // Filter by resource types
    if (selectedResourceTypes.length > 0) {
      filtered = filtered.map(category => ({
        ...category,
        groups: category.groups.filter(group => selectedResourceTypes.includes(group.kind))
      })).filter(category => category.groups.length > 0)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      
      filtered = filtered.map(category => ({
        ...category,
        groups: category.groups.filter(group => {
          const groupData = resourceGroups.get(group.name)
          
          // Check if group name matches
          if (group.name.toLowerCase().includes(query)) return true
          
          // Check if any resource name matches
          if (groupData?.items.some(item => 
            item.name.toLowerCase().includes(query) ||
            (item.namespace && item.namespace.toLowerCase().includes(query))
          )) return true
          
          // If search in YAML is enabled, check YAML content of open tabs
          if (searchInYaml && tabs.length > 0) {
            return tabs.some(tab => 
              tab.resource.kind === group.kind &&
              tab.content.toLowerCase().includes(query)
            )
          }
          
          return false
        })
      })).filter(category => category.groups.length > 0)
    }

    return filtered
  }, [searchQuery, searchInYaml, selectedResourceTypes, resourceGroups, tabs])

  // Show message if no clusters are selected
  if (selectedClusters.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[calc(100vh-3.5rem)]">
          <Sidebar className="hidden lg:block border-r" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No Clusters Selected</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please select one or more clusters from the cluster selector to view manifests
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {!isFullscreen && <Header />}
      <div className={cn("flex", isFullscreen ? "h-screen" : "h-[calc(100vh-3.5rem)]")}>
        {!isFullscreen && <Sidebar className="hidden lg:block border-r" />}
        
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - Resource Tree */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
              <div className="h-full flex flex-col">
                {/* Tree Header */}
                <div className="p-3 border-b space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      Resources
                      {(selectedNamespace !== 'all' || selectedResourceTypes.length > 0 || searchQuery) && (
                        <Badge variant="secondary" className="h-5 px-2 text-xs font-normal">
                          {[
                            selectedNamespace !== 'all' && 1,
                            selectedResourceTypes.length > 0 && 1,
                            searchQuery && 1
                          ].filter(Boolean).reduce((a, b) => a + b, 0)} active
                        </Badge>
                      )}
                    </h2>
                    <div className="flex items-center gap-1">
                      {(selectedNamespace !== 'all' || selectedResourceTypes.length > 0 || searchQuery || searchInYaml) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedNamespace('all')
                            setSelectedResourceTypes([])
                            setSearchQuery('')
                            setSearchInYaml(false)
                          }}
                          title="Clear filters"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.reload()}
                        className="h-8 w-8"
                        title="Refresh"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Filters Section */}
                  <div className="flex items-center gap-2 mb-2">
                    <Select 
                      value={selectedNamespace} 
                      onValueChange={(value) => {
                        setSelectedNamespace(value)
                        // Clear loaded resources when namespace changes
                        setResourceGroups(prev => {
                          const updated = new Map(prev)
                          updated.forEach(group => {
                            group.items = []
                            group.expanded = false
                          })
                          return updated
                        })
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Namespace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Namespaces</SelectItem>
                        <Separator className="my-1" />
                        {namespaces.map(ns => (
                          <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <MultiSelectDropdown
                      options={resourceCategories.flatMap(cat => 
                        cat.groups.map(g => ({
                          value: g.kind,
                          label: g.name,
                          category: cat.category
                        }))
                      )}
                      selected={selectedResourceTypes}
                      onChange={setSelectedResourceTypes}
                      placeholder="All Types"
                      className="flex-1"
                    />
                  </div>

                  {/* Enhanced Search */}
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={searchInYaml ? "Search in names & YAML..." : "Search resources..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 h-7 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        id="searchInYaml"
                        checked={searchInYaml}
                        onChange={(e) => setSearchInYaml(e.target.checked)}
                        className="h-3 w-3 rounded border-gray-300"
                      />
                      <Label 
                        htmlFor="searchInYaml" 
                        className="text-[10px] text-muted-foreground cursor-pointer select-none"
                      >
                        Search in YAML content
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Resource Tree */}
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {filteredCategories.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Search className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No resources found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try adjusting your filters or search query
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setSelectedNamespace('all')
                            setSelectedResourceTypes([])
                            setSearchQuery('')
                            setSearchInYaml(false)
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    ) : (
                      filteredCategories.map((category) => (
                      <div key={category.category} className="mb-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-8 px-2 font-semibold text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedCategories(prev => {
                            const updated = new Set(prev)
                            if (updated.has(category.category)) {
                              updated.delete(category.category)
                            } else {
                              updated.add(category.category)
                            }
                            return updated
                          })}
                        >
                          {expandedCategories.has(category.category) ? (
                            <ChevronDown className="h-3 w-3 mr-1" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-1" />
                          )}
                          {category.category}
                        </Button>

                        {expandedCategories.has(category.category) && (
                          <div className="ml-2">
                            {category.groups.map((group) => {
                              const groupData = resourceGroups.get(group.name)
                              const Icon = group.icon

                              return (
                                <div key={group.name}>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start h-7 px-2 text-sm hover:bg-accent"
                                    onClick={() => toggleResourceGroup(group.name, group)}
                                  >
                                    {groupData?.expanded ? (
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 mr-1" />
                                    )}
                                    <Icon className="h-3 w-3 mr-2" />
                                    <span className="flex-1 text-left">{group.name}</span>
                                    {groupData?.loading && (
                                      <RefreshCw className="h-3 w-3 animate-spin ml-2" />
                                    )}
                                    {groupData?.items.length > 0 && (
                                      <Badge variant="secondary" className="h-5 px-1 text-xs">
                                        {groupData.items.length}
                                      </Badge>
                                    )}
                                  </Button>

                                  {groupData?.expanded && (
                                    <div className="ml-6">
                                      {groupData.items.map((item) => (
                                        <Button
                                          key={`${item.clusterContext}-${item.namespace}-${item.name}`}
                                          variant="ghost"
                                          className="w-full justify-start h-6 px-2 text-xs hover:bg-accent group"
                                          onClick={() => openResourceTab(item)}
                                        >
                                          <FileText className="h-3 w-3 mr-2 flex-shrink-0" />
                                          <span className="truncate flex-1 text-left">
                                            {selectedClusters.length > 1 && item.clusterName && (
                                              <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                                                {item.clusterName}
                                              </Badge>
                                            )}
                                            {item.namespace && (
                                              <span className="text-muted-foreground">{item.namespace}/</span>
                                            )}
                                            {item.name}
                                          </span>
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right Panel - YAML Viewer with Tab Manager */}
            <ResizablePanel defaultSize={70}>
              {showTabManager ? (
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                    <TabManager
                      currentTabs={tabs}
                      activeTabId={activeTabId}
                      onTabSelect={setActiveTabId}
                      onTabClose={closeTab}
                      onTabsReorder={setTabs}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={75}>
                    <div className="h-full flex flex-col">
                      {renderTabContent()}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full flex flex-col">
                  {renderTabContent()}
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Compare Dialog */}
      <ManifestCompareDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        leftContent={compareLeft.content}
        leftTitle={compareLeft.title}
        rightContent={compareRight.content}
        rightTitle={compareRight.title}
      />
    </div>
  )
}