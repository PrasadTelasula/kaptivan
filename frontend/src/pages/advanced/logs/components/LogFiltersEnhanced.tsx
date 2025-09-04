import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LogFilters as LogFiltersType } from '../types/logs'
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug, 
  Radio,
  X,
  Filter,
  ChevronRight,
  Loader2,
  Sparkles,
  Server,
  Layers,
  Package,
  Container
} from 'lucide-react'
import { MultiSelectDropdown } from './MultiSelectDropdown'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'

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
  { value: 'ERROR', label: 'Error', icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
  { value: 'WARN', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' },
  { value: 'INFO', label: 'Info', icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  { value: 'DEBUG', label: 'Debug', icon: Bug, color: 'text-gray-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' },
  { value: 'TRACE', label: 'Trace', icon: Radio, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
]

const FilterSection = ({ 
  title, 
  icon: Icon, 
  children, 
  expanded = true,
  onToggle,
  badge
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  expanded?: boolean
  onToggle?: () => void
  badge?: number
}) => {
  return (
    <div className="space-y-3">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">{title}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {onToggle && (
          <ChevronRight className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-7 space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const LogFiltersEnhanced: React.FC<LogFiltersProps> = ({
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
  const [expandedSections, setExpandedSections] = useState({
    levels: true,
    clusters: true,
    namespaces: true,
    pods: true,
    containers: true
  })
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }
  
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
  
  const activeFiltersCount = 
    filters.clusters.length + 
    filters.namespaces.length + 
    filters.pods.length + 
    filters.containers.length + 
    filters.logLevels.length
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Filters</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 px-2">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2 text-xs"
                  disabled={activeFiltersCount === 0}
                >
                  Clear all
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all active filters</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Filters Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Log Levels */}
        <FilterSection 
          title="Log Levels" 
          icon={Sparkles}
          expanded={expandedSections.levels}
          onToggle={() => toggleSection('levels')}
          badge={filters.logLevels.length}
        >
          <div className="grid grid-cols-1 gap-2">
            {logLevels.map(level => {
              const Icon = level.icon
              const isChecked = filters.logLevels.includes(level.value)
              return (
                <motion.label
                  key={level.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                    isChecked
                      ? `${level.bgColor} ${level.borderColor} shadow-sm`
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    id={`level-${level.value}`}
                    checked={isChecked}
                    onCheckedChange={() => handleLogLevelToggle(level.value)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Icon className={cn("h-4 w-4", level.color)} />
                  <span className="text-sm font-medium flex-1">{level.label}</span>
                  {isChecked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  )}
                </motion.label>
              )
            })}
          </div>
        </FilterSection>
        
        {/* Clusters */}
        <FilterSection 
          title="Clusters" 
          icon={Server}
          expanded={expandedSections.clusters}
          onToggle={() => toggleSection('clusters')}
          badge={filters.clusters.length}
        >
          <MultiSelectDropdown
            options={availableClusters}
            selected={filters.clusters}
            onChange={handleClustersChange}
            placeholder="Select clusters..."
            searchPlaceholder="Search clusters..."
            emptyText="No clusters available"
            className="w-full"
          />
          {filters.clusters.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.clusters.map(cluster => (
                <Badge
                  key={cluster}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 pr-1 gap-1"
                >
                  {cluster}
                  <button
                    onClick={() => handleClustersChange(filters.clusters.filter(c => c !== cluster))}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FilterSection>
        
        {/* Namespaces */}
        <FilterSection 
          title="Namespaces" 
          icon={Layers}
          expanded={expandedSections.namespaces}
          onToggle={() => toggleSection('namespaces')}
          badge={filters.namespaces.length}
        >
          <div className="relative">
            <MultiSelectDropdown
              options={availableNamespaces}
              selected={filters.namespaces}
              onChange={handleNamespacesChange}
              placeholder={availableNamespaces.length === 0 && !loadingNamespaces ? "Select a cluster first" : "Select namespaces..."}
              searchPlaceholder="Search namespaces..."
              emptyText="No namespaces found"
              loading={loadingNamespaces}
              disabled={availableClusters.length === 0 || filters.clusters.length === 0}
              className="w-full"
            />
            {loadingNamespaces && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
          {filters.namespaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.namespaces.map(ns => (
                <Badge
                  key={ns}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 pr-1 gap-1"
                >
                  {ns}
                  <button
                    onClick={() => handleNamespacesChange(filters.namespaces.filter(n => n !== ns))}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FilterSection>
        
        {/* Pods */}
        <FilterSection 
          title="Pods" 
          icon={Package}
          expanded={expandedSections.pods}
          onToggle={() => toggleSection('pods')}
          badge={filters.pods.length}
        >
          <div className="relative">
            <MultiSelectDropdown
              options={availablePods}
              selected={filters.pods}
              onChange={handlePodsChange}
              placeholder={availablePods.length === 0 && !loadingPods ? "Select namespaces first" : "Select pods..."}
              searchPlaceholder="Search pods..."
              emptyText="No pods found"
              loading={loadingPods}
              disabled={availableNamespaces.length === 0 || filters.namespaces.length === 0}
              className="w-full"
            />
            {loadingPods && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
          {filters.pods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.pods.map(pod => (
                <Badge
                  key={pod}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 pr-1 gap-1"
                >
                  <span className="truncate max-w-[120px]">{pod}</span>
                  <button
                    onClick={() => handlePodsChange(filters.pods.filter(p => p !== pod))}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FilterSection>
        
        {/* Containers */}
        <FilterSection 
          title="Containers" 
          icon={Container}
          expanded={expandedSections.containers}
          onToggle={() => toggleSection('containers')}
          badge={filters.containers.length}
        >
          <div className="relative">
            <MultiSelectDropdown
              options={availableContainers}
              selected={filters.containers}
              onChange={handleContainersChange}
              placeholder={availableContainers.length === 0 && !loadingContainers ? "Select pods first" : "Select containers..."}
              searchPlaceholder="Search containers..."
              emptyText="No containers found"
              loading={loadingContainers}
              disabled={availablePods.length === 0 || filters.pods.length === 0}
              className="w-full"
            />
            {loadingContainers && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
          {filters.containers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.containers.map(container => (
                <Badge
                  key={container}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 pr-1 gap-1"
                >
                  {container}
                  <button
                    onClick={() => handleContainersChange(filters.containers.filter(c => c !== container))}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FilterSection>
      </div>
    </div>
  )
}