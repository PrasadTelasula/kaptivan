import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { LogFilters as LogFiltersType } from '../types/logs'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, AlertTriangle, Info, Bug, Radio } from 'lucide-react'
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

const logLevels = [
  { value: 'ERROR', label: 'Error', icon: AlertCircle, color: 'text-red-500' },
  { value: 'WARN', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500' },
  { value: 'INFO', label: 'Info', icon: Info, color: 'text-blue-500' },
  { value: 'DEBUG', label: 'Debug', icon: Bug, color: 'text-gray-500' },
  { value: 'TRACE', label: 'Trace', icon: Radio, color: 'text-purple-500' },
]

export const LogFilters: React.FC<LogFiltersProps> = ({
  filters,
  onFiltersChange,
  availableClusters,
  availableNamespaces,
  availablePods,
  availableContainers,
  loadingNamespaces = false,
  loadingPods = false,
  loadingContainers = false
}) => {
  const handleClustersChange = (clusters: string[]) => {
    onFiltersChange({ ...filters, clusters })
  }
  
  const handleNamespacesChange = (namespaces: string[]) => {
    onFiltersChange({ ...filters, namespaces })
  }
  
  const handlePodsChange = (pods: string[]) => {
    onFiltersChange({ ...filters, pods })
  }
  
  const handleContainersChange = (containers: string[]) => {
    onFiltersChange({ ...filters, containers })
  }
  
  const handleLogLevelToggle = (level: string) => {
    const updated = filters.logLevels.includes(level)
      ? filters.logLevels.filter(l => l !== level)
      : [...filters.logLevels, level]
    onFiltersChange({ ...filters, logLevels: updated })
  }
  
  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      clusters: [],
      namespaces: [],
      pods: [],
      containers: [],
      logLevels: [],
    })
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Filters</CardTitle>
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Log Levels */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Log Levels</Label>
          <div className="space-y-2">
            {logLevels.map(level => {
              const Icon = level.icon
              return (
                <div key={level.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`level-${level.value}`}
                    checked={filters.logLevels.includes(level.value)}
                    onCheckedChange={() => handleLogLevelToggle(level.value)}
                  />
                  <label
                    htmlFor={`level-${level.value}`}
                    className="flex items-center gap-2 text-xs cursor-pointer flex-1"
                  >
                    <Icon className={`h-3 w-3 ${level.color}`} />
                    <span>{level.label}</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>
        
        <Separator />
        
        {/* Clusters */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Clusters</Label>
          <MultiSelectDropdown
            options={availableClusters}
            selected={filters.clusters}
            onChange={handleClustersChange}
            placeholder="Select clusters..."
            searchPlaceholder="Search clusters..."
            emptyText="No clusters available"
          />
        </div>
        
        <Separator />
        
        {/* Namespaces */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Namespaces</Label>
          <MultiSelectDropdown
            options={availableNamespaces}
            selected={filters.namespaces}
            onChange={handleNamespacesChange}
            placeholder={availableNamespaces.length === 0 && !loadingNamespaces ? "Select a cluster first" : "Select namespaces..."}
            searchPlaceholder="Search namespaces..."
            emptyText="No namespaces found"
            loading={loadingNamespaces}
            disabled={availableClusters.length === 0 || filters.clusters.length === 0}
          />
        </div>
        
        <Separator />
        
        {/* Pods */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pods</Label>
          <MultiSelectDropdown
            options={availablePods}
            selected={filters.pods}
            onChange={handlePodsChange}
            placeholder={availablePods.length === 0 && !loadingPods ? "Select namespaces first" : "Select pods..."}
            searchPlaceholder="Search pods..."
            emptyText="No pods found"
            loading={loadingPods}
            disabled={availableNamespaces.length === 0 || filters.namespaces.length === 0}
          />
        </div>
        
        <Separator />
        
        {/* Containers */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Containers</Label>
          <MultiSelectDropdown
            options={availableContainers}
            selected={filters.containers}
            onChange={handleContainersChange}
            placeholder={availableContainers.length === 0 && !loadingContainers ? "Select pods first" : "Select containers..."}
            searchPlaceholder="Search containers..."
            emptyText="No containers found"
            loading={loadingContainers}
            disabled={availablePods.length === 0 || filters.pods.length === 0}
          />
        </div>
      </CardContent>
    </Card>
  )
}