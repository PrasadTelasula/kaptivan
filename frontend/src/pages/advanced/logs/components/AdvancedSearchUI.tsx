import React, { useState, useCallback, useEffect } from 'react'
import { Search, Filter, X, Clock, Hash, Tag, Folder, Box, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface SearchOptions {
  query: string
  namespaces: string[]
  pods: string[]
  containers: string[]
  levels: string[]
  startTime?: Date
  endTime?: Date
  regex: boolean
  caseSensitive: boolean
  limit: number
  fieldSelectors: Record<string, string>
  labelSelectors: Record<string, string>
}

interface AdvancedSearchUIProps {
  onSearch: (options: SearchOptions) => void
  onClear: () => void
  availableNamespaces?: string[]
  availablePods?: string[]
  availableContainers?: string[]
  searchMetrics?: {
    cacheHitRate: number
    avgLatency: number
    indexedLogs: number
  }
  className?: string
}

export const AdvancedSearchUI: React.FC<AdvancedSearchUIProps> = ({
  onSearch,
  onClear,
  availableNamespaces = [],
  availablePods = [],
  availableContainers = [],
  searchMetrics,
  className
}) => {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    query: '',
    namespaces: [],
    pods: [],
    containers: [],
    levels: [],
    regex: false,
    caseSensitive: false,
    limit: 100,
    fieldSelectors: {},
    labelSelectors: {}
  })
  
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedFilters, setSavedFilters] = useState<SearchOptions[]>([])
  
  // Load recent searches from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('kaptivan-recent-searches')
    if (recent) {
      setRecentSearches(JSON.parse(recent))
    }
    
    const saved = localStorage.getItem('kaptivan-saved-filters')
    if (saved) {
      setSavedFilters(JSON.parse(saved))
    }
  }, [])
  
  const handleSearch = useCallback(() => {
    if (searchOptions.query || searchOptions.namespaces.length > 0 || searchOptions.pods.length > 0) {
      onSearch(searchOptions)
      
      // Save to recent searches
      if (searchOptions.query) {
        const newRecent = [searchOptions.query, ...recentSearches.filter(s => s !== searchOptions.query)].slice(0, 10)
        setRecentSearches(newRecent)
        localStorage.setItem('kaptivan-recent-searches', JSON.stringify(newRecent))
      }
    }
  }, [searchOptions, onSearch, recentSearches])
  
  const handleClear = useCallback(() => {
    setSearchOptions({
      query: '',
      namespaces: [],
      pods: [],
      containers: [],
      levels: [],
      regex: false,
      caseSensitive: false,
      limit: 100,
      fieldSelectors: {},
      labelSelectors: {}
    })
    onClear()
  }, [onClear])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setIsCommandOpen(true)
    }
  }, [handleSearch])
  
  const addFilter = useCallback((type: string, value: string) => {
    setSearchOptions(prev => ({
      ...prev,
      [type]: [...prev[type as keyof SearchOptions] as string[], value]
    }))
  }, [])
  
  const removeFilter = useCallback((type: string, value: string) => {
    setSearchOptions(prev => ({
      ...prev,
      [type]: (prev[type as keyof SearchOptions] as string[]).filter(v => v !== value)
    }))
  }, [])
  
  const LogLevelBadge = ({ level }: { level: string }) => {
    const variants: Record<string, string> = {
      ERROR: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
      WARN: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
      INFO: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
      DEBUG: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
    }
    
    return (
      <Badge 
        variant="outline" 
        className={cn('cursor-pointer transition-colors', variants[level] || variants.INFO)}
        onClick={() => {
          if (searchOptions.levels.includes(level)) {
            removeFilter('levels', level)
          } else {
            addFilter('levels', level)
          }
        }}
      >
        {level}
        {searchOptions.levels.includes(level) && <CheckCircle className="ml-1 h-3 w-3" />}
      </Badge>
    )
  }
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchOptions.query}
            onChange={(e) => setSearchOptions(prev => ({ ...prev, query: e.target.value }))}
            onKeyDown={handleKeyDown}
            placeholder="Search logs... (⌘K for command palette)"
            className="pl-10 pr-10"
          />
          {searchOptions.query && (
            <X 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setSearchOptions(prev => ({ ...prev, query: '' }))}
            />
          )}
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <Label>Search Mode</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="regex"
                      checked={searchOptions.regex}
                      onCheckedChange={(checked) => setSearchOptions(prev => ({ ...prev, regex: checked }))}
                    />
                    <Label htmlFor="regex" className="text-sm">Regex</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="case"
                      checked={searchOptions.caseSensitive}
                      onCheckedChange={(checked) => setSearchOptions(prev => ({ ...prev, caseSensitive: checked }))}
                    />
                    <Label htmlFor="case" className="text-sm">Case Sensitive</Label>
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Result Limit</Label>
                <Select 
                  value={searchOptions.limit.toString()} 
                  onValueChange={(value) => setSearchOptions(prev => ({ ...prev, limit: parseInt(value) }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 results</SelectItem>
                    <SelectItem value="100">100 results</SelectItem>
                    <SelectItem value="500">500 results</SelectItem>
                    <SelectItem value="1000">1000 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Button onClick={handleSearch} className="px-6">
          Search
        </Button>
        
        {(searchOptions.query || searchOptions.namespaces.length > 0 || searchOptions.pods.length > 0) && (
          <Button onClick={handleClear} variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Active Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Log Level Filters */}
        <div className="flex gap-1">
          <LogLevelBadge level="ERROR" />
          <LogLevelBadge level="WARN" />
          <LogLevelBadge level="INFO" />
          <LogLevelBadge level="DEBUG" />
        </div>
        
        {/* Namespace Filters */}
        {searchOptions.namespaces.map(ns => (
          <Badge key={ns} variant="secondary" className="cursor-pointer">
            <Folder className="h-3 w-3 mr-1" />
            {ns}
            <X className="h-3 w-3 ml-1" onClick={() => removeFilter('namespaces', ns)} />
          </Badge>
        ))}
        
        {/* Pod Filters */}
        {searchOptions.pods.map(pod => (
          <Badge key={pod} variant="secondary" className="cursor-pointer">
            <Box className="h-3 w-3 mr-1" />
            {pod}
            <X className="h-3 w-3 ml-1" onClick={() => removeFilter('pods', pod)} />
          </Badge>
        ))}
        
        {/* Container Filters */}
        {searchOptions.containers.map(container => (
          <Badge key={container} variant="secondary" className="cursor-pointer">
            <Hash className="h-3 w-3 mr-1" />
            {container}
            <X className="h-3 w-3 ml-1" onClick={() => removeFilter('containers', container)} />
          </Badge>
        ))}
      </div>
      
      {/* Search Metrics */}
      {searchMetrics && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {searchMetrics.avgLatency.toFixed(0)}ms
          </div>
          <div className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {searchMetrics.indexedLogs.toLocaleString()} indexed
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {searchMetrics.cacheHitRate.toFixed(0)}% cache hit
          </div>
        </div>
      )}
      
      {/* Command Palette */}
      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Type to search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {recentSearches.length > 0 && (
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search, i) => (
                <CommandItem
                  key={i}
                  onSelect={() => {
                    setSearchOptions(prev => ({ ...prev, query: search }))
                    setIsCommandOpen(false)
                    handleSearch()
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {search}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          <CommandSeparator />
          
          <CommandGroup heading="Namespaces">
            {availableNamespaces.map(ns => (
              <CommandItem
                key={ns}
                onSelect={() => {
                  addFilter('namespaces', ns)
                  setIsCommandOpen(false)
                }}
              >
                <Folder className="h-4 w-4 mr-2" />
                {ns}
              </CommandItem>
            ))}
          </CommandGroup>
          
          <CommandGroup heading="Pods">
            {availablePods.slice(0, 20).map(pod => (
              <CommandItem
                key={pod}
                onSelect={() => {
                  addFilter('pods', pod)
                  setIsCommandOpen(false)
                }}
              >
                <Box className="h-4 w-4 mr-2" />
                {pod}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}