import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Command, Filter, Clock, Activity, AlertCircle, AlertTriangle, Info, Bug, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface CompactSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  isLoading?: boolean
  logLevels: string[]
  onLogLevelToggle: (level: string) => void
  selectedLogLevels: string[]
  totalLogs: number
  metrics?: {
    cacheHitRate: number
    avgLatency: number
    indexedLogs: number
  }
  className?: string
}

const LOG_LEVEL_CONFIG = {
  ERROR: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/20' },
  WARN: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  INFO: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/20' },
  DEBUG: { icon: Bug, color: 'text-gray-500', bg: 'bg-gray-500/20' },
  TRACE: { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/20' },
}

export const CompactSearchBar: React.FC<CompactSearchBarProps> = ({
  value,
  onChange,
  onSearch,
  onClear,
  isLoading = false,
  logLevels,
  onLogLevelToggle,
  selectedLogLevels,
  totalLogs,
  metrics,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch()
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search logs... (⌘K)"
          className="h-8 pl-8 pr-8 text-xs"
          disabled={isLoading}
        />
        {value && (
          <button
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <Button
        onClick={onSearch}
        disabled={isLoading}
        size="sm"
        className="h-8 px-3 text-xs"
      >
        Search
      </Button>

      {/* Compact Level Filters */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-md">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Levels:</span>
        {logLevels.map(level => {
          const config = LOG_LEVEL_CONFIG[level as keyof typeof LOG_LEVEL_CONFIG]
          const Icon = config?.icon || Info
          const isSelected = selectedLogLevels.includes(level)
          
          return (
            <TooltipProvider key={level}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onLogLevelToggle(level)}
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded transition-all",
                      isSelected ? [config?.bg, config?.color] : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{level} - {isSelected ? 'Active' : 'Hidden'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>

      {/* Metrics Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Activity className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <div className="space-y-2 text-xs">
            <div className="font-medium text-sm mb-2">Performance Metrics</div>
            
            {metrics && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cache Hit Rate:</span>
                  <span className={cn(
                    "font-medium",
                    metrics.cacheHitRate >= 80 ? "text-green-500" :
                    metrics.cacheHitRate >= 50 ? "text-yellow-500" : "text-red-500"
                  )}>{metrics.cacheHitRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Latency:</span>
                  <span className={cn(
                    "font-medium",
                    metrics.avgLatency <= 50 ? "text-green-500" :
                    metrics.avgLatency <= 100 ? "text-yellow-500" : "text-red-500"
                  )}>{metrics.avgLatency}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Indexed:</span>
                  <span className="font-medium">{metrics.indexedLogs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Logs:</span>
                  <span className="font-medium">{totalLogs.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}