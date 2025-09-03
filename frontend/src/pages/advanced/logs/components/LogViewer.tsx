import React, { useRef, useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LogEntry } from './LogEntry'
import type { LogEntry as LogEntryType } from '../types/logs'
import { cn } from '@/utils/cn'
import { Loader2, FileText, Filter, ArrowRight } from 'lucide-react'
import type { DisplaySettings } from './LogDisplaySettings'

interface LogViewerProps {
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

export const LogViewer: React.FC<LogViewerProps> = ({
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isUserScrolling && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [logs, autoScroll, isUserScrolling])
  
  // Detect user scrolling
  const handleScroll = () => {
    setIsUserScrolling(true)
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // Reset after 3 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        const isAtBottom = 
          scrollElement.scrollHeight - scrollElement.scrollTop <= scrollElement.clientHeight + 10
        if (isAtBottom) {
          setIsUserScrolling(false)
        }
      }
    }, 3000)
  }
  
  useEffect(() => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => {
        scrollElement.removeEventListener('scroll', handleScroll)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }
  }, [])
  
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
      
      {/* Log entries */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="font-mono text-sm">
          {logs.map((log, index) => (
            <LogEntry
              key={`${log.timestamp}-${log.lineNumber}-${index}`}
              log={log}
              searchTerm={searchTerm}
              displaySettings={displaySettings}
              lineNumber={displaySettings.showLineNumbers ? index + 1 : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}