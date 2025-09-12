import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelectDropdown } from '@/components/multi-select-dropdown'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  Clock,
  Users,
  Package,
  Info,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ResourceItem, ResourceGroup } from '../types'
import { RESOURCE_CATEGORIES } from '../constants'

// Helper function to extract cluster name from ARN
const extractClusterName = (clusterContext: string): string => {
  // Check if it's an EKS ARN format
  if (clusterContext.startsWith('arn:aws:eks:')) {
    const parts = clusterContext.split('/')
    return parts[parts.length - 1] // Last part after the last '/'
  }
  // Return original if not ARN format
  return clusterContext
}

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
  enhanceMode: boolean
  onEnhanceModeToggle: () => void
  onGroupSmartFetch: (groupName: string, groupKind: string, groupApiVersion: string) => void
  isFetchingGroup: Map<string, boolean>
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
  enhanceMode,
  onEnhanceModeToggle,
  onGroupSmartFetch,
  isFetchingGroup,
}: ResourceTreeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInYaml, setSearchInYaml] = useState(false)
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Workloads']))
  const [showOldReplicaSets, setShowOldReplicaSets] = useState(false)
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
        groups: category.groups.map(group => {
          const groupData = resourceGroups.get(group.name)
          
          // Check if group name matches
          const groupMatches = group.name.toLowerCase().includes(query)
          
          // Filter items within the group
          const filteredItems = groupData?.items.filter(item => {
            // Search in basic fields
            if (item.name.toLowerCase().includes(query)) return true
            if (item.namespace && item.namespace.toLowerCase().includes(query)) return true
            if (item.kind && item.kind.toLowerCase().includes(query)) return true
            if ((item as any).status && (item as any).status.toLowerCase().includes(query)) return true
            
            // Search in YAML content if enabled
            if (searchInYaml && (item as any).yaml) {
              try {
                const yamlContent = typeof (item as any).yaml === 'string' ? (item as any).yaml : JSON.stringify((item as any).yaml)
                if (yamlContent.toLowerCase().includes(query)) return true
              } catch (e) {
                // If YAML parsing fails, search in string representation
                if (String((item as any).yaml).toLowerCase().includes(query)) return true
              }
            }
            
            // Search in additional metadata fields
            if (item.clusterContext && item.clusterContext.toLowerCase().includes(query)) return true
            if (item.creationTimestamp && item.creationTimestamp.toLowerCase().includes(query)) return true
          
          return false
          }) || []
          
          // Return group if group name matches OR if it has matching items
          if (groupMatches || filteredItems.length > 0) {
            return {
              ...group,
              filteredItems: filteredItems
            } as any
          }
          
          return null
        }).filter(Boolean)
      })).filter(category => category.groups.length > 0)
    }

    return filtered
  })()
  
  const getResourceId = (item: ResourceItem) => 
    `${item.clusterContext}-${item.namespace}-${item.name}-${item.kind}`

  // Helper function to highlight search terms
  const highlightSearchTerm = (text: string, query: string) => {
    if (!query || !text.toLowerCase().includes(query.toLowerCase())) {
      return text
    }
    
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    return (
      <>
        {text.substring(0, index)}
        <span className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {text.substring(index, index + query.length)}
        </span>
        {text.substring(index + query.length)}
      </>
    )
  }

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

    // Special rendering for Pods - inline format
    if (item.kind === 'Pod') {
      // Get pod status color
      const getPodStatusColor = (status: string) => {
        switch (status) {
          case 'Running':
            return 'bg-green-500 text-white'
          case 'Pending':
            return 'bg-yellow-500 text-white'
          case 'Failed':
            return 'bg-red-500 text-white'
          case 'Succeeded':
            return 'bg-blue-500 text-white'
          case 'Unknown':
            return 'bg-gray-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Pod status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.podStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getPodStatusColor(item.podStatus))}
            >
              {item.podStatus}
            </Badge>
          )}
          
          {(item.containerReady !== undefined && item.containerTotal !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.containerReady}/{item.containerTotal}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready/Total Containers</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for DaemonSets - inline format
    if (item.kind === 'DaemonSet') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* DaemonSet status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {(item.daemonSetReadyReplicas !== undefined || item.daemonSetDesiredReplicas !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.daemonSetReadyReplicas || 0}/{item.daemonSetDesiredReplicas || 0}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready/Desired Replicas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for StatefulSets - inline format
    if (item.kind === 'StatefulSet') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* StatefulSet status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {(item.statefulSetReadyReplicas !== undefined || item.statefulSetDesiredReplicas !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.statefulSetReadyReplicas || 0}/{item.statefulSetDesiredReplicas || 0}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready/Desired Replicas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Jobs - inline format
    if (item.kind === 'Job') {
      // Get job status color
      const getJobStatusColor = (status: string) => {
        switch (status) {
          case 'Complete':
            return 'bg-green-500 text-white'
          case 'Failed':
            return 'bg-red-500 text-white'
          case 'Running':
            return 'bg-blue-500 text-white'
          case 'Pending':
            return 'bg-yellow-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Job status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.jobStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getJobStatusColor(item.jobStatus))}
            >
              {item.jobStatus}
            </Badge>
          )}
          
          {(item.jobSucceededCount !== undefined || item.jobFailedCount !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.jobSucceededCount || 0}/{item.jobFailedCount || 0}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Succeeded/Failed Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for CronJobs - inline format
    if (item.kind === 'CronJob') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* CronJob status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.cronJobActiveJobs !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.cronJobActiveJobs}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Active Jobs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Services - inline format
    if (item.kind === 'Service') {
      // Get service type color
      const getServiceTypeColor = (type: string) => {
        switch (type) {
          case 'ClusterIP':
            return 'bg-blue-500 text-white'
          case 'NodePort':
            return 'bg-green-500 text-white'
          case 'LoadBalancer':
            return 'bg-purple-500 text-white'
          case 'ExternalName':
            return 'bg-orange-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Service status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.serviceType && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getServiceTypeColor(item.serviceType))}
            >
              {item.serviceType}
            </Badge>
          )}
          
          {item.servicePorts !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.servicePorts}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of Ports</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for ConfigMaps - inline format
    if (item.kind === 'ConfigMap') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ConfigMap status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.configMapDataCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.configMapDataCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Data Keys</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Secrets - inline format
    if (item.kind === 'Secret') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Secret status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.secretType && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.secretType}
            </Badge>
          )}
          
          {item.secretDataCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.secretDataCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Data Keys</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for PersistentVolumes - inline format
    if (item.kind === 'PersistentVolume') {
      // Get PV status color
      const getPVStatusColor = (status: string) => {
        switch (status) {
          case 'Available':
            return 'bg-green-500 text-white'
          case 'Bound':
            return 'bg-blue-500 text-white'
          case 'Released':
            return 'bg-yellow-500 text-white'
          case 'Failed':
            return 'bg-red-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* PV status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.pvStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getPVStatusColor(item.pvStatus))}
            >
              {item.pvStatus}
            </Badge>
          )}
          
          {item.pvCapacity && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.pvCapacity}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Capacity</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for PersistentVolumeClaims - inline format
    if (item.kind === 'PersistentVolumeClaim') {
      // Get PVC status color
      const getPVCStatusColor = (status: string) => {
        switch (status) {
          case 'Bound':
            return 'bg-green-500 text-white'
          case 'Pending':
            return 'bg-yellow-500 text-white'
          case 'Lost':
            return 'bg-red-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* PVC status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.pvcStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getPVCStatusColor(item.pvcStatus))}
            >
              {item.pvcStatus}
            </Badge>
          )}
          
          {item.pvcCapacity && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.pvcCapacity}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Capacity</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Ingress - inline format
    if (item.kind === 'Ingress') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Ingress status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.ingressStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", 
                item.ingressStatus === 'Valid' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              )}
            >
              {item.ingressStatus}
            </Badge>
          )}
          
          {item.ingressRulesCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.ingressRulesCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rules Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Namespaces - inline format
    if (item.kind === 'Namespace') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Namespace status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.namespaceStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", 
                item.namespaceStatus === 'Active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              )}
            >
              {item.namespaceStatus}
            </Badge>
          )}
        </div>
      )
    }

    // Special rendering for ServiceAccounts - inline format
    if (item.kind === 'ServiceAccount') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ServiceAccount status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {(item.serviceAccountSecretsCount !== undefined || item.serviceAccountImagePullSecretsCount !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {(item.serviceAccountSecretsCount || 0) + (item.serviceAccountImagePullSecretsCount || 0)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Secrets: {item.serviceAccountSecretsCount || 0}, ImagePullSecrets: {item.serviceAccountImagePullSecretsCount || 0}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Roles - inline format
    if (item.kind === 'Role') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Role status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.roleRulesCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.roleRulesCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rules Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for RoleBindings - inline format
    if (item.kind === 'RoleBinding') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* RoleBinding status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.roleBindingSubjectsCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.roleBindingSubjectsCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Subjects Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for ClusterRoles - inline format
    if (item.kind === 'ClusterRole') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ClusterRole status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.clusterRoleRulesCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.clusterRoleRulesCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rules Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for ClusterRoleBindings - inline format
    if (item.kind === 'ClusterRoleBinding') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ClusterRoleBinding status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.clusterRoleBindingSubjectsCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.clusterRoleBindingSubjectsCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Subjects Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for NetworkPolicies - inline format
    if (item.kind === 'NetworkPolicy') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* NetworkPolicy status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.networkPolicyRulesCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.networkPolicyRulesCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rules Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for StorageClasses - inline format
    if (item.kind === 'StorageClass') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* StorageClass status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.storageClassProvisioner && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.storageClassProvisioner}
            </Badge>
          )}
        </div>
      )
    }

    // Special rendering for Events - inline format
    if (item.kind === 'Event') {
      // Get event type color
      const getEventTypeColor = (type: string) => {
        switch (type) {
          case 'Normal':
            return 'bg-green-500 text-white'
          case 'Warning':
            return 'bg-yellow-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Event status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.eventType && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getEventTypeColor(item.eventType))}
            >
              {item.eventType}
            </Badge>
          )}
          
          {item.eventCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.eventCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for CustomResourceDefinitions - inline format
    if (item.kind === 'CustomResourceDefinition') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* CRD status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.crdScope && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.crdScope}
            </Badge>
          )}
          
          {item.crdVersionCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.crdVersionCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Versions</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Nodes - inline format
    if (item.kind === 'Node') {
      // Get node status color
      const getNodeStatusColor = (status: string) => {
        switch (status) {
          case 'Ready':
            return 'bg-green-500 text-white'
          case 'NotReady':
            return 'bg-red-500 text-white'
          default:
            return 'bg-gray-500 text-white'
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Node status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.nodeStatus && (
            <Badge 
              className={cn("h-4 px-1 text-[10px]", getNodeStatusColor(item.nodeStatus))}
            >
              {item.nodeStatus}
            </Badge>
          )}
          
          {item.nodeRole && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.nodeRole}
            </Badge>
          )}
          
          {item.nodePodCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.nodePodCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pods on this node</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for ResourceQuotas - inline format
    if (item.kind === 'ResourceQuota') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ResourceQuota status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.resourceQuotaStatus && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.resourceQuotaStatus}
            </Badge>
          )}
          
          {item.resourceQuotaUsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    Used
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{item.resourceQuotaUsed}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for LimitRanges - inline format
    if (item.kind === 'LimitRange') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* LimitRange status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {item.limitRangeStatus && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {item.limitRangeStatus}
            </Badge>
          )}
          
          {item.limitRangeLimitsCount !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.limitRangeLimitsCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limits Count</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for Deployments - inline format
    if (item.kind === 'Deployment') {
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
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* Deployment status badges - at the end */}
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {(item.desiredReplicas !== undefined || item.readyReplicas !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.readyReplicas || 0}/{item.desiredReplicas || 0}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready/Desired Replicas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }

    // Special rendering for ReplicaSets - inline format
    if (item.kind === 'ReplicaSet') {
      return (
        <div
          key={resourceId}
          className={cn(
            "flex items-center gap-2 h-6 px-2 text-xs hover:bg-accent group cursor-pointer",
            isSelected && "bg-accent",
            item.isCurrent === false && "opacity-60"
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
          <Package className={cn("h-3 w-3 flex-shrink-0", getIconColor())} />
          
          <span className="truncate flex-1 text-left">
            {(selectedClusters.length > 1 && item.clusterName) || item.clusterContext ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-3.5 px-1 text-[10px] mr-1">
                      {selectedClusters.length > 1 ? extractClusterName(item.clusterName || '') : extractClusterName(item.clusterContext || '')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.clusterContext}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {item.namespace && (
              <span className="text-muted-foreground">
                {searchQuery ? highlightSearchTerm(item.namespace, searchQuery) : item.namespace}/
              </span>
            )}
            {searchQuery ? highlightSearchTerm(extractClusterName(item.name), searchQuery) : extractClusterName(item.name)}
          </span>
          
          {/* ReplicaSet status badges - moved to the end */}
          {item.isCurrent !== undefined && (
            <Badge 
              variant={item.isCurrent ? "default" : "secondary"}
              className="h-4 px-1 text-[10px]"
            >
              {item.isCurrent ? "Current" : "Old"}
            </Badge>
          )}
          
          {item.age && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Clock className="h-2 w-2 mr-0.5" />
                    {item.age}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {item.creationTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {(item.desiredReplicas !== undefined || item.readyReplicas !== undefined) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    <Users className="h-2 w-2 mr-0.5" />
                    {item.readyReplicas || 0}/{item.desiredReplicas || 0}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready/Desired Replicas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }
    
    // Default rendering for other resources
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
        <div className="flex items-center w-full h-7 px-2 text-sm">
        <Button
          variant="ghost"
            className="flex-1 justify-start h-7 px-0 text-sm hover:bg-accent"
          onClick={() => onGroupToggle(group.name, group)}
        >
          {groupData?.expanded ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          <Icon className={cn("h-3 w-3 mr-2", getIconColor())} />
            <span className="flex-1 text-left">
            {searchQuery && group.name.toLowerCase().includes(searchQuery.toLowerCase()) ? (
              (() => {
                const query = searchQuery.toLowerCase()
                const name = group.name
                const index = name.toLowerCase().indexOf(query)
                return (
                  <>
                    {name.substring(0, index)}
                    <span className="bg-yellow-200 text-yellow-900 px-1 rounded">
                      {name.substring(index, index + searchQuery.length)}
                    </span>
                    {name.substring(index + searchQuery.length)}
                  </>
                )
              })()
            ) : (
              group.name
            )}
          </span>
          {groupData?.loading && (
            <RefreshCw className="h-3 w-3 animate-spin ml-2" />
          )}
            {groupData?.items && groupData.items.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1 text-xs">
              {(() => {
                if (group.name === 'ReplicaSets' && !showOldReplicaSets) {
                  const hasDetailedInfo = groupData.items.some((item: ResourceItem) => (item as any).isCurrent !== undefined)
                  if (hasDetailedInfo) {
                    const currentCount = groupData.items.filter((item: ResourceItem) => (item as any).isCurrent === true).length
                    const oldCount = groupData.items.length - currentCount
                    return oldCount > 0 ? `${currentCount} (+${oldCount} old)` : currentCount
                  } else {
                    // No detailed info available, show total count
                    return `${groupData.items.length} (fetch details to filter)`
                  }
                }
                return groupData.items.length
              })()}
            </Badge>
          )}
        </Button>
          <div className="ml-2 flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation()
                onGroupSmartFetch(group.name, group.kind, group.apiVersion)
              }}
              disabled={isFetchingGroup.get(group.name)}
              title={
                isFetchingGroup.get(group.name)
                  ? `Fetching details for ${group.name}...`
                  : `Fetch detailed info for ${group.name}`
              }
            >
              {isFetchingGroup.get(group.name) ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
          )}
        </Button>
            
            {/* ReplicaSets Old/Current Toggle */}
            {group.name === 'ReplicaSets' && (() => {
              const hasDetailedInfo = groupData?.items.some((item: ResourceItem) => (item as any).isCurrent !== undefined)
              const isFetchingDetails = isFetchingGroup.get('ReplicaSets')
              
              const handleToggle = () => {
                if (!hasDetailedInfo) {
                  // Auto-fetch detailed info for ReplicaSets
                  onGroupSmartFetch('ReplicaSets', 'ReplicaSet', 'apps/v1')
                } else {
                  setShowOldReplicaSets(!showOldReplicaSets)
                }
              }
              
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Switch
                          id="show-old-replicasets"
                          checked={showOldReplicaSets}
                          onCheckedChange={handleToggle}
                          disabled={isFetchingDetails}
                          className="h-4 w-7"
                        />
                        <Label 
                          htmlFor="show-old-replicasets" 
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          {isFetchingDetails ? 'Fetching...' : 
                           !hasDetailedInfo ? 'Fetch Details' :
                           showOldReplicaSets ? 'Hide Old' : 'Show Old'}
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isFetchingDetails ? 'Fetching detailed information...' :
                         !hasDetailedInfo ? 'Click to fetch detailed info and enable old/current filtering' :
                         showOldReplicaSets ? 'Hide old ReplicaSets' : 'Show old ReplicaSets'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })()}
          </div>
        </div>
        
        {groupData?.expanded && (
          <div className="ml-6">
            {(() => {
              let itemsToRender = searchQuery && (group as any).filteredItems ? (group as any).filteredItems : groupData.items
              
              // Filter old ReplicaSets if toggle is off and detailed info is available
              if (group.name === 'ReplicaSets' && !showOldReplicaSets) {
                const hasDetailedInfo = itemsToRender.some((item: ResourceItem) => (item as any).isCurrent !== undefined)
                if (hasDetailedInfo) {
                  itemsToRender = itemsToRender.filter((item: ResourceItem) => (item as any).isCurrent === true)
                }
                // If no detailed info, show all items (can't filter without isCurrent field)
              }
              
              return itemsToRender.map((item: ResourceItem) => renderResourceItem(item, category))
            })()}
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
                  searchQuery ? 1 : 0
                ].filter(Boolean).reduce((a: any, b: any) => Number(a) + Number(b), 0)} active
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
              <div className="h-3.5 w-3.5 border border-primary rounded-sm flex items-center justify-center">
                {isMultiSelectMode && (
                  <div className="h-2 w-2 bg-primary rounded-sm" />
                )}
              </div>
            </Button>
             <Button
               variant={enhanceMode ? "default" : "ghost"}
               size="icon"
               className="h-7 w-7"
               onClick={onEnhanceModeToggle}
               title={enhanceMode ? "Disable detailed info mode" : "Enable detailed info mode"}
             >
               <Info className="h-3.5 w-3.5" />
            </Button>
            {(selectedNamespace !== 'all' || selectedResourceTypes.length > 0 || searchQuery || searchInYaml) && (
              <div className="flex items-center gap-2">
                {searchQuery && (
                  <span className="text-xs text-muted-foreground">
                    {filteredCategories.reduce((total, cat) => 
                      total + cat.groups.reduce((groupTotal, group) => {
                        if (searchQuery && (group as any).filteredItems) {
                          return groupTotal + (group as any).filteredItems.length
                        }
                        const groupData = resourceGroups.get(group.name)
                        return groupTotal + (groupData?.items.length || 0)
                      }, 0), 0
                    )} results
                  </span>
                )}
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
              </div>
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