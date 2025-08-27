import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelectDropdown } from '@/components/multi-select-dropdown'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  X,
  RefreshCw,
  FileJson,
  GitCompare,
  Download,
  Copy,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ResourceItem, ResourceGroup } from '../types'
import { RESOURCE_CATEGORIES } from '../constants'

interface ResourceTreeProps {
  resourceGroups: Map<string, ResourceGroup>
  selectedNamespace: string
  namespaces: string[]
  selectedClusters: Array<{ name: string; context: string }>
  onResourceSelect: (resource: ResourceItem) => void
  onGroupToggle: (groupName: string, group: any) => void
  onNamespaceChange: (namespace: string) => void
  onRefresh: () => void
  onBulkCompare?: (resources: ResourceItem[]) => void
  onBulkExport?: (resources: ResourceItem[]) => void
}

export function ResourceTree({
  resourceGroups,
  selectedNamespace,
  namespaces,
  selectedClusters,
  onResourceSelect,
  onGroupToggle,
  onNamespaceChange,
  onRefresh,
  onBulkCompare,
  onBulkExport,
}: ResourceTreeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInYaml, setSearchInYaml] = useState(false)
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Workloads']))
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  
  // Filter logic
  const filteredCategories = (() => {
    let filtered = RESOURCE_CATEGORIES

    if (selectedResourceTypes.length > 0) {
      filtered = filtered.map(category => ({
        ...category,
        groups: category.groups.filter(group => selectedResourceTypes.includes(group.kind))
      })).filter(category => category.groups.length > 0)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      
      filtered = filtered.map(category => ({
        ...category,
        groups: category.groups.filter(group => {
          const groupData = resourceGroups.get(group.name)
          
          if (group.name.toLowerCase().includes(query)) return true
          
          if (groupData?.items.some(item => 
            item.name.toLowerCase().includes(query) ||
            (item.namespace && item.namespace.toLowerCase().includes(query))
          )) return true
          
          return false
        })
      })).filter(category => category.groups.length > 0)
    }

    return filtered
  })()
  
  const getResourceId = (item: ResourceItem) => 
    `${item.clusterContext}-${item.namespace}-${item.name}-${item.kind}`

  const toggleResourceSelection = (item: ResourceItem) => {
    const id = getResourceId(item)
    setSelectedResources(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleResourceClick = (item: ResourceItem, e: React.MouseEvent) => {
    if (isMultiSelectMode) {
      e.preventDefault()
      toggleResourceSelection(item)
    } else {
      onResourceSelect(item)
    }
  }

  const renderResourceItem = (item: ResourceItem, category: string) => {
    const resourceId = getResourceId(item)
    const isSelected = selectedResources.has(resourceId)
    
    // Determine icon color based on category
    const getIconColor = () => {
      switch(category) {
        case 'Workloads':
          return 'text-violet-500 dark:text-violet-400'
        case 'Networking':
          return 'text-emerald-500 dark:text-emerald-400'
        case 'Configuration':
          return 'text-purple-500 dark:text-purple-400'
        case 'Storage':
          return 'text-orange-500 dark:text-orange-400'
        case 'Security':
          return 'text-red-500 dark:text-red-400'
        case 'Cluster':
          return 'text-cyan-500 dark:text-cyan-400'
        default:
          return 'text-muted-foreground'
      }
    }
    
    return (
      <div
        key={resourceId}
        className={cn(
          "flex items-center gap-2 h-6 px-2 text-xs hover:bg-accent group cursor-pointer",
          isSelected && "bg-accent"
        )}
        onClick={(e) => handleResourceClick(item, e)}
      >
        {isMultiSelectMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleResourceSelection(item)}
            onClick={(e) => e.stopPropagation()}
            className="h-3 w-3"
          />
        )}
        <FileText className={cn("h-3 w-3 flex-shrink-0", getIconColor())} />
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
      </div>
    )
  }
  
  const renderResourceGroup = (group: any, category: string) => {
    const groupData = resourceGroups.get(group.name)
    const Icon = group.icon
    
    // Determine icon color based on category
    const getIconColor = () => {
      switch(category) {
        case 'Workloads':
          return 'text-violet-500 dark:text-violet-400'
        case 'Networking':
          return 'text-emerald-500 dark:text-emerald-400'
        case 'Configuration':
          return 'text-purple-500 dark:text-purple-400'
        case 'Storage':
          return 'text-orange-500 dark:text-orange-400'
        case 'Security':
          return 'text-red-500 dark:text-red-400'
        case 'Cluster':
          return 'text-cyan-500 dark:text-cyan-400'
        default:
          return ''
      }
    }
    
    return (
      <div key={group.name}>
        <Button
          variant="ghost"
          className="w-full justify-start h-7 px-2 text-sm hover:bg-accent"
          onClick={() => onGroupToggle(group.name, group)}
        >
          {groupData?.expanded ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          <Icon className={cn("h-3 w-3 mr-2", getIconColor())} />
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
            {groupData.items.map((item) => renderResourceItem(item, category))}
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Multi-select action bar */}
      {selectedResources.size > 0 && (
        <div className="px-3 py-2 border-b bg-accent/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {selectedResources.size} resource{selectedResources.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-1">
              {onBulkCompare && selectedResources.size >= 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const resources = Array.from(selectedResources).map(id => {
                      // Find the resource from all groups
                      for (const [, group] of resourceGroups) {
                        const resource = group.items.find(item => getResourceId(item) === id)
                        if (resource) return resource
                      }
                      return null
                    }).filter(Boolean) as ResourceItem[]
                    onBulkCompare(resources)
                    setSelectedResources(new Set())
                    setIsMultiSelectMode(false)
                  }}
                  title="Compare selected resources"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </Button>
              )}
              {onBulkExport && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const resources = Array.from(selectedResources).map(id => {
                      for (const [, group] of resourceGroups) {
                        const resource = group.items.find(item => getResourceId(item) === id)
                        if (resource) return resource
                      }
                      return null
                    }).filter(Boolean) as ResourceItem[]
                    onBulkExport(resources)
                    setSelectedResources(new Set())
                    setIsMultiSelectMode(false)
                  }}
                  title="Export selected resources"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setSelectedResources(new Set())
                  setIsMultiSelectMode(false)
                }}
                title="Cancel selection"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
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
            <Button
              variant={isMultiSelectMode ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode)
                setSelectedResources(new Set())
              }}
              title={isMultiSelectMode ? "Exit multi-select" : "Multi-select mode"}
            >
              <Checkbox className="h-3.5 w-3.5" />
            </Button>
            {(selectedNamespace !== 'all' || selectedResourceTypes.length > 0 || searchQuery || searchInYaml) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  onNamespaceChange('all')
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
              onClick={onRefresh}
              className="h-8 w-8"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-2">
          <Select value={selectedNamespace} onValueChange={onNamespaceChange}>
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
            options={RESOURCE_CATEGORIES.flatMap(cat => 
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

        {/* Search */}
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
                  onNamespaceChange('all')
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
                    {category.groups.map(group => renderResourceGroup(group, category.category))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}