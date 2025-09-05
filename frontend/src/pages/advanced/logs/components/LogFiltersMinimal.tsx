import React from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { LogFilters as LogFiltersType } from '../types/logs'
import { X, Loader2 } from 'lucide-react'
import { MultiSelectDropdown } from './MultiSelectDropdown'

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

const LOG_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

export const LogFiltersMinimal: React.FC<LogFiltersProps> = ({
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
      logLevels: [],
    })
  }

  const activeCount = 
    filters.logLevels.length + 
    filters.clusters.length + 
    filters.namespaces.length + 
    filters.pods.length + 
    filters.containers.length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium">Filters</h3>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-7 px-2 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Log Levels */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Log Levels
            </Label>
            <div className="flex flex-wrap gap-1">
              {LOG_LEVELS.map(level => (
                <Button
                  key={level}
                  variant={filters.logLevels.includes(level) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLogLevelToggle(level)}
                  className="h-7 px-2 text-xs"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Clusters */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Clusters
            </Label>
            <MultiSelectDropdown
              options={availableClusters}
              selected={filters.clusters}
              onChange={(clusters) => onFiltersChange({ ...filters, clusters })}
              placeholder="Select clusters..."
              emptyText="No clusters available"
            />
          </div>

          <Separator />

          {/* Namespaces */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Namespaces
            </Label>
            {loadingNamespaces ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : filters.clusters.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Select a cluster first</p>
            ) : (
              <MultiSelectDropdown
                options={availableNamespaces}
                selected={filters.namespaces}
                onChange={(namespaces) => onFiltersChange({ ...filters, namespaces })}
                placeholder="Select namespaces..."
                emptyText="No namespaces available"
              />
            )}
          </div>

          <Separator />

          {/* Pods */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Pods
            </Label>
            {loadingPods ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : filters.namespaces.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Select namespaces first</p>
            ) : (
              <MultiSelectDropdown
                options={availablePods}
                selected={filters.pods}
                onChange={(pods) => onFiltersChange({ ...filters, pods })}
                placeholder="Select pods..."
                emptyText="No pods available"
              />
            )}
          </div>

          <Separator />

          {/* Containers */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Containers
            </Label>
            {loadingContainers ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : filters.pods.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Select pods first</p>
            ) : (
              <MultiSelectDropdown
                options={availableContainers}
                selected={filters.containers}
                onChange={(containers) => onFiltersChange({ ...filters, containers })}
                placeholder="Select containers..."
                emptyText="No containers available"
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}