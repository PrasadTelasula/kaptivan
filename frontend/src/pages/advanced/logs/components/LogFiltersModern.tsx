import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
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
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2,
  Server,
  Layers,
  Package,
  Container as ContainerIcon,
  RotateCcw,
  Check
} from 'lucide-react'
import { MultiSelectDropdown } from './MultiSelectDropdown'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
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
    color: 'text-red-500', 
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    selectedBg: 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-800',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-950/30'
  },
  { 
    value: 'WARN', 
    label: 'Warning', 
    icon: AlertTriangle, 
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    selectedBg: 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800',
    hoverBg: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/30'
  },
  { 
    value: 'INFO', 
    label: 'Info', 
    icon: Info, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    selectedBg: 'bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30'
  },
  { 
    value: 'DEBUG', 
    label: 'Debug', 
    icon: Bug, 
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    selectedBg: 'bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800',
    hoverBg: 'hover:bg-gray-50 dark:hover:bg-gray-950/30'
  },
  { 
    value: 'TRACE', 
    label: 'Trace', 
    icon: Radio, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    selectedBg: 'bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-950/30'
  },
]

export const LogFiltersModern: React.FC<LogFiltersProps> = ({
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
  const [expandedSections, setExpandedSections] = useState<string[]>(['levels', 'clusters', 'namespaces', 'pods', 'containers'])
  
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Filters</span>
            <Badge variant="secondary" className="rounded-full">
              {activeFiltersCount} active
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-xs hover:bg-destructive/10 hover:text-destructive"
        >
          Clear all
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">
          {/* Log Levels Section */}
          <Collapsible
            open={expandedSections.includes('levels')}
            onOpenChange={() => toggleSection('levels')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-green-500/20 to-green-500/10">
                    <Layers className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium">Log Levels</span>
                  {filters.logLevels.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 px-2">
                      {filters.logLevels.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expandedSections.includes('levels') && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-1">
                {logLevels.map(level => {
                  const isSelected = filters.logLevels.includes(level.value)
                  return (
                    <button
                      key={level.value}
                      onClick={() => handleLogLevelToggle(level.value)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border",
                        isSelected 
                          ? level.selectedBg
                          : `border-transparent ${level.hoverBg}`
                      )}
                    >
                      <div className="flex items-center justify-center w-5 h-5">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border-2 border-muted-foreground/30" />
                        )}
                      </div>
                      <level.icon className={cn("h-4 w-4", level.color)} />
                      <span className={cn(
                        "font-medium text-sm",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {level.label}
                      </span>
                      {isSelected && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </button>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Clusters Section */}
          <Collapsible
            open={expandedSections.includes('clusters')}
            onOpenChange={() => toggleSection('clusters')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500/20 to-blue-500/10">
                    <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium">Clusters</span>
                  {filters.clusters.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 px-2">
                      {filters.clusters.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expandedSections.includes('clusters') && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
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
                        variant="secondary" 
                        className="text-xs px-2 py-1 flex items-center gap-1"
                      >
                        {cluster}
                        <X 
                          className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
                          onClick={(e) => {
                            e.stopPropagation()
                            onFiltersChange({
                              ...filters,
                              clusters: filters.clusters.filter(c => c !== cluster)
                            })
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Namespaces Section */}
          <Collapsible
            open={expandedSections.includes('namespaces')}
            onOpenChange={() => toggleSection('namespaces')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-purple-500/20 to-purple-500/10">
                    <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium">Namespaces</span>
                  {filters.namespaces.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 px-2">
                      {filters.namespaces.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expandedSections.includes('namespaces') && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
                {loadingNamespaces ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading namespaces...
                  </div>
                ) : filters.clusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Select a cluster first</p>
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
                            variant="secondary" 
                            className="text-xs px-2 py-1 flex items-center gap-1"
                          >
                            {namespace}
                            <X 
                              className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
                              onClick={(e) => {
                                e.stopPropagation()
                                onFiltersChange({
                                  ...filters,
                                  namespaces: filters.namespaces.filter(n => n !== namespace)
                                })
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Pods Section */}
          <Collapsible
            open={expandedSections.includes('pods')}
            onOpenChange={() => toggleSection('pods')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-orange-500/20 to-orange-500/10">
                    <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-medium">Pods</span>
                  {filters.pods.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 px-2">
                      {filters.pods.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expandedSections.includes('pods') && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
                {loadingPods ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading pods...
                  </div>
                ) : filters.namespaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Select namespaces first</p>
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
                            className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs"
                          >
                            <span className="truncate">{pod}</span>
                            <X 
                              className="h-3 w-3 cursor-pointer hover:text-destructive shrink-0" 
                              onClick={() => onFiltersChange({
                                ...filters,
                                pods: filters.pods.filter(p => p !== pod)
                              })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Containers Section */}
          <Collapsible
            open={expandedSections.includes('containers')}
            onOpenChange={() => toggleSection('containers')}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-br from-cyan-500/20 to-cyan-500/10">
                    <ContainerIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="font-medium">Containers</span>
                  {filters.containers.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 px-2">
                      {filters.containers.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  expandedSections.includes('containers') && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
                {loadingContainers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading containers...
                  </div>
                ) : filters.pods.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Select pods first</p>
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
                            className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs"
                          >
                            <span className="truncate">{container}</span>
                            <X 
                              className="h-3 w-3 cursor-pointer hover:text-destructive shrink-0" 
                              onClick={() => onFiltersChange({
                                ...filters,
                                containers: filters.containers.filter(c => c !== container)
                              })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}