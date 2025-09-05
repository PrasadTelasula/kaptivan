import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LogFilters as LogFiltersType } from '../types/logs'
import { MultiSelectDropdown } from './MultiSelectDropdown'
import { Loader2 } from 'lucide-react'

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

export const LogFiltersSimple: React.FC<LogFiltersProps> = ({
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
  const handleLogLevelChange = (level: string, checked: boolean) => {
    const newLevels = checked
      ? [...filters.logLevels, level]
      : filters.logLevels.filter(l => l !== level)
    onFiltersChange({ ...filters, logLevels: newLevels })
  }

  const activeCount = 
    filters.logLevels.length + 
    filters.clusters.length + 
    filters.namespaces.length + 
    filters.pods.length + 
    filters.containers.length

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Filters</h3>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({
                ...filters,
                clusters: [],
                namespaces: [],
                pods: [],
                containers: [],
                logLevels: [],
              })}
            >
              Clear ({activeCount})
            </Button>
          )}
        </div>

        {/* Log Levels */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Log Levels</Label>
          <div className="space-y-2">
            {['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map(level => (
              <div key={level} className="flex items-center space-x-2">
                <Checkbox
                  id={`level-${level}`}
                  checked={filters.logLevels.includes(level)}
                  onCheckedChange={(checked) => handleLogLevelChange(level, checked as boolean)}
                />
                <Label 
                  htmlFor={`level-${level}`} 
                  className="text-sm font-normal cursor-pointer"
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Clusters */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Clusters</Label>
          <MultiSelectDropdown
            options={availableClusters}
            selected={filters.clusters}
            onChange={(clusters) => onFiltersChange({ ...filters, clusters })}
            placeholder="Select clusters..."
            emptyText="No clusters available"
          />
        </div>

        {/* Namespaces */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Namespaces</Label>
          {loadingNamespaces ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : filters.clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select a cluster first</p>
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

        {/* Pods */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Pods</Label>
          {loadingPods ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : filters.namespaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select namespaces first</p>
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

        {/* Containers */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Containers</Label>
          {loadingContainers ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : filters.pods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select pods first</p>
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
  )
}