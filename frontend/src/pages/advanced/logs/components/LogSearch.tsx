import React, { useState, useCallback, useEffect } from 'react'
import { Search, X, Filter, Clock, Download, Play, Pause, Loader2 } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'

interface LogSearchProps {
  onSearch: (query: string) => void
  onTimeRangeChange: (range: string) => void
  onToggleStream: () => void
  isStreaming: boolean
  logCount?: number
  className?: string
}

const timeRanges = [
  { label: 'Last 5 minutes', value: 'last5m' },
  { label: 'Last 15 minutes', value: 'last15m' },
  { label: 'Last 1 hour', value: 'last1h' },
  { label: 'Last 6 hours', value: 'last6h' },
  { label: 'Last 24 hours', value: 'last24h' },
  { label: 'Custom range', value: 'custom' },
]

export const LogSearch: React.FC<LogSearchProps> = ({
  onSearch,
  onTimeRangeChange,
  onToggleStream,
  isStreaming,
  logCount = 0,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState('last15m')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  
  // Debounce the search query with 300ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  
  // Effect to handle debounced search
  useEffect(() => {
    // Only trigger search if the query actually changed
    setIsTyping(false)
    onSearch(debouncedSearchQuery)
    
    // Add to search history only if not empty
    if (debouncedSearchQuery.trim()) {
      setSearchHistory(prev => {
        const updated = [debouncedSearchQuery, ...prev.filter(q => q !== debouncedSearchQuery)]
        return updated.slice(0, 10) // Keep last 10 searches
      })
    }
  }, [debouncedSearchQuery]) // Remove onSearch from dependencies to avoid infinite loop
  
  // Handle immediate search on Enter key or Search button click
  const handleImmediateSearch = useCallback(() => {
    if (searchQuery.trim()) {
      setIsTyping(false)
      onSearch(searchQuery)
      // Add to search history
      setSearchHistory(prev => {
        const updated = [searchQuery, ...prev.filter(q => q !== searchQuery)]
        return updated.slice(0, 10) // Keep last 10 searches
      })
    }
  }, [searchQuery, onSearch])
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleImmediateSearch()
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setIsTyping(true)
  }
  
  const handleTimeRangeSelect = (value: string) => {
    setSelectedTimeRange(value)
    onTimeRangeChange(value)
  }
  
  const clearSearch = () => {
    setSearchQuery('')
    setIsTyping(false)
    onSearch('')
  }
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Main search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search logs... (e.g., error AND kubernetes OR level:ERROR pod:nginx*)"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10 h-10 font-mono text-sm bg-background"
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              {isTyping && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              <button
                onClick={clearSearch}
                className="hover:bg-accent rounded p-0.5"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          )}
        </div>
        
        {/* Time range selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-2">
              <Clock className="h-4 w-4" />
              {timeRanges.find(r => r.value === selectedTimeRange)?.label || 'Time Range'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Time Range</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {timeRanges.map(range => (
              <DropdownMenuItem
                key={range.value}
                onClick={() => handleTimeRangeSelect(range.value)}
                className={selectedTimeRange === range.value ? 'bg-accent' : ''}
              >
                {range.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Stream toggle */}
        <Button
          variant={isStreaming ? "destructive" : "default"}
          size="default"
          onClick={onToggleStream}
          className="gap-2"
        >
          {isStreaming ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Stream
            </>
          )}
        </Button>
        
        {/* Search button for immediate search */}
        <Button onClick={handleImmediateSearch} size="default">
          Search
        </Button>
      </div>
      
      {/* Search filters and stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {/* Recent searches */}
          {searchHistory.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Recent searches
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Recent Searches</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {searchHistory.map((query, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => {
                      setSearchQuery(query)
                      onSearch(query)
                    }}
                    className="font-mono text-xs"
                  >
                    {query}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Quick filters */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Quick filters:</span>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => {
                setSearchQuery('level:ERROR')
                onSearch('level:ERROR')
              }}
            >
              Errors
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => {
                setSearchQuery('level:WARN')
                onSearch('level:WARN')
              }}
            >
              Warnings
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => {
                setSearchQuery('kubernetes')
                onSearch('kubernetes')
              }}
            >
              Kubernetes
            </Badge>
          </div>
        </div>
        
        {/* Results count */}
        <div className="flex items-center gap-2 text-muted-foreground">
          {isTyping ? (
            <span className="flex items-center gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </span>
          ) : (
            <span>{logCount.toLocaleString()} events</span>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>
    </div>
  )
}