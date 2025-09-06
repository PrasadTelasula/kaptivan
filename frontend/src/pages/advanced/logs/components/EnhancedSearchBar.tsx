import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Sparkles, Command, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SearchMetrics {
  cacheHitRate: number
  avgLatency: number
  indexedLogs: number
}

interface EnhancedSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  metrics?: SearchMetrics
  className?: string
  placeholder?: string
  isLoading?: boolean
  logLevels: string[]
  onLogLevelToggle: (level: string) => void
  selectedLogLevels: string[]
  totalLogs: number
  bufferInfo?: {
    size: number
    capacity: number
    isAtCapacity: boolean
  }
}

const LOG_LEVEL_CONFIG = {
  ERROR: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    hoverBg: 'hover:bg-red-500/20',
    borderColor: 'border-red-500/20',
    icon: AlertCircle,
  },
  WARN: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    hoverBg: 'hover:bg-yellow-500/20',
    borderColor: 'border-yellow-500/20',
    icon: AlertTriangle,
  },
  INFO: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverBg: 'hover:bg-blue-500/20',
    borderColor: 'border-blue-500/20',
    icon: Info,
  },
  DEBUG: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    hoverBg: 'hover:bg-gray-500/20',
    borderColor: 'border-gray-500/20',
    icon: CheckCircle2,
  },
  TRACE: {
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    hoverBg: 'hover:bg-purple-500/20',
    borderColor: 'border-purple-500/20',
    icon: Sparkles,
  },
}

export const EnhancedSearchBar: React.FC<EnhancedSearchBarProps> = ({
  value,
  onChange,
  onSearch,
  onClear,
  metrics,
  className,
  placeholder = 'Search logs... (⌘K for command palette)',
  isLoading = false,
  logLevels,
  onLogLevelToggle,
  selectedLogLevels,
  totalLogs,
  bufferInfo,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocused])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch()
    }
  }

  const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-500'
    if (value >= thresholds.warning) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getLatencyColor = (latency: number) => {
    if (latency <= 50) return 'text-green-500'
    if (latency <= 100) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input Section */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="relative">
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors",
              isFocused ? "text-primary" : "text-muted-foreground"
            )} />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={cn(
                "pl-10 pr-10 h-10 transition-all",
                isFocused && "ring-2 ring-primary/20"
              )}
              disabled={isLoading}
            />
            {value && (
              <button
                onClick={() => {
                  onChange('')
                  inputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {isFocused && (
            <div className="absolute z-10 mt-1 text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to search, 
              <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> to cancel
            </div>
          )}
        </div>
        
        <Button 
          onClick={onSearch}
          disabled={isLoading}
          className="min-w-[100px]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Searching
            </div>
          ) : (
            'Search'
          )}
        </Button>
        
        {value && (
          <Button 
            onClick={onClear}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Log Level Filters */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground font-medium">LEVELS:</span>
        <div className="flex gap-1">
          {logLevels.map(level => {
            const config = LOG_LEVEL_CONFIG[level as keyof typeof LOG_LEVEL_CONFIG]
            const isSelected = selectedLogLevels.includes(level)
            const Icon = config?.icon || Info
            
            return (
              <TooltipProvider key={level}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onLogLevelToggle(level)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                        "border",
                        isSelected ? [
                          config?.bgColor,
                          config?.color,
                          config?.borderColor,
                          "ring-1",
                          config?.borderColor?.replace('border', 'ring')
                        ] : [
                          "bg-background",
                          "text-muted-foreground",
                          "border-border",
                          "hover:bg-muted/50"
                        ]
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {level}
                      {isSelected && (
                        <CheckCircle2 className="h-3 w-3 ml-0.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isSelected ? 'Click to hide' : 'Click to show'} {level} logs</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          {metrics && (
            <>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  getMetricColor(metrics.cacheHitRate, { good: 80, warning: 50 }) === 'text-green-500' ? 'bg-green-500' :
                  getMetricColor(metrics.cacheHitRate, { good: 80, warning: 50 }) === 'text-yellow-500' ? 'bg-yellow-500' :
                  'bg-red-500'
                )} />
                <span className="text-muted-foreground">Cache:</span>
                <span className={cn("font-medium", getMetricColor(metrics.cacheHitRate, { good: 80, warning: 50 }))}>
                  {metrics.cacheHitRate}%
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  getLatencyColor(metrics.avgLatency) === 'text-green-500' ? 'bg-green-500' :
                  getLatencyColor(metrics.avgLatency) === 'text-yellow-500' ? 'bg-yellow-500' :
                  'bg-red-500'
                )} />
                <span className="text-muted-foreground">Latency:</span>
                <span className={cn("font-medium", getLatencyColor(metrics.avgLatency))}>
                  {metrics.avgLatency}ms
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Indexed:</span>
                <span className="font-medium text-foreground">
                  {metrics.indexedLogs.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
        
        {bufferInfo && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Buffer:</span>
              <span className={cn(
                "font-medium",
                bufferInfo.isAtCapacity ? "text-yellow-500" : "text-foreground"
              )}>
                {bufferInfo.size.toLocaleString()} / {bufferInfo.capacity.toLocaleString()}
              </span>
              {bufferInfo.isAtCapacity && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Buffer at capacity. Oldest logs are being dropped.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium text-foreground">
                {totalLogs.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}