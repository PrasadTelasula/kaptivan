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
  ChevronDown,
  Loader2,
  Filter,
} from 'lucide-react'
import { MultiSelectDropdown } from './MultiSelectDropdown'
import { cn } from '@/utils/cn'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
    className: 'text-destructive',
  },
  { 
    value: 'WARN', 
    label: 'Warning', 
    icon: AlertTriangle, 
    className: 'text-warning',
  },
  { 
    value: 'INFO', 
    label: 'Info', 
    icon: Info, 
    className: 'text-info',
  },
  { 
    value: 'DEBUG', 
    label: 'Debug', 
    icon: Bug, 
    className: 'text-muted-foreground',
  },
  { 
    value: 'TRACE', 
    label: 'Trace', 
    icon: Radio, 
    className: 'text-muted-foreground',
  },
]

export const LogFiltersClean: React.FC<LogFiltersProps> = ({
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
  const handleLogLevelToggle = (level: string, checked: boolean) => {
    const newLevels = checked
      ? [...filters.logLevels, level]
      : filters.logLevels.filter(l => l !== level)
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount} active
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
          >
            Clear all
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          defaultValue={["log-levels", "clusters", "namespaces", "pods", "containers"]}
          className="w-full"
        >
          {/* Log Levels */}
          <AccordionItem value="log-levels" className="border-b">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">Log Levels</span>
                {filters.logLevels.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filters.logLevels.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {logLevels.map(level => (
                  <div key={level.value} className="flex items-center space-x-3">
                    <Checkbox
                      id={level.value}
                      checked={filters.logLevels.includes(level.value)}
                      onCheckedChange={(checked) => 
                        handleLogLevelToggle(level.value, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={level.value}
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer flex-1"
                    >
                      <level.icon className={cn("h-4 w-4", level.className)} />
                      {level.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Clusters */}
          <AccordionItem value="clusters" className="border-b">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">Clusters</span>
                {filters.clusters.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filters.clusters.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                <MultiSelectDropdown
                  options={availableClusters}
                  selectedValues={filters.clusters}
                  onSelectionChange={(clusters) => onFiltersChange({ ...filters, clusters })}
                  placeholder="Select clusters..."
                  emptyMessage="No clusters available"
                />
                {filters.clusters.map(cluster => (
                  <div key={cluster} className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">{cluster}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1"
                      onClick={() => onFiltersChange({
                        ...filters,
                        clusters: filters.clusters.filter(c => c !== cluster)
                      })}
                    >
                      <span className="text-xs">Remove</span>
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Namespaces */}
          <AccordionItem value="namespaces" className="border-b">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">Namespaces</span>
                {filters.namespaces.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filters.namespaces.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {loadingNamespaces ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : filters.clusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select a cluster first</p>
                ) : (
                  <>
                    <MultiSelectDropdown
                      options={availableNamespaces}
                      selectedValues={filters.namespaces}
                      onSelectionChange={(namespaces) => onFiltersChange({ ...filters, namespaces })}
                      placeholder="Select namespaces..."
                      emptyMessage="No namespaces available"
                    />
                    {filters.namespaces.map(namespace => (
                      <div key={namespace} className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">{namespace}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1"
                          onClick={() => onFiltersChange({
                            ...filters,
                            namespaces: filters.namespaces.filter(n => n !== namespace)
                          })}
                        >
                          <span className="text-xs">Remove</span>
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Pods */}
          <AccordionItem value="pods" className="border-b">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">Pods</span>
                {filters.pods.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filters.pods.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {loadingPods ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : filters.namespaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select namespaces first</p>
                ) : (
                  <>
                    <MultiSelectDropdown
                      options={availablePods}
                      selectedValues={filters.pods}
                      onSelectionChange={(pods) => onFiltersChange({ ...filters, pods })}
                      placeholder="Select pods..."
                      emptyMessage="No pods available"
                    />
                    <ScrollArea className="h-32">
                      {filters.pods.map(pod => (
                        <div key={pod} className="flex items-center justify-between py-1">
                          <span className="text-sm text-muted-foreground truncate pr-2">{pod}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 shrink-0"
                            onClick={() => onFiltersChange({
                              ...filters,
                              pods: filters.pods.filter(p => p !== pod)
                            })}
                          >
                            <span className="text-xs">Remove</span>
                          </Button>
                        </div>
                      ))}
                    </ScrollArea>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Containers */}
          <AccordionItem value="containers" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-medium">Containers</span>
                {filters.containers.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filters.containers.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {loadingContainers ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : filters.pods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select pods first</p>
                ) : (
                  <>
                    <MultiSelectDropdown
                      options={availableContainers}
                      selectedValues={filters.containers}
                      onSelectionChange={(containers) => onFiltersChange({ ...filters, containers })}
                      placeholder="Select containers..."
                      emptyMessage="No containers available"
                    />
                    {filters.containers.map(container => (
                      <div key={container} className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">{container}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1"
                          onClick={() => onFiltersChange({
                            ...filters,
                            containers: filters.containers.filter(c => c !== container)
                          })}
                        >
                          <span className="text-xs">Remove</span>
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  )
}