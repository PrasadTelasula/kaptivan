import React, { useRef, useEffect, useState, useCallback } from 'react'
import { LogEntry } from './LogEntry'
import type { LogEntry as LogEntryType } from '../types/logs'
import type { DisplaySettings } from './LogDisplaySettings'
import { cn } from '@/utils/cn'
import { Loader2, FileText, Filter, ArrowRight } from 'lucide-react'

interface VirtualLogViewerProps {
  logs: LogEntryType[]
  loading?: boolean
  searchTerm?: string
  autoScroll?: boolean
  className?: string
  hasSelectedPods?: boolean
  hasSelectedClusters?: boolean
  hasSelectedNamespaces?: boolean
  hasSelectedContainers?: boolean
  displaySettings?: DisplaySettings
}

export const VirtualLogViewer: React.FC<VirtualLogViewerProps> = ({
  logs,
  loading = false,
  searchTerm,
  autoScroll = true,
  className,
  hasSelectedPods = false,
  hasSelectedClusters = false,
  hasSelectedNamespaces = false,
  hasSelectedContainers = false,
  displaySettings = {
    showCluster: true,
    showPod: true,
    showContainer: true,
    showTimestamp: true,
    showLevel: true,
    showLineNumbers: false,
  }
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  
  const ITEM_HEIGHT = 32 // Estimated height for a single log entry
  const OVERSCAN = 10 // Number of items to render outside visible area
  
  // Generate unique key for each log entry
  const getLogKey = useCallback((log: LogEntryType, index: number) => {
    return `${log.timestamp}-${log.lineNumber}-${index}`
  }, [])
  
  // Handle log entry expansion
  const handleToggleExpand = useCallback((index: number) => {
    const log = logs[index]
    const key = getLogKey(log, index)
    
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }, [logs, getLogKey])
  
  // Handle scroll to update visible range
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    
    // Calculate visible range
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
    const end = Math.min(
      logs.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
    )
    
    setVisibleRange({ start, end })
    
    // Detect user scrolling
    setIsUserScrolling(true)
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // Reset after 3 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 3000)
  }, [logs.length])
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isUserScrolling && scrollContainerRef.current && logs.length > 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [logs.length, autoScroll, isUserScrolling])
  
  // Update visible range when logs change
  useEffect(() => {
    handleScroll()
  }, [logs, handleScroll])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])
  
  // Show empty state if no logs and not loading
  if (logs.length === 0 && !loading) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full text-muted-foreground",
        className
      )}>
        <div className="text-center space-y-4">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
          
          {!hasSelectedClusters ? (
            <>
              <p className="text-lg font-semibold">Welcome to Multi-Cluster Logs</p>
              <div className="max-w-md mx-auto space-y-2">
                <p className="text-sm">To view logs, follow these steps:</p>
                <ol className="text-sm text-left space-y-1 mx-auto max-w-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-primary font-semibold">1.</span>
                    Select one or more clusters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground font-semibold">2.</span>
                    Choose namespaces to filter
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground font-semibold">3.</span>
                    Select specific pods
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground font-semibold">4.</span>
                    Select specific containers
                  </li>
                </ol>
              </div>
            </>
          ) : !hasSelectedNamespaces ? (
            <>
              <p className="text-lg font-semibold">Select Namespaces</p>
              <p className="text-sm max-w-md mx-auto">
                Choose one or more namespaces from the filters panel to continue.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Filter className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
                <span>Select namespaces to see available pods</span>
              </div>
            </>
          ) : !hasSelectedPods ? (
            <>
              <p className="text-lg font-semibold">Select Pods</p>
              <p className="text-sm max-w-md mx-auto">
                Choose one or more pods from the filters panel to see their containers.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Filter className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
                <span>Pods are now available for selection</span>
              </div>
            </>
          ) : !hasSelectedContainers ? (
            <>
              <p className="text-lg font-semibold">Select Containers to View Logs</p>
              <p className="text-sm max-w-md mx-auto">
                Choose one or more containers from the filters panel to start viewing their logs.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Filter className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
                <span>Containers are now available for selection</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">No logs found</p>
              <p className="text-sm max-w-md mx-auto">
                The selected pods have no logs matching your current filters.
                Try adjusting your log level filters or time range.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }
  
  // Calculate the visible logs
  const visibleLogs = logs.slice(visibleRange.start, visibleRange.end)
  const totalHeight = logs.length * ITEM_HEIGHT
  const offsetY = visibleRange.start * ITEM_HEIGHT
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Log count and status */}
      <div className="flex items-center justify-between px-3 py-1 border-b text-xs text-muted-foreground">
        <span>{logs.length} logs</span>
        {isUserScrolling && (
          <span className="text-yellow-600">Scroll paused</span>
        )}
        {loading && (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading...</span>
          </div>
        )}
      </div>
      
      {/* Virtual scrolling log entries */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto font-mono text-sm"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleLogs.map((log, i) => {
              const actualIndex = visibleRange.start + i
              const key = getLogKey(log, actualIndex)
              const isExpanded = expandedItems.has(key)
              
              return (
                <LogEntry
                  key={key}
                  log={log}
                  expanded={isExpanded}
                  onToggle={() => handleToggleExpand(actualIndex)}
                  searchTerm={searchTerm}
                  displaySettings={displaySettings}
                  lineNumber={displaySettings.showLineNumbers ? actualIndex + 1 : undefined}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}