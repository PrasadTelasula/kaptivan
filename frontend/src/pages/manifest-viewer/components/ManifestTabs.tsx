import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  
  const activeTab = tabs.find(tab => tab.id === activeTabId)

  return (
    <Tabs value={activeTabId} onValueChange={onTabSelect} className="w-full">
      <div className="flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center">
          <TabsList className="h-auto p-0 bg-transparent">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "relative h-10 px-4 py-2 text-sm font-medium transition-all",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "flex items-center gap-2 group"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate max-w-[200px]">
                    {tab.resource.kind} {tab.resource.namespace ? `${tab.resource.namespace}/` : ''}{tab.resource.name}
                  </span>
                  {tab.loading && (
                    <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
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