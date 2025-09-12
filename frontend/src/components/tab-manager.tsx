import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'
import { useTabsStore } from '@/stores/tabs.store'
import type { Tab, TabGroup } from '@/stores/tabs.store'
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Save,
  FolderOpen,
  MoreVertical,
  Layers,
  BookOpen,
  Download,
  Upload,
  XCircle,
  Grid3x3,
} from 'lucide-react'

interface TabManagerProps {
  currentTabs: Tab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabsReorder?: (tabs: Tab[]) => void
}

export function TabManager({
  currentTabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabsReorder,
}: TabManagerProps) {
  const {
    groups,
    sessions,
    createGroup,
    toggleGroupCollapse,
    deleteGroup,
    renameGroup,
    saveSession,
    loadSession,
    deleteSession,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    searchTabs,
    getRelatedTabs,
  } = useTabsStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [selectedTabsForGroup, setSelectedTabsForGroup] = useState<string[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  
  const filteredTabs = searchQuery ? searchTabs(searchQuery) : (currentTabs || [])
  
  // Group tabs by their groups
  const groupedTabs = new Map<string | undefined, Tab[]>()
  filteredTabs.forEach(tab => {
    const groupId = tab.groupId
    if (!groupedTabs.has(groupId)) {
      groupedTabs.set(groupId, [])
    }
    groupedTabs.get(groupId)!.push(tab)
  })
  
  const handleSaveSession = () => {
    if (sessionName) {
      saveSession(sessionName, sessionDescription)
      setSessionName('')
      setSessionDescription('')
      setShowSessionDialog(false)
    }
  }
  
  const handleCreateGroup = () => {
    if (newGroupName && selectedTabsForGroup.length > 0) {
      createGroup(newGroupName, selectedTabsForGroup)
      setNewGroupName('')
      setSelectedTabsForGroup([])
    }
  }
  
  const renderTab = (tab: Tab, showGroupIndicator = false) => {
    const isActive = tab.id === activeTabId
    const group = groups.find(g => g.id === tab.groupId)
    
    return (
      <div
        key={tab.id}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer border-b",
          isActive && "bg-accent border-l-2 border-l-primary"
        )}
        onClick={() => onTabSelect(tab.id)}
      >
        {showGroupIndicator && group && (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: group.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {tab.resource.kind}
            </Badge>
            <span className="text-sm truncate">
              {tab.resource.namespace && (
                <span className="text-muted-foreground">
                  {tab.resource.namespace}/
                </span>
              )}
              {tab.resource.name}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onTabClose(tab.id)
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }
  
  const renderGroup = (group: TabGroup, tabs: Tab[]) => {
    return (
      <div key={group.id} className="border-b">
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer"
          onClick={() => toggleGroupCollapse(group.id)}
        >
          {group.collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: group.color }}
          />
          <span className="text-sm font-medium flex-1">{group.name}</span>
          <Badge variant="secondary" className="text-xs">
            {tabs.length}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const name = prompt('Rename group:', group.name)
                  if (name) renameGroup(group.id, name)
                }}
              >
                Rename Group
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteGroup(group.id)}
                className="text-destructive"
              >
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!group.collapsed && (
          <div className="ml-4">
            {tabs.map(tab => renderTab(tab, false))}
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-7 text-xs"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-7 w-7">
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowSearchDialog(true)}>
              <Search className="h-3 w-3 mr-2" />
              Advanced Search
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Layers className="h-3 w-3 mr-2" />
                Groups
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedTabsForGroup((currentTabs || []).map(t => t.id))
                    setNewGroupName('New Group')
                    // In real implementation, show a dialog
                    handleCreateGroup()
                  }}
                >
                  Group All Tabs
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const tab = (currentTabs || []).find(t => t.id === activeTabId)
                    if (tab) {
                      const related = getRelatedTabs(tab)
                      if (related.length > 0) {
                        createGroup(
                          `${tab.resource.kind} Group`,
                          [tab.id, ...related.map(t => t.id)]
                        )
                      }
                    }
                  }}
                >
                  Group Related
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <BookOpen className="h-3 w-3 mr-2" />
                Sessions
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setShowSessionDialog(true)}>
                  <Save className="h-3 w-3 mr-2" />
                  Save Session
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {sessions.map(session => (
                  <DropdownMenuItem
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                  >
                    <FolderOpen className="h-3 w-3 mr-2" />
                    {session.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (activeTabId) closeOtherTabs(activeTabId)
              }}
              disabled={(currentTabs || []).length <= 1}
            >
              Close Other Tabs
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (activeTabId) closeTabsToRight(activeTabId)
              }}
              disabled={!activeTabId}
            >
              Close Tabs to Right
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={closeAllTabs}
              className="text-destructive"
              disabled={(currentTabs || []).length === 0}
            >
              <XCircle className="h-3 w-3 mr-2" />
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Tab List */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Ungrouped tabs */}
          {groupedTabs.get(undefined)?.map(tab => renderTab(tab, true))}
          
          {/* Grouped tabs */}
          {groups.map(group => {
            const tabs = groupedTabs.get(group.id) || []
            if (tabs.length === 0) return null
            return renderGroup(group, tabs)
          })}
        </div>
      </ScrollArea>
      
      {/* Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Tab Session</DialogTitle>
            <DialogDescription>
              Save the current tab configuration for later use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Debugging Session"
              />
            </div>
            <div>
              <Label htmlFor="session-description">Description (Optional)</Label>
              <Input
                id="session-description"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder="Brief description of this session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSession} disabled={!sessionName}>
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}