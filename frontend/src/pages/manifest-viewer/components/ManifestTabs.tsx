import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { X, RefreshCw, FileJson, GitCompare, Copy, Download, SidebarOpen, SidebarClose, Maximize2, Minimize2, Info } from 'lucide-react'
import { RelatedResourcesPopover } from '@/components/related-resources-popover'
import { cn } from '@/utils/cn'
import type { ManifestTab } from '../types'

interface ManifestTabsProps {
  tabs: ManifestTab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabRefresh: (tab: ManifestTab) => void
  onTabCompare?: (tab: ManifestTab) => void
  onTabCopy?: (content: string) => void
  onTabDownload?: (tab: ManifestTab) => void
  onCompareMultiple?: () => void
  showOutline?: boolean
  onToggleOutline?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onToggleTabManager?: () => void
  onNavigateToRelated?: (resource: any) => void
  selectedClusters?: Array<{ name: string; context: string }>
}

export function ManifestTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabRefresh,
  onTabCompare,
  onTabCopy,
  onTabDownload,
  onCompareMultiple,
  showOutline,
  onToggleOutline,
  isFullscreen,
  onToggleFullscreen,
  onToggleTabManager,
  onNavigateToRelated,
  selectedClusters = []
}: ManifestTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No manifests open</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select a resource from the tree to view its manifest
          </p>
        </div>
      </div>
    )
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <Tabs value={activeTabId} onValueChange={onTabSelect} className="h-full flex flex-col">
      <div className="border-b">
        <div className="flex items-center justify-between">
          <TabsList className="h-10 flex-1 justify-start rounded-none bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "relative h-10 rounded-none border-b-2 border-transparent px-3",
                "data-[state=active]:border-primary data-[state=active]:shadow-none",
                "flex items-center gap-2 group"
              )}
            >
              <FileJson className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate text-xs">
                {tab.resource.namespace && (
                  <span className="text-muted-foreground">{tab.resource.namespace}/</span>
                )}
                {tab.title}
              </span>
              {tab.resource.clusterName && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  {tab.resource.clusterName}
                </Badge>
              )}
              <div className="flex items-center gap-0.5 ml-1">
                {tab.loading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <div
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center rounded-sm hover:bg-accent transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTabRefresh(tab)
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </div>
                )}
                <div
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center rounded-sm hover:bg-accent transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </div>
              </div>
            </TabsTrigger>
          ))}
          </TabsList>
          
          {/* Action buttons for active tab */}
          {activeTab && (
            <div className="flex items-center gap-1 px-2">
              {onTabCompare && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onTabCompare(activeTab)}
                  disabled={activeTab.loading}
                  title="Compare with another manifest"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {onTabCopy && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onTabCopy(activeTab.content)}
                  disabled={activeTab.loading}
                  title="Copy to clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {onTabDownload && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onTabDownload(activeTab)}
                  disabled={activeTab.loading}
                  title="Download YAML"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {onNavigateToRelated && (
                <RelatedResourcesPopover
                  clusterContext={activeTab.resource.clusterContext || selectedClusters[0]?.context || ''}
                  resourceName={activeTab.resource.name}
                  resourceKind={activeTab.resource.kind}
                  resourceApiVersion={activeTab.resource.apiVersion}
                  resourceNamespace={activeTab.resource.namespace}
                  clusterName={activeTab.resource.clusterName}
                  onNavigate={onNavigateToRelated}
                />
              )}
              
              {onCompareMultiple && tabs.length >= 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onCompareMultiple}
                  title="Compare first two tabs"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {/* Separator */}
              <div className="w-px h-4 bg-border mx-1" />
              
              {/* Editor Controls */}
              {onToggleOutline && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleOutline}
                  title={showOutline ? "Hide outline" : "Show outline"}
                >
                  {showOutline ? (
                    <SidebarClose className="h-3.5 w-3.5" />
                  ) : (
                    <SidebarOpen className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              
              {onToggleTabManager && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleTabManager}
                  title="Toggle tab manager"
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {onToggleFullscreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Tabs>
  )
}