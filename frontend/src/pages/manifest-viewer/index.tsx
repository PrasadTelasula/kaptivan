import { useState, useEffect, useCallback, useRef } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TabManager } from '@/components/tab-manager'
import { ManifestCompareDialog } from '@/components/manifest-compare-dialog'
import { RelatedResourcesPopover } from '@/components/related-resources-popover'
import { TemplateLibrary } from '@/components/template-library'
import { useTabsStore } from '@/stores/tabs.store'
import { GitCompare, Copy, Download, SidebarOpen, SidebarClose, Maximize2, Minimize2, Info, X, BookOpen } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { YamlOutline } from '@/components/yaml-outline'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/utils/cn'
import { apiUrls } from '@/utils/api-urls'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ResourceTree } from './components/ResourceTree'
import { ManifestTabs } from './components/ManifestTabs'
import { TabContent } from './components/TabContent'
import type { ResourceItem, ResourceGroup, ManifestTab } from './types'
import { RESOURCE_CATEGORIES } from './constants'

interface ManifestViewerProps {
  selectedClusters: Array<{ name: string; context: string }>
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function ManifestViewer({ selectedClusters = [], isFullscreen = false, onToggleFullscreen }: ManifestViewerProps) {
  const { theme } = useTheme()
  const [resourceGroups, setResourceGroups] = useState<Map<string, ResourceGroup>>(new Map())
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [tabs, setTabs] = useState<ManifestTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showOutline, setShowOutline] = useState(false)
  const [showTabManager, setShowTabManager] = useState(false)
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [compareLeft, setCompareLeft] = useState<{ content: string; title: string }>({ content: '', title: '' })
  const [compareRight, setCompareRight] = useState<{ content: string; title: string }>({ content: '', title: '' })
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false)
  const editorRefs = useRef<Map<string, any>>(new Map())

  // Monaco Editor theme based on app theme
  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  // Tab store integration
  const { 
    addTab, 
    removeTab, 
    setActiveTab
  } = useTabsStore()

  // Initialize resource groups
  useEffect(() => {
    const groups = new Map<string, ResourceGroup>()
    RESOURCE_CATEGORIES.forEach(category => {
      category.groups.forEach(group => {
        groups.set(group.name, {
          name: group.name,
          icon: group.icon,
          expanded: false,
          items: [],
          loading: false,
          clusters: new Map()
        })
      })
    })
    setResourceGroups(groups)
  }, [])

  // Fetch namespaces when clusters change
  useEffect(() => {
    if (selectedClusters?.length > 0) {
      fetchNamespaces()
    }
  }, [selectedClusters])

  const fetchNamespaces = async () => {
    try {
      const response = await fetch(`/api/v1/resources/namespaces?context=${selectedClusters[0]?.context}`)
      if (response.ok) {
        const data = await response.json()
        setNamespaces(data.items?.map((ns: any) => ns.name) || [])
      }
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
    }
  }

  const fetchResources = async (groupName: string, kind: string, apiVersion: string) => {
    console.log('fetchResources called:', { groupName, kind, apiVersion, selectedClusters })
    if (!selectedClusters || selectedClusters.length === 0) {
      console.log('No clusters selected')
      return
    }

    setResourceGroups(prev => {
      const updated = new Map(prev)
      const group = updated.get(groupName)
      if (group) {
        updated.set(groupName, { ...group, loading: true })
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
          console.log('Setting resources for group:', groupName, 'items:', allItems)
          updated.set(groupName, {
            ...group,
            items: allItems,
            clusters: clusterMap,
            loading: false,
            expanded: true
          })
        }
        return updated
      })
    } catch (error) {
      console.error('Failed to fetch resources:', error)
      setResourceGroups(prev => {
        const updated = new Map(prev)
        const group = updated.get(groupName)
        if (group) {
          updated.set(groupName, { ...group, loading: false })
        }
        return updated
      })
    }
  }

  const fetchManifest = async (resource: ResourceItem) => {
    const clusterContext = resource.clusterContext || selectedClusters[0]?.context
    if (!clusterContext) return ''

    try {
      const endpoint = apiUrls.manifests.get(clusterContext, resource.name, {
        kind: resource.kind,
        apiVersion: resource.apiVersion,
        namespace: resource.namespace
      })
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const yaml = await response.text()
        return yaml
      }
    } catch (error) {
      console.error('Failed to fetch manifest:', error)
    }
    return '# Failed to load manifest'
  }

  // Utility functions for tab actions
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const downloadYaml = (tab: ManifestTab) => {
    const blob = new Blob([tab.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab.resource.kind}-${tab.resource.name}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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

  // Refresh all data
  const handleRefresh = useCallback(() => {
    fetchNamespaces()
    // Clear all resource items
    setResourceGroups(prev => {
      const updated = new Map(prev)
      updated.forEach((group, key) => {
        updated.set(key, { ...group, items: [], clusters: new Map(), expanded: false })
      })
      return updated
    })
  }, [])

  // Handle resource group toggle
  const handleGroupToggle = useCallback((groupName: string, groupDef: any) => {
    console.log('handleGroupToggle called:', { groupName, groupDef })
    const currentGroup = resourceGroups.get(groupName)
    console.log('currentGroup:', currentGroup)
    if (!currentGroup) return
    
    if (!currentGroup.expanded && currentGroup.items.length === 0) {
      console.log('Fetching resources for:', groupName)
      fetchResources(groupName, groupDef.kind, groupDef.apiVersion)
    } else {
      console.log('Just toggling expansion for:', groupName)
      setResourceGroups(prev => {
        const updated = new Map(prev)
        const group = updated.get(groupName)
        if (group) {
          updated.set(groupName, { ...group, expanded: !group.expanded })
        }
        return updated
      })
    }
  }, [resourceGroups, selectedNamespace, selectedClusters])

  // Handle resource selection
  const handleResourceSelect = useCallback(async (resource: ResourceItem) => {
    const tabId = `${resource.clusterContext}-${resource.namespace || 'cluster'}-${resource.name}-${resource.kind}`
    
    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tabId)
    if (existingTab) {
      setActiveTabId(tabId)
      setActiveTab(tabId)
      return
    }

    // Create new tab with initial content
    const newTab: ManifestTab = {
      id: tabId,
      title: resource.name,
      resource,
      content: '# Loading manifest...',
      loading: true
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)

    // Add to tab store
    addTab({
      title: resource.name,
      resource: {
        name: resource.name,
        namespace: resource.namespace,
        kind: resource.kind,
        apiVersion: resource.apiVersion,
        uid: resource.uid,
        clusterContext: resource.clusterContext,
        clusterName: resource.clusterName
      }
    })

    // Fetch manifest content
    const manifest = await fetchManifest(resource)
    setTabs(prev => prev.map(t => 
      t.id === tabId ? { ...t, content: manifest, loading: false } : t
    ))
  }, [tabs, fetchManifest, addTab, setActiveTab])

  // Handle related resource navigation
  const handleNavigateToRelated = useCallback(async (relatedResource: any) => {
    // Convert related resource to ResourceItem format
    const resourceItem: ResourceItem = {
      name: relatedResource.name,
      namespace: relatedResource.namespace,
      kind: relatedResource.kind,
      apiVersion: relatedResource.apiVersion,
      uid: relatedResource.uid,
      clusterContext: selectedClusters[0]?.context, // Use first selected cluster
      clusterName: selectedClusters[0]?.name
    }

    // Open the related resource in a new tab
    await handleResourceSelect(resourceItem)
  }, [selectedClusters, handleResourceSelect])

  // Handle tab close
  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId))
    removeTab(tabId)
    
    // Switch to previous tab if closing active tab
    if (activeTabId === tabId) {
      const remainingTabs = tabs.filter(t => t.id !== tabId)
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id)
      }
    }
  }, [activeTabId, tabs, removeTab])

  // Handle bulk compare
  const handleBulkCompare = useCallback(async (resources: ResourceItem[]) => {
    if (resources.length < 2) return
    
    // For now, compare the first two resources
    const [first, second] = resources
    
    // Fetch manifests for both resources
    const [firstManifest, secondManifest] = await Promise.all([
      fetchManifest(first),
      fetchManifest(second)
    ])
    
    setCompareLeft({
      content: firstManifest,
      title: `${first.namespace ? first.namespace + '/' : ''}${first.name}`
    })
    setCompareRight({
      content: secondManifest,
      title: `${second.namespace ? second.namespace + '/' : ''}${second.name}`
    })
    setCompareDialogOpen(true)
  }, [fetchManifest])

  // Handle bulk export
  const handleBulkExport = useCallback(async (resources: ResourceItem[]) => {
    // Fetch all manifests
    const manifests = await Promise.all(
      resources.map(async (resource) => {
        const manifest = await fetchManifest(resource)
        return {
          name: `${resource.namespace ? resource.namespace + '-' : ''}${resource.name}-${resource.kind}.yaml`,
          content: manifest
        }
      })
    )
    
    // Create a zip file or download multiple files
    // For now, let's download as a single combined YAML file
    const combinedYaml = manifests
      .map(m => `# ${m.name}\n---\n${m.content}`)
      .join('\n')
    
    const blob = new Blob([combinedYaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resources-${Date.now()}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [fetchManifest])

  // Handle tab refresh
  const handleTabRefresh = useCallback(async (tab: ManifestTab) => {
    setTabs(prev => prev.map(t => 
      t.id === tab.id ? { ...t, loading: true } : t
    ))

    const manifest = await fetchManifest(tab.resource)
    setTabs(prev => prev.map(t => 
      t.id === tab.id ? { ...t, content: manifest, loading: false } : t
    ))
  }, [fetchManifest])

  // Handle namespace change
  const handleNamespaceChange = useCallback((namespace: string) => {
    setSelectedNamespace(namespace)
    // Clear resource groups when namespace changes
    setResourceGroups(prev => {
      const updated = new Map(prev)
      updated.forEach((group, key) => {
        updated.set(key, { ...group, items: [], clusters: new Map(), expanded: false })
      })
      return updated
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Tab: Switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault()
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length
        if (tabs[nextIndex]) {
          setActiveTabId(tabs[nextIndex].id)
        }
      }
      
      // Ctrl/Cmd + W: Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          handleTabClose(activeTabId)
        }
      }
      
      // Ctrl/Cmd + Shift + T: Reopen closed tab (placeholder for future implementation)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        // TODO: Implement reopen closed tab functionality
      }
      
      // Ctrl/Cmd + Shift + M: Toggle tab manager
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setShowTabManager(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, handleTabClose])

  // Render tab content functions from backup
  const renderTabsContent = () => {
    return tabs.map(tab => (
      <TabsContent key={tab.id} value={tab.id} className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
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
                      <Info className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
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
                onClick={() => setTemplateLibraryOpen(true)}
                title="Template library"
              >
                <BookOpen className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowOutline(!showOutline)}
                title={showOutline ? "Hide outline" : "Show outline"}
              >
                {showOutline ? (
                  <SidebarClose className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <SidebarOpen className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
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
                  handleResourceSelect({
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
                <GitCompare className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => copyToClipboard(tab.content)}
                disabled={tab.loading}
                title="Copy to clipboard"
              >
                <Copy className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => downloadYaml(tab)}
                disabled={tab.loading}
                title="Download YAML"
              >
                <Download className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
              </Button>
            </div>
          </div>

          {/* YAML Content with Outline */}
          <div className="flex-1 min-h-0">
            {showOutline ? (
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel id="yaml-outline" order={1} defaultSize={25} minSize={15} maxSize={40}>
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
                <ResizablePanel id="yaml-editor-with-outline" order={2} defaultSize={75}>
                  <Editor
                    key={`${tab.id}-${showOutline}-with-outline`}
                    height="100%"
                    language="yaml"
                    theme={getMonacoTheme()}
                    value={tab.content || '# No content available'}
                    onMount={(editor) => {
                      editorRefs.current.set(tab.id, editor)
                      // Force layout update after mount
                      setTimeout(() => editor.layout(), 100)
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
                key={`${tab.id}-${showOutline}`}
                height="100%"
                language="yaml"
                theme={getMonacoTheme()}
                value={tab.content || '# No content available'}
                onMount={(editor) => {
                  editorRefs.current.set(tab.id, editor)
                  // Force layout update after mount
                  setTimeout(() => editor.layout(), 100)
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
              <span className="text-xs text-muted-foreground">
                {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowTabManager(!showTabManager)}
              title="Toggle tab manager"
            >
              <Info className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            </Button>
            {onToggleFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Tab content */}
        {tabs.length > 0 ? (
          <Tabs value={activeTabId} onValueChange={setActiveTabId} className="flex flex-col flex-1 min-h-0">
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
                          handleTabClose(tab.id)
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
            <div className="text-center">
              <div className="text-muted-foreground text-sm">
                No manifests open. Select a resource from the tree to view its manifest.
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel id="resource-tree" order={1} defaultSize={25} minSize={20} maxSize={40}>
          <ResourceTree
            resourceGroups={resourceGroups}
            selectedNamespace={selectedNamespace}
            namespaces={namespaces}
            selectedClusters={selectedClusters}
            onResourceSelect={handleResourceSelect}
            onGroupToggle={handleGroupToggle}
            onNamespaceChange={handleNamespaceChange}
            onRefresh={handleRefresh}
            onBulkCompare={handleBulkCompare}
            onBulkExport={handleBulkExport}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel id="manifest-viewer" order={2} defaultSize={75}>
          <div className="h-full flex flex-col">
            {renderTabContent()}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {showTabManager && (
        <TabManager
          isOpen={showTabManager}
          onClose={() => setShowTabManager(false)}
        />
      )}

      <ManifestCompareDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        leftContent={compareLeft.content}
        leftTitle={compareLeft.title}
        rightContent={compareRight.content}
        rightTitle={compareRight.title}
      />

      <TemplateLibrary
        open={templateLibraryOpen}
        onOpenChange={setTemplateLibraryOpen}
        currentResource={
          activeTabId && tabs.find(t => t.id === activeTabId) 
            ? {
                content: tabs.find(t => t.id === activeTabId)!.content,
                kind: tabs.find(t => t.id === activeTabId)!.resource.kind,
                apiVersion: tabs.find(t => t.id === activeTabId)!.resource.apiVersion,
                name: tabs.find(t => t.id === activeTabId)!.resource.name,
                namespace: tabs.find(t => t.id === activeTabId)!.resource.namespace,
              }
            : undefined
        }
        onApplyTemplate={(template) => {
          // Create a new tab with the template content
          const tabId = `template-${template.id}-${Date.now()}`
          const newTab: ManifestTab = {
            id: tabId,
            title: template.name,
            resource: {
              name: template.name,
              kind: template.kind,
              apiVersion: template.apiVersion,
              namespace: template.namespace || '',
              uid: '',
              clusterContext: '',
              clusterName: ''
            },
            content: template.content,
            loading: false
          }
          setTabs(prev => [...prev, newTab])
          setActiveTabId(tabId)
        }}
      />
    </>
  )
}