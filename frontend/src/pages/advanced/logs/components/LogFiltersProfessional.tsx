import React, { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LogFilters as LogFiltersType } from '../types/logs'
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug, 
  Radio,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { MultiSelectDropdown } from './MultiSelectDropdown'
import { cn } from '@/utils/cn'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface LogFiltersProps {
  filters: LogFiltersType
  onFiltersChange: (filters: LogFiltersType) => void
  availableClusters: string[]
  availableNamespaces: string[]
  availablePods: string[]
  availableContainers: string[]
  loadingNamespaces?: boolean
  loadingPods?: boolean
  loadingContainers?: boolean
}

const logLevels = [
  { 
    value: 'ERROR', 
    label: 'Error', 
    icon: AlertCircle, 
    color: 'text-red-500 dark:text-red-400',
  },
  { 
    value: 'WARN', 
    label: 'Warning', 
    icon: AlertTriangle, 
    color: 'text-amber-500 dark:text-amber-400',
  },
  { 
    value: 'INFO', 
    label: 'Info', 
    icon: Info, 
    color: 'text-blue-500 dark:text-blue-400',
  },
  { 
    value: 'DEBUG', 
    label: 'Debug', 
    icon: Bug, 
    color: 'text-slate-500 dark:text-slate-400',
  },
  { 
    value: 'TRACE', 
    label: 'Trace', 
    icon: Radio, 
    color: 'text-violet-500 dark:text-violet-400',
  },
]

export const LogFiltersProfessional: React.FC<LogFiltersProps> = ({
  filters,
  onFiltersChange,
  availableClusters,
  availableNamespaces,
  availablePods,
  availableContainers,
  loadingNamespaces = false,
  loadingPods = false,
  loadingContainers = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(['levels', 'clusters'])
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const handleLogLevelToggle = (level: string) => {
    const newLevels = filters.logLevels.includes(level)
      ? filters.logLevels.filter(l => l !== level)
      : [...filters.logLevels, level]
    onFiltersChange({ ...filters, logLevels: newLevels })
  }

  const handleClearAll = () => {
    onFiltersChange({
      ...filters,
      clusters: [],
      namespaces: [],
      pods: [],
      containers: [],
      logLevels: ['ERROR', 'WARN', 'INFO'],
    })
  }

  const activeFiltersCount = 
    filters.logLevels.length + 
    filters.clusters.length + 
    filters.namespaces.length + 
    filters.pods.length + 
    filters.containers.length

  return (
    <div className="h-full flex flex-col bg-background border-r">
      {/* Header - Clean and minimal */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Filters</h3>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <>
                <Badge variant="secondary" className="h-5 text-xs px-2">
                  {activeFiltersCount} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs px-2"
                >
                  Clear all
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Log Levels Section - Clean checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Log Levels
              </h4>
              {filters.logLevels.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {filters.logLevels.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {logLevels.map(level => {
                const isSelected = filters.logLevels.includes(level.value)
                return (
                  <label
                    key={level.value}
                    className={cn(
                      "flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition-colors",
                      "hover:bg-muted/50",
                      isSelected && "bg-muted/30"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleLogLevelToggle(level.value)}
                      className="h-4 w-4"
                    />
                    <level.icon className={cn("h-3.5 w-3.5", level.color)} />
                    <span className="text-sm">{level.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Clusters Section */}
          <Collapsible
            open={expandedSections.includes('clusters')}
            onOpenChange={() => toggleSection('clusters')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-1 group">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Clusters
                </h4>
                <div className="flex items-center gap-2">
                  {filters.clusters.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {filters.clusters.length}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    expandedSections.includes('clusters') && "rotate-90"
                  )} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <MultiSelectDropdown
                options={availableClusters}
                selectedValues={filters.clusters}
                onSelectionChange={(clusters) => onFiltersChange({ ...filters, clusters })}
                placeholder="Select clusters..."
                emptyMessage="No clusters available"
              />
              {filters.clusters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.clusters.map(cluster => (
                    <Badge 
                      key={cluster} 
                      variant="outline" 
                      className="text-xs h-6 pl-2 pr-1"
                    >
                      {cluster}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => onFiltersChange({
                          ...filters,
                          clusters: filters.clusters.filter(c => c !== cluster)
                        })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Namespaces Section */}
          <Collapsible
            open={expandedSections.includes('namespaces')}
            onOpenChange={() => toggleSection('namespaces')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-1 group">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Namespaces
                </h4>
                <div className="flex items-center gap-2">
                  {filters.namespaces.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {filters.namespaces.length}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    expandedSections.includes('namespaces') && "rotate-90"
                  )} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {loadingNamespaces ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : filters.clusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select a cluster first</p>
              ) : (
                <>
                  <MultiSelectDropdown
                    options={availableNamespaces}
                    selectedValues={filters.namespaces}
                    onSelectionChange={(namespaces) => onFiltersChange({ ...filters, namespaces })}
                    placeholder="Select namespaces..."
                    emptyMessage="No namespaces available"
                  />
                  {filters.namespaces.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {filters.namespaces.map(namespace => (
                        <Badge 
                          key={namespace} 
                          variant="outline" 
                          className="text-xs h-6 pl-2 pr-1"
                        >
                          {namespace}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                            onClick={() => onFiltersChange({
                              ...filters,
                              namespaces: filters.namespaces.filter(n => n !== namespace)
                            })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Pods Section */}
          <Collapsible
            open={expandedSections.includes('pods')}
            onOpenChange={() => toggleSection('pods')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-1 group">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pods
                </h4>
                <div className="flex items-center gap-2">
                  {filters.pods.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {filters.pods.length}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    expandedSections.includes('pods') && "rotate-90"
                  )} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {loadingPods ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : filters.namespaces.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select namespaces first</p>
              ) : (
                <>
                  <MultiSelectDropdown
                    options={availablePods}
                    selectedValues={filters.pods}
                    onSelectionChange={(pods) => onFiltersChange({ ...filters, pods })}
                    placeholder="Select pods..."
                    emptyMessage="No pods available"
                  />
                  {filters.pods.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {filters.pods.map(pod => (
                        <div
                          key={pod}
                          className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-xs"
                        >
                          <span className="truncate">{pod}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => onFiltersChange({
                              ...filters,
                              pods: filters.pods.filter(p => p !== pod)
                            })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Containers Section */}
          <Collapsible
            open={expandedSections.includes('containers')}
            onOpenChange={() => toggleSection('containers')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-1 group">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Containers
                </h4>
                <div className="flex items-center gap-2">
                  {filters.containers.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {filters.containers.length}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    expandedSections.includes('containers') && "rotate-90"
                  )} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {loadingContainers ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : filters.pods.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select pods first</p>
              ) : (
                <>
                  <MultiSelectDropdown
                    options={availableContainers}
                    selectedValues={filters.containers}
                    onSelectionChange={(containers) => onFiltersChange({ ...filters, containers })}
                    placeholder="Select containers..."
                    emptyMessage="No containers available"
                  />
                  {filters.containers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {filters.containers.map(container => (
                        <div
                          key={container}
                          className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-xs"
                        >
                          <span className="truncate">{container}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => onFiltersChange({
                              ...filters,
                              containers: filters.containers.filter(c => c !== container)
                            })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}