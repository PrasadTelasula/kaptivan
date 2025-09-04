import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LogEntryOptimized } from './LogEntryOptimized'
import type { LogEntry as LogEntryType } from '../types/logs'
import type { DisplaySettings } from './LogDisplaySettings'
import { cn } from '@/utils/cn'
import { FileText, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { JsonDrawer } from './JsonDrawer'

interface OptimizedLogViewerProps {
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

export const OptimizedLogViewer = memo(({
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
}: OptimizedLogViewerProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false)
  const [jsonDrawerData, setJsonDrawerData] = useState<any>(null)
  const [jsonDrawerTitle, setJsonDrawerTitle] = useState('Log JSON Data')
  const [jsonDrawerDescription, setJsonDrawerDescription] = useState('')
  
  // Generate unique key for each log entry
  const getLogKey = useCallback((log: LogEntryType, index: number) => {
    return `${log.timestamp}-${log.lineNumber}-${index}`
  }, [])
  
  // Calculate dynamic row height based on expanded state
  const estimateSize = useCallback((index: number) => {
    // Return a minimal estimate, let measureElement handle actual sizing
    return 60 // Base estimate for any row
  }, [])
  
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    measureElement: (element) => {
      if (element) {
        const rect = element.getBoundingClientRect()
        return rect.height
      }
      return 60
    },
  })
  
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
    
    // Force virtualizer to re-measure immediately after expansion state changes
    requestAnimationFrame(() => {
      virtualizer.measure()
    })
  }, [logs, getLogKey, virtualizer])
  
  // Handle opening JSON drawer
  const handleOpenJsonDrawer = useCallback((data: any, log: LogEntryType) => {
    setJsonDrawerData(data)
    setJsonDrawerTitle('Log JSON Data')
    setJsonDrawerDescription(`From ${log.pod} at ${new Date(log.timestamp).toLocaleString()}`)
    setJsonDrawerOpen(true)
  }, [])
  
  // Handle scroll detection
  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement) return
    
    const handleScroll = () => {
      setIsUserScrolling(true)
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Reset after 3 seconds of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false)
      }, 3000)
    }
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isUserScrolling && parentRef.current && logs.length > 0) {
      const scrollElement = parentRef.current
      scrollElement.scrollTop = scrollElement.scrollHeight
    }
  }, [logs.length, autoScroll, isUserScrolling])
  
  // Force re-measure when logs or expansion state changes
  useEffect(() => {
    virtualizer.measure()
  }, [logs, expandedItems, virtualizer])
  
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
                    Pick containers (optional)
                  </li>
                </ol>
              </div>
            </>
          ) : !hasSelectedNamespaces ? (
            <>
              <p className="text-lg font-semibold">Select Namespaces</p>
              <p className="text-sm">Choose one or more namespaces to view logs from</p>
            </>
          ) : !hasSelectedPods ? (
            <>
              <p className="text-lg font-semibold">Select Pods</p>
              <p className="text-sm">Choose specific pods to stream logs</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">No Logs Available</p>
              <p className="text-sm">The selected pods don't have any logs yet</p>
            </>
          )}
        </div>
      </div>
    )
  }
  
  // Show loading state
  if (loading && logs.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full",
        className
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading logs...</p>
        </div>
      </div>
    )
  }
  
  const items = virtualizer.getVirtualItems()
  
  return (
    <div className={cn("h-full relative", className)}>
      <ScrollArea 
        ref={parentRef}
        className="h-full"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map((virtualRow) => {
            const log = logs[virtualRow.index]
            const key = getLogKey(log, virtualRow.index)
            
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="relative w-full"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  minHeight: 'auto',
                  transform: `translateY(${virtualRow.start}px)`,
                  zIndex: expandedItems.has(key) ? 10 : 1,
                }}
              >
                <div className={cn(
                  "transition-all",
                  expandedItems.has(key) && "shadow-lg rounded-md bg-background"
                )}>
                  <LogEntryOptimized
                    log={log}
                    expanded={expandedItems.has(key)}
                    onToggle={() => handleToggleExpand(virtualRow.index)}
                    searchTerm={searchTerm}
                    displaySettings={displaySettings}
                    lineNumber={virtualRow.index + 1}
                    onOpenJsonDrawer={(data) => handleOpenJsonDrawer(data, log)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      
      {loading && logs.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Streaming logs...</span>
        </div>
      )}
      
      {/* Single JSON Drawer instance */}
      {jsonDrawerData && (
        <JsonDrawer
          open={jsonDrawerOpen}
          onOpenChange={(open) => {
            setJsonDrawerOpen(open)
            if (!open) {
              // Clear data when closing
              setTimeout(() => {
                setJsonDrawerData(null)
              }, 300) // Wait for animation to complete
            }
          }}
          data={jsonDrawerData}
          title={jsonDrawerTitle}
          description={jsonDrawerDescription}
        />
      )}
    </div>
  )
})

OptimizedLogViewer.displayName = 'OptimizedLogViewer'