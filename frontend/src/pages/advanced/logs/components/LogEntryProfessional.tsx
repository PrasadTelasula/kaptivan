import React, { useState, memo, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Copy, Check, AlertCircle, AlertTriangle, Info, Bug, Radio, FileJson, Maximize2, Terminal, Clock, Server, Package, Box, Plus, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { LogEntry as LogEntryType } from '../types/logs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DisplaySettings } from './LogDisplaySettings'
import { JsonViewer } from './JsonViewer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface LogEntryProps {
  log: LogEntryType
  expanded?: boolean
  onToggle?: () => void
  searchTerm?: string
  displaySettings?: DisplaySettings
  lineNumber?: number
  onOpenJsonDrawer?: (data: any) => void
}

const LogLevelConfig = {
  ERROR: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-900',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  WARN: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-900',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  INFO: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-900',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  DEBUG: {
    icon: Bug,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  },
  TRACE: {
    icon: Radio,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-900',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  },
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

const isJsonString = (str: string): boolean => {
  if (!str) return false
  const trimmed = str.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

const tryParseJson = (str: string): any | null => {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

export const LogEntryProfessional = memo(({
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
  const [rawLogFontSize, setRawLogFontSize] = useState(13) // Base font size in pixels
  const contentRef = useRef<HTMLDivElement>(null)
  
  const levelConfig = LogLevelConfig[log.level as keyof typeof LogLevelConfig] || LogLevelConfig.INFO
  const IconComponent = levelConfig.icon
  
  const messageData = useMemo(() => {
    if (isJsonString(log.message)) {
      const parsed = tryParseJson(log.message)
      if (parsed) return { isJson: true, data: parsed, text: null }
    }
    
    const trimmed = log.message.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
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
      hour12: false
    }) + '.' + new Date(date).getMilliseconds().toString().padStart(3, '0')
  }, [])
  
  const increaseFontSize = useCallback(() => {
    setRawLogFontSize(prev => Math.min(prev + 1, 24)) // Max font size 24px
  }, [])
  
  const decreaseFontSize = useCallback(() => {
    setRawLogFontSize(prev => Math.max(prev - 1, 8)) // Min font size 8px
  }, [])
  
  return (
    <TooltipProvider>
      <div
        className={cn(
          "group relative transition-all duration-200",
          "hover:bg-muted/20",
          log.highlighted && "bg-yellow-50/50 dark:bg-yellow-950/10",
          isExpanded && "bg-muted/10 dark:bg-muted/20 shadow-sm"
        )}
      >
        {/* Left accent border for error/warning or expanded state */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 transition-all duration-200",
          (log.level === 'ERROR' || log.level === 'WARN')
            ? "w-1" 
            : isExpanded 
              ? "w-1 dark:w-1.5" 
              : "w-0",
          (log.level === 'ERROR' || log.level === 'WARN')
            ? (log.level === 'ERROR' ? "bg-red-500" : "bg-amber-500")
            : isExpanded
              ? "bg-primary dark:bg-primary/90"
              : "bg-transparent"
        )} />
        
        <div className={cn(
          "flex items-start gap-3 px-4 py-2.5",
          (log.level === 'ERROR' || log.level === 'WARN' || isExpanded) && "pl-5"
        )}>
          {/* Expand button with rotation animation */}
          <button
            onClick={handleToggle}
            className="mt-0.5 p-0.5 hover:bg-muted rounded-sm transition-colors shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          </button>
          
          {/* Line number */}
          {displaySettings.showLineNumbers && lineNumber !== undefined && (
            <span className="text-[10px] text-muted-foreground/40 font-mono w-10 text-right select-none shrink-0 mt-1">
              {lineNumber}
            </span>
          )}
          
          {/* Timestamp */}
          {displaySettings.showTimestamp && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{new Date(log.timestamp).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Level Badge */}
          {displaySettings.showLevel && (
            <div className="shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 gap-1 font-medium text-[10px] uppercase tracking-wider",
                  levelConfig.badge
                )}
              >
                <IconComponent className="h-3 w-3" />
                {log.level}
              </Badge>
            </div>
          )}
          
          {/* Source Info */}
          <div className="flex items-center gap-1.5 shrink-0">
            {displaySettings.showCluster && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-muted/50">
                    <Server className="h-2.5 w-2.5" />
                    <span className="max-w-[80px] truncate">{log.cluster}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Cluster: {log.cluster}</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {displaySettings.showPod && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-muted/50">
                    <Package className="h-2.5 w-2.5" />
                    <span className="max-w-[100px] truncate">{log.pod}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Pod: {log.pod}</p>
                  <p className="text-xs">Namespace: {log.namespace}</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {displaySettings.showContainer && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[10px]">
                    <Box className="h-2.5 w-2.5" />
                    <span className="max-w-[80px] truncate">{log.container}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Container: {log.container}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {/* JSON indicator */}
          {messageData.isJson && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 px-1.5 gap-1 text-[10px] bg-primary/5 border-primary/20 hover:bg-primary/10 shrink-0"
                  onClick={() => onOpenJsonDrawer && onOpenJsonDrawer(messageData.data)}
                >
                  <FileJson className="h-3 w-3 text-primary" />
                  <span className="font-medium">JSON</span>
                  <Maximize2 className="h-2.5 w-2.5 ml-0.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Click to view formatted JSON</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Message */}
          <div className="flex-1 min-w-0">
            {messageData.isJson ? (
              <div className="space-y-1">
                {messageData.text && (
                  <div className="font-mono text-[13px] text-foreground/90 break-all">
                    {highlightSearchTerm(messageData.text, searchTerm)}
                  </div>
                )}
                {!isExpanded && (
                  <div className="font-mono text-[11px] text-muted-foreground truncate max-w-full">
                    <Terminal className="h-3 w-3 inline mr-1" />
                    {JSON.stringify(messageData.data).substring(0, 120)}...
                  </div>
                )}
              </div>
            ) : (
              <div className="font-mono text-[13px] text-foreground/90 break-all leading-relaxed">
                {highlightSearchTerm(messageData.text || '', searchTerm)}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{copied ? 'Copied!' : 'Copy log'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {/* Expanded details with smooth collapse animation */}
        <motion.div
          animate={{
            height: isExpanded ? 'auto' : 0,
            opacity: isExpanded ? 1 : 0
          }}
          initial={false}
          transition={{
            height: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] },
            opacity: { duration: 0.3, delay: isExpanded ? 0.1 : 0 }
          }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-3 pt-2">
            <Card className={cn(
              "border shadow-sm bg-card/50 backdrop-blur-sm transition-colors duration-300",
              isExpanded 
                ? "border-primary dark:border-primary/80 shadow-lg shadow-primary/20 dark:shadow-primary/30 ring-1 ring-primary/20 dark:ring-primary/40" 
                : "border-border"
            )}>
              <CardContent className="p-4">
                <motion.div
                  animate={{
                    y: isExpanded ? 0 : -20,
                    opacity: isExpanded ? 1 : 0
                  }}
                  transition={{
                    duration: 0.3,
                    delay: isExpanded ? 0.15 : 0,
                    ease: "easeOut"
                  }}
                >
                  {/* Metadata grid */}
                  <div className="grid grid-cols-4 gap-4 mb-3 py-2">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Namespace</p>
                      <p className="text-xs font-mono">{log.namespace}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Container</p>
                      <p className="text-xs font-mono">{log.container}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Source</p>
                      <p className="text-xs font-mono">{log.source || 'stdout'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Line</p>
                      <p className="text-xs font-mono">{log.lineNumber}</p>
                    </div>
                  </div>
                  
                  {/* Raw log message - Professional styling */}
                  <div className="space-y-3">
                    <div className="border rounded-lg shadow-sm bg-card">
                      <div className="flex items-center justify-between p-3 pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Raw Log Message</span>
                          <Badge variant="secondary" className="text-xs">
                            Original
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {log.message ? `${log.message.length} chars` : '0 chars'}
                          </Badge>
                          <div className="flex items-center border rounded-md">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 rounded-r-none border-r"
                                  onClick={decreaseFontSize}
                                  disabled={rawLogFontSize <= 8}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Decrease font size</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="px-2 text-xs font-mono text-muted-foreground">
                              {rawLogFontSize}px
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 rounded-l-none border-l"
                                  onClick={increaseFontSize}
                                  disabled={rawLogFontSize >= 24}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Increase font size</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(log.message || '')
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="bg-muted/30 rounded-md border">
                          <div className="p-3 max-h-48 overflow-auto">
                            <pre 
                              className="font-mono whitespace-pre-wrap break-all text-foreground/90 leading-relaxed"
                              style={{ fontSize: `${rawLogFontSize}px` }}
                            >
                              {log.message || 'No message content'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Formatted JSON viewer - Professional styling */}
                    {messageData.isJson && (
                      <div className="border rounded-lg shadow-sm bg-card">
                        <div className="flex items-center justify-between p-3 pb-2 border-b">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Formatted JSON</span>
                            <Badge variant="secondary" className="text-xs">
                              Parsed
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {Object.keys(messageData.data || {}).length} keys
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => onOpenJsonDrawer && onOpenJsonDrawer(messageData.data)}
                            >
                              <Maximize2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="bg-muted/30 rounded-md border max-h-96 overflow-auto">
                            <div className="p-3">
                              <JsonViewer
                                data={messageData.data}
                                searchTerm={searchTerm}
                                defaultExpanded={false}
                                maxDepth={3}
                                className="text-[13px]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
        
        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/30" />
      </div>
    </TooltipProvider>
  )
})

LogEntryProfessional.displayName = 'LogEntryProfessional'