import React, { useState, memo, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Copy, Check, AlertCircle, AlertTriangle, Info, Bug, Radio, FileJson, Maximize2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { LogEntry as LogEntryType } from '../types/logs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DisplaySettings } from './LogDisplaySettings'
import { JsonViewer } from './JsonViewer'

interface LogEntryProps {
  log: LogEntryType
  expanded?: boolean
  onToggle?: () => void
  searchTerm?: string
  displaySettings?: DisplaySettings
  lineNumber?: number
  onOpenJsonDrawer?: (data: any) => void
}

const LogLevelIcon = memo(({ level }: { level: string }) => {
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
})

LogLevelIcon.displayName = 'LogLevelIcon'

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

// Detect if a string is JSON
const isJsonString = (str: string): boolean => {
  if (!str) return false
  const trimmed = str.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

// Try to parse JSON
const tryParseJson = (str: string): any | null => {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

export const LogEntryOptimized = memo(({
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
  lineNumber,
  onOpenJsonDrawer
}: LogEntryProps) => {
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [copied, setCopied] = useState(false)
  
  // Check if message contains JSON
  const messageData = useMemo(() => {
    // First check if the entire message is JSON
    if (isJsonString(log.message)) {
      const parsed = tryParseJson(log.message)
      if (parsed) return { isJson: true, data: parsed, text: null }
    }
    
    // Check if message starts with JSON (like {"timestamp":...})
    const trimmed = log.message.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Try to find where JSON ends
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let jsonEndIndex = -1
      
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i]
        
        if (escapeNext) {
          escapeNext = false
          continue
        }
        
        if (char === '\\') {
          escapeNext = true
          continue
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }
        
        if (!inString) {
          if (char === '{' || char === '[') {
            braceCount++
          } else if (char === '}' || char === ']') {
            braceCount--
            if (braceCount === 0) {
              jsonEndIndex = i + 1
              break
            }
          }
        }
      }
      
      if (jsonEndIndex > 0) {
        const jsonStr = trimmed.substring(0, jsonEndIndex)
        const parsed = tryParseJson(jsonStr)
        if (parsed) {
          const remainingText = trimmed.substring(jsonEndIndex).trim()
          return { isJson: true, data: parsed, text: remainingText || null }
        }
      }
    }
    
    // Check if message contains JSON after some text (common in structured logs)
    const jsonMatch = log.message.match(/^(.*?)(\{.*\}|\[.*\])$/s)
    if (jsonMatch) {
      const [, prefix, jsonStr] = jsonMatch
      const parsed = tryParseJson(jsonStr)
      if (parsed) return { isJson: true, data: parsed, text: prefix.trim() }
    }
    
    return { isJson: false, data: null, text: log.message }
  }, [log.message])
  
  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded)
    onToggle?.()
  }, [isExpanded, onToggle])
  
  const handleCopy = useCallback(() => {
    const textToCopy = messageData.isJson 
      ? JSON.stringify(messageData.data, null, 2)
      : log.message
    
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [messageData, log.message])
  
  const formatTimestamp = useCallback((date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }, [])
  
  return (
    <div
      className={cn(
        "group border-b border-border/50 hover:bg-muted/30 transition-colors overflow-hidden relative",
        log.highlighted && "bg-yellow-50 dark:bg-yellow-900/10",
        log.level === 'ERROR' && "border-l-4 border-l-red-500",
        log.level === 'WARN' && "border-l-4 border-l-yellow-500"
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Expand button */}
        <button
          onClick={handleToggle}
          className="mt-0.5 p-0.5 hover:bg-muted rounded transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        
        {/* Line number */}
        {displaySettings.showLineNumbers && lineNumber !== undefined && (
          <span className="text-xs text-muted-foreground/50 font-mono w-12 text-right select-none">
            {lineNumber}
          </span>
        )}
        
        {/* Timestamp */}
        {displaySettings.showTimestamp && (
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap select-none">
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            {displaySettings.showCluster && (
              <Badge variant="outline" className="h-5 px-1.5">
                {log.cluster}
              </Badge>
            )}
            {displaySettings.showPod && (
              <Badge variant="outline" className="h-5 px-1.5 max-w-[150px]">
                <span className="truncate">{log.pod}</span>
              </Badge>
            )}
            {displaySettings.showContainer && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {log.container}
              </Badge>
            )}
          </div>
        )}
        
        {/* JSON indicator with drawer trigger */}
        {messageData.isJson && (
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-1.5 gap-1"
            onClick={() => onOpenJsonDrawer && onOpenJsonDrawer(messageData.data)}
          >
            <FileJson className="h-3 w-3" />
            <span className="text-xs">JSON</span>
            <Maximize2 className="h-3 w-3 ml-1" />
          </Button>
        )}
        
        {/* Message - Always show raw log message in main line */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm break-all">
            {highlightSearchTerm(log.message, searchTerm)}
          </div>
        </div>
        
        {/* Copy button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-2 bg-muted/50 border-t border-border/50">
          {/* Metadata */}
          <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 mb-3">
            <div className="flex gap-1">
              <span className="font-semibold">Namespace:</span>
              <span className="font-mono">{log.namespace}</span>
            </div>
            <div className="flex gap-1">
              <span className="font-semibold">Container:</span>
              <span className="font-mono">{log.container}</span>
            </div>
            <div className="flex gap-1">
              <span className="font-semibold">Source:</span>
              <span className="font-mono">{log.source || 'stdout'}</span>
            </div>
            <div className="flex gap-1">
              <span className="font-semibold">Line:</span>
              <span className="font-mono">{log.lineNumber}</span>
            </div>
          </div>
          
          {/* Raw log message first - Always visible */}
          <div className="space-y-3">
            <div className="bg-red-50 dark:bg-red-950/20 p-1 rounded">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-700 dark:text-red-300">
                <span>📝 Raw Log Message:</span>
                <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900">Original</Badge>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-md p-4 max-h-48 overflow-auto border-2 border-red-200 dark:border-red-800">
                <div className="text-sm font-mono whitespace-pre-wrap break-all text-gray-900 dark:text-gray-100">
                  {log.message || 'No message content'}
                </div>
              </div>
            </div>
            
            {/* Formatted content (if JSON) */}
            {messageData.isJson && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                    <span>Formatted JSON:</span>
                    <Badge variant="secondary" className="text-xs">Parsed</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenJsonDrawer && onOpenJsonDrawer(messageData.data)}
                    className="gap-2"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Open in Drawer
                  </Button>
                </div>
                <div className="bg-card rounded-md p-3 max-h-96 overflow-auto border border-border">
                  <JsonViewer
                    data={messageData.data}
                    searchTerm={searchTerm}
                    defaultExpanded={false}
                    maxDepth={3}
                    className=""
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {copied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded shadow-lg text-sm z-50">
          Copied to clipboard!
        </div>
      )}
    </div>
  )
})

LogEntryOptimized.displayName = 'LogEntryOptimized'