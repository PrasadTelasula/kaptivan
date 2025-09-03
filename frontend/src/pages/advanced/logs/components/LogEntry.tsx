import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, AlertCircle, AlertTriangle, Info, Bug, Radio } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { LogEntry as LogEntryType } from '../types/logs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DisplaySettings } from './LogDisplaySettings'

interface LogEntryProps {
  log: LogEntryType
  expanded?: boolean
  onToggle?: () => void
  searchTerm?: string
  displaySettings?: DisplaySettings
  lineNumber?: number
}

const LogLevelIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'ERROR':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'WARN':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'INFO':
      return <Info className="h-4 w-4 text-blue-500" />
    case 'DEBUG':
      return <Bug className="h-4 w-4 text-gray-500" />
    case 'TRACE':
      return <Radio className="h-4 w-4 text-purple-500" />
    default:
      return <Info className="h-4 w-4 text-gray-400" />
  }
}

const getLevelColor = (level: string) => {
  switch (level) {
    case 'ERROR':
      return 'text-red-500 bg-red-500/10 border-red-500/20'
    case 'WARN':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
    case 'INFO':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    case 'DEBUG':
      return 'text-gray-500 bg-gray-500/10 border-gray-500/20'
    case 'TRACE':
      return 'text-purple-500 bg-purple-500/10 border-purple-500/20'
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

const highlightSearchTerm = (text: string, searchTerm?: string) => {
  if (!searchTerm) return text
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'))
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={index} className="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

export const LogEntry: React.FC<LogEntryProps> = ({
  log,
  expanded = false,
  onToggle,
  searchTerm,
  displaySettings = {
    showCluster: true,
    showPod: true,
    showContainer: true,
    showTimestamp: true,
    showLevel: true,
    showLineNumbers: false,
  },
  lineNumber
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [copied, setCopied] = useState(false)
  
  const handleToggle = () => {
    setIsExpanded(!isExpanded)
    onToggle?.()
  }
  
  const handleCopy = () => {
    navigator.clipboard.writeText(log.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }
  
  return (
    <div
      className={cn(
        "group border-b border-border/50 hover:bg-muted/30 transition-colors",
        log.highlighted && "bg-yellow-50 dark:bg-yellow-900/10",
        log.level === 'ERROR' && "border-l-2 border-l-red-500",
        log.level === 'WARN' && "border-l-2 border-l-yellow-500"
      )}
    >
      <div className="flex items-start gap-2 px-3 py-1.5">
        {/* Expand button */}
        <button
          onClick={handleToggle}
          className="mt-0.5 p-0.5 hover:bg-muted rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        
        {/* Line number */}
        {displaySettings.showLineNumbers && lineNumber !== undefined && (
          <span className="text-xs text-muted-foreground/50 font-mono w-12 text-right">
            {lineNumber}
          </span>
        )}
        
        {/* Timestamp */}
        {displaySettings.showTimestamp && (
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {formatTimestamp(log.timestamp)}
          </span>
        )}
        
        {/* Level */}
        {displaySettings.showLevel && (
          <div className="flex items-center gap-1">
            <LogLevelIcon level={log.level} />
            <Badge
              variant="outline"
              className={cn("text-xs h-5 px-1.5", getLevelColor(log.level))}
            >
              {log.level}
            </Badge>
          </div>
        )}
        
        {/* Cluster/Pod/Container info */}
        {(displaySettings.showCluster || displaySettings.showPod || displaySettings.showContainer) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {displaySettings.showCluster && (
              <>
                <Badge variant="outline" className="h-5 px-1.5">
                  {log.cluster}
                </Badge>
                {(displaySettings.showPod || displaySettings.showContainer) && <span>/</span>}
              </>
            )}
            {displaySettings.showPod && (
              <>
                <span className="text-xs">{log.pod}</span>
                {displaySettings.showContainer && <span>/</span>}
              </>
            )}
            {displaySettings.showContainer && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {log.container}
              </Badge>
            )}
          </div>
        )}
        
        {/* Message */}
        <div className="flex-1 font-mono text-sm break-all">
          {highlightSearchTerm(log.message, searchTerm)}
        </div>
        
        {/* Copy button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={handleCopy}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="px-12 pb-2 space-y-1">
          <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
            <div>
              <span className="font-semibold">Namespace:</span> {log.namespace}
            </div>
            <div>
              <span className="font-semibold">Container:</span> {log.container}
            </div>
            <div>
              <span className="font-semibold">Source:</span> {log.source}
            </div>
            <div>
              <span className="font-semibold">Line:</span> {log.lineNumber}
            </div>
          </div>
          {log.message.length > 200 && (
            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
              {log.message}
            </div>
          )}
        </div>
      )}
      
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded shadow-lg text-sm">
          Copied to clipboard!
        </div>
      )}
    </div>
  )
}