import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LogEntryProfessional as LogEntryOptimized } from './LogEntryProfessional'
import type { LogEntry as LogEntryType } from '../types/logs'
import type { DisplaySettings } from './LogDisplaySettings'
import { cn } from '@/utils/cn'
import { FileText, Loader2 } from 'lucide-react'
import { JsonDrawer } from './JsonDrawer'
import { TextScramble } from '../../../../../components/motion-primitives/text-scramble'

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
  
  // Generate stable unique key for each log entry (not dependent on array position)
  const getLogKey = useCallback((log: LogEntryType, index?: number) => {
    // Include a hash of the message content to ensure uniqueness
    const messageHash = log.message.length > 0 ? 
      log.message.split('').reduce((hash, char) => {
        const code = char.charCodeAt(0)
        hash = ((hash << 5) - hash) + code
        return hash & hash // Convert to 32bit integer
      }, 0) : 0
    
    return `${log.timestamp}-${log.lineNumber}-${log.cluster}-${log.pod}-${log.container}-${Math.abs(messageHash)}-${index ?? 0}`
  }, [])
  
  // Create reversed logs for display (latest first)
  const reversedLogs = useMemo(() => {
    return [...logs].reverse()
  }, [logs])
  
  // Calculate dynamic row height based on expanded state
  const estimateSize = useCallback((index: number) => {
    const log = reversedLogs[index]
    if (!log) return 60
    
    const key = getLogKey(log, index)
    const isExpanded = expandedItems.has(key)
    
    // Return estimated height based on expansion state
    if (isExpanded) {
      // Estimate expanded height based on content
      const messageLength = log.message.length
      const estimatedLines = Math.ceil(messageLength / 80) + 10 // Extra for metadata and padding
      return Math.max(200, estimatedLines * 20) // Minimum 200px, scale with content
    }
    
    return 60 // Collapsed height
  }, [reversedLogs, expandedItems, getLogKey])
  
  const virtualizer = useVirtualizer({
    count: reversedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 3,
    getItemKey: (index) => {
      if (index >= reversedLogs.length) return `item-${index}`
      const log = reversedLogs[index]
      return getLogKey(log, index)
    },
  })
  
  // Disable virtualization during streaming to prevent glitches
  const [isStreamingLogs, setIsStreamingLogs] = useState(false)
  
  // Detect when streaming starts/stops
  useEffect(() => {
    setIsStreamingLogs(loading && logs.length > 0)
  }, [loading, logs.length])
  
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
    
    // Since we're using non-virtualized rendering, expansion happens naturally
    // without jumping or layout shifts
  }, [reversedLogs, getLogKey])
  
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
  
  return (
    <div className={cn("h-full relative", className)}>
      <div 
        ref={parentRef}
        className="h-full overflow-y-auto"
      >
        {/* Always use non-virtualized rendering to prevent jumping issues */}
        <div className="w-full">
          {reversedLogs.map((log, index) => {
            const key = getLogKey(log, index)
            const isExpanded = expandedItems.has(key)
            const originalLineNumber = logs.length - index
            
            return (
              <div key={key} className="w-full" data-log-key={key}>
                <LogEntryOptimized
                  log={log}
                  expanded={isExpanded}
                  onToggle={() => handleToggleExpand(index)}
                  searchTerm={searchTerm}
                  displaySettings={displaySettings}
                  lineNumber={originalLineNumber}
                  onOpenJsonDrawer={(data) => handleOpenJsonDrawer(data, log)}
                />
              </div>
            )
          })}
        </div>
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

OptimizedLogViewer.displayName = 'OptimizedLogViewer'