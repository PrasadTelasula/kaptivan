import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LogEntryProfessional as LogEntryOptimized } from './LogEntryProfessional'
import type { LogEntry as LogEntryType } from '../types/logs'
import type { DisplaySettings } from './LogDisplaySettings'
import { cn } from '@/utils/cn'
import { FileText, Loader2 } from 'lucide-react'
import { JsonDrawer } from './JsonDrawer'
import { TextScramble } from '../../../../../components/motion-primitives/text-scramble'
import { Badge } from '@/components/ui/badge'

interface VirtualizedLogViewerProps {
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
  bufferInfo?: {
    size: number
    capacity: number
    isAtCapacity: boolean
  }
  totalLogsReceived?: number
}

export const VirtualizedLogViewer = memo(({
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
  },
  bufferInfo,
  totalLogsReceived = 0
}: VirtualizedLogViewerProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false)
  const [jsonDrawerData, setJsonDrawerData] = useState<any>(null)
  const [jsonDrawerTitle, setJsonDrawerTitle] = useState('Log JSON Data')
  const [jsonDrawerDescription, setJsonDrawerDescription] = useState('')
  
  // Generate stable unique key for each log entry
  const getLogKey = useCallback((log: LogEntryType, index: number) => {
    // Use index as part of key for stability in virtual list
    return `${log.timestamp}-${log.cluster}-${log.pod}-${index}`
  }, [])
  
  // Create reversed logs for display (latest first)
  const reversedLogs = useMemo(() => {
    return [...logs].reverse()
  }, [logs])
  
  // Use dynamic sizing - let virtualizer measure actual DOM heights
  const estimateSize = useCallback(() => {
    // Return a reasonable default - virtualizer will measure actual heights
    return 100
  }, [])
  
  // Setup virtualizer with proper configuration for dynamic measurement
  const virtualizer = useVirtualizer({
    count: reversedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 3, // Reduced overscan for better performance with dynamic sizing
    getItemKey: (index) => getLogKey(reversedLogs[index], index),
    // Enable dynamic measurement
    measureElement: (element) => {
      if (!element) return 0
      return element.getBoundingClientRect().height
    },
  })
  
  // Handle log entry expansion
  const handleToggleExpand = useCallback((index: number) => {
    const log = reversedLogs[index]
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
    
    // Force re-measurement after state change with multiple attempts
    setTimeout(() => virtualizer.measure(), 0)
    setTimeout(() => virtualizer.measure(), 100)
    setTimeout(() => virtualizer.measure(), 300)
  }, [reversedLogs, getLogKey, virtualizer])
  
  // Simplified resize handling for dynamic measurement
  useEffect(() => {
    const handleLogResize = () => {
      virtualizer.measure()
    }
    
    window.addEventListener('logEntryResized', handleLogResize)
    return () => {
      window.removeEventListener('logEntryResized', handleLogResize)
    }
  }, [virtualizer])
  
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
  
  // Auto-scroll to top when new logs arrive (since latest are now at top)
  useEffect(() => {
    if (autoScroll && !isUserScrolling && parentRef.current && logs.length > 0) {
      const scrollElement = parentRef.current
      scrollElement.scrollTop = 0
    }
  }, [logs.length, autoScroll, isUserScrolling])
  
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
              <TextScramble 
                key="welcome"
                className="text-lg font-semibold"
                duration={1.2}
                speed={0.04}
                trigger={true}
              >
                Welcome to Multi-Cluster Logs
              </TextScramble>
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
              <TextScramble 
                key="select-namespaces"
                className="text-lg font-semibold"
                duration={1.2}
                speed={0.04}
                trigger={true}
              >
                Select Namespaces
              </TextScramble>
              <p className="text-sm">Choose one or more namespaces to view logs from</p>
            </>
          ) : !hasSelectedPods ? (
            <>
              <TextScramble 
                key="select-pods"
                className="text-lg font-semibold"
                duration={1.2}
                speed={0.04}
                trigger={true}
              >
                Select Pods
              </TextScramble>
              <p className="text-sm">Choose specific pods to stream logs</p>
            </>
          ) : !hasSelectedContainers ? (
            <>
              <TextScramble 
                key="select-containers"
                className="text-lg font-semibold"
                duration={1.2}
                speed={0.04}
                trigger={true}
              >
                Select Containers
              </TextScramble>
              <p className="text-sm">Pick containers to view their logs</p>
            </>
          ) : (
            <>
              <TextScramble 
                key="no-logs"
                className="text-lg font-semibold"
                duration={1.2}
                speed={0.04}
                trigger={true}
              >
                No Logs Available
              </TextScramble>
              <p className="text-sm">The selected containers don't have any logs yet</p>
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
  
  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems()
  
  return (
    <div className={cn("h-full relative", className)}>
      <div 
        ref={parentRef}
        className="h-full overflow-y-auto"
      >
        {/* Virtual list container */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Only render visible items */}
          {virtualItems.map((virtualItem) => {
            const log = reversedLogs[virtualItem.index]
            const key = getLogKey(log, virtualItem.index)
            const isExpanded = expandedItems.has(key)
            const originalLineNumber = logs.length - virtualItem.index
            
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={(node) => virtualizer.measureElement(node)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <LogEntryOptimized
                  log={log}
                  expanded={isExpanded}
                  onToggle={() => handleToggleExpand(virtualItem.index)}
                  searchTerm={searchTerm}
                  displaySettings={displaySettings}
                  lineNumber={originalLineNumber}
                  onOpenJsonDrawer={(data) => handleOpenJsonDrawer(data, log)}
                />
              </div>
            )
          })}
        </div>
        
        {/* Render stats in header using React Portal */}
        {process.env.NODE_ENV === 'development' && typeof document !== 'undefined' && document.getElementById('rendering-stats-container') && 
          createPortal(
            <div className="flex items-center gap-1.5 ml-3">
              <div className="h-[2px] w-8 bg-border" />
              <Badge 
                variant={virtualItems.length > 100 ? "destructive" : virtualItems.length > 50 ? "secondary" : "outline"} 
                className="h-5 px-2 py-0 text-[10px] font-mono gap-1"
              >
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  virtualItems.length > 100 ? "bg-red-500" : virtualItems.length > 50 ? "bg-yellow-500" : "bg-green-500"
                )} />
                <span className="opacity-70">Rendered:</span>
                <span className="font-bold">{virtualItems.length}</span>
                <span className="opacity-50">/</span>
                <span className="opacity-70">{reversedLogs.length}</span>
              </Badge>
              
              <Badge variant="outline" className="h-5 px-2 py-0 text-[10px] font-mono gap-1">
                <span className="opacity-70">Range:</span>
                <span>{virtualItems[0]?.index ?? 0}</span>
                <span className="opacity-50">-</span>
                <span>{virtualItems[virtualItems.length - 1]?.index ?? 0}</span>
              </Badge>
              
              {virtualizer.scrollOffset > 0 && (
                <Badge variant="outline" className="h-5 px-2 py-0 text-[10px] font-mono gap-1 animate-in fade-in duration-200">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="opacity-70">Scroll:</span>
                  <span>{Math.round(virtualizer.scrollOffset)}px</span>
                </Badge>
              )}
            </div>,
            document.getElementById('rendering-stats-container')!
          )
        }
      </div>
      
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

VirtualizedLogViewer.displayName = 'VirtualizedLogViewer'