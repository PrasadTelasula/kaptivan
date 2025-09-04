import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Copy, 
  Check, 
  FileJson, 
  Code2, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Maximize2,
  Minimize2,
  Download,
  MoreVertical,
  X,
  FileText,
  Sparkles
} from 'lucide-react'
import { JsonViewer } from './JsonViewer'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical } from 'lucide-react'

interface JsonDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: any
  title?: string
  description?: string
}

export const JsonDrawer: React.FC<JsonDrawerProps> = ({
  open,
  onOpenChange,
  data,
  title = 'JSON Data',
  description = 'View raw or formatted JSON data'
}) => {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted')
  const [backgroundPosition, setBackgroundPosition] = useState({ left: 0, width: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpandedAll, setIsExpandedAll] = useState(false)
  const [jsonPath, setJsonPath] = useState<string[]>([])
  const [drawerWidth, setDrawerWidth] = useState(800)
  const [isResizing, setIsResizing] = useState(false)
  const minWidth = 400
  const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1200
  
  const formattedRef = useRef<HTMLButtonElement>(null)
  const rawRef = useRef<HTMLButtonElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const rawJson = JSON.stringify(data, null, 2)
  
  // Calculate JSON stats
  const jsonStats = useMemo(() => {
    const countKeys = (obj: any): number => {
      if (typeof obj !== 'object' || obj === null) return 0
      let count = Array.isArray(obj) ? 0 : Object.keys(obj).length
      Object.values(obj).forEach(value => {
        count += countKeys(value)
      })
      return count
    }
    
    const getDepth = (obj: any, level = 0): number => {
      if (typeof obj !== 'object' || obj === null) return level
      const depths = Object.values(obj).map(value => getDepth(value, level + 1))
      return Math.max(level, ...depths)
    }
    
    return {
      size: new Blob([rawJson]).size,
      lines: rawJson.split('\n').length,
      keys: countKeys(data),
      depth: getDepth(data)
    }
  }, [data, rawJson])
  
  // Update background position when tab changes
  useEffect(() => {
    const activeRef = activeTab === 'formatted' ? formattedRef : rawRef
    if (activeRef.current) {
      const { offsetLeft, offsetWidth } = activeRef.current
      setBackgroundPosition({ left: offsetLeft, width: offsetWidth })
    }
  }, [activeTab])
  
  // Initialize background position
  useEffect(() => {
    if (open && formattedRef.current) {
      const { offsetLeft, offsetWidth } = formattedRef.current
      setBackgroundPosition({ left: offsetLeft, width: offsetWidth })
    }
  }, [open])
  
  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setJsonPath([])
      setIsExpandedAll(false)
    }
  }, [open])
  
  // Ensure wheel events work properly on the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const handleWheel = (e: WheelEvent) => {
      // Prevent event from bubbling to parent elements
      e.stopPropagation()
      
      // Only prevent default if we're at the scroll boundaries
      const { scrollTop, scrollHeight, clientHeight } = container
      const isAtTop = scrollTop === 0
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1
      
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault()
      }
    }
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [open, activeTab])
  
  const handleCopy = (content?: string) => {
    navigator.clipboard.writeText(content || rawJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  
  // Count search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery) return 0
    return (rawJson.match(new RegExp(searchQuery, 'gi')) || []).length
  }, [rawJson, searchQuery])
  
  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const startX = e.clientX
    const startWidth = drawerWidth
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff))
      setDrawerWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  
  if (!open) return null
  
  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right duration-300"
        style={{ width: `${drawerWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center",
            isResizing && "bg-primary/30"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="h-12 w-4 flex items-center justify-center rounded-sm hover:bg-muted">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 bg-background border-l shadow-lg flex flex-col overflow-hidden">
          <div className="space-y-3 p-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy()}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy JSON</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download JSON</TooltipContent>
                </Tooltip>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopy(rawJson)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Copy Formatted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopy(JSON.stringify(data))}>
                      <Code2 className="mr-2 h-4 w-4" />
                      Copy Minified
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" />
                      Download as File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-2"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* JSON Stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
              <FileText className="h-3 w-3" />
              {formatSize(jsonStats.size)}
            </Badge>
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {jsonStats.lines} lines
            </Badge>
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {jsonStats.keys} keys
            </Badge>
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              Depth: {jsonStats.depth}
            </Badge>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search JSON..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-20 h-10"
            />
            {searchQuery && (
              <>
                <Badge 
                  variant="outline" 
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-xs"
                >
                  {searchMatches} matches
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          </div>
          
          <Separator className="shrink-0" />
          
          <div className="flex-1 px-6 pb-6 pt-4 flex flex-col gap-3 min-h-0">
          {/* Custom Segmented Control with Animated Background */}
          <div className="relative flex w-full rounded-lg bg-muted p-1 shadow-inner border flex-shrink-0">
            {/* Animated Background */}
            <motion.div
              className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm border"
              initial={false}
              animate={{
                left: backgroundPosition.left,
                width: backgroundPosition.width
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30
              }}
            />
            
            {/* Tab Buttons */}
            <button
              ref={formattedRef}
              onClick={() => setActiveTab('formatted')}
              className={cn(
                "relative z-10 flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === 'formatted'
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              <Sparkles className="h-4 w-4" />
              Formatted
            </button>
            
            <button
              ref={rawRef}
              onClick={() => setActiveTab('raw')}
              className={cn(
                "relative z-10 flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === 'raw'
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              <Code2 className="h-4 w-4" />
              Raw
            </button>
          </div>
          
          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-h-0 flex flex-col"
            >
              {activeTab === 'formatted' ? (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExpandedAll(!isExpandedAll)}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      {isExpandedAll ? (
                        <>
                          <Minimize2 className="h-3.5 w-3.5" />
                          Collapse All
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-3.5 w-3.5" />
                          Expand All
                        </>
                      )}
                    </Button>
                    
                    {/* Breadcrumb Path */}
                    {jsonPath.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
                        <span className="shrink-0">Path:</span>
                        {jsonPath.map((path, index) => (
                          <React.Fragment key={index}>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <Badge variant="outline" className="h-5 px-1.5 text-xs shrink-0">
                              {path}
                            </Badge>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div 
                    ref={activeTab === 'formatted' ? scrollContainerRef : null}
                    className="flex-1 min-h-0 border rounded-lg shadow-inner bg-gradient-to-b from-muted/20 to-muted/10 overflow-y-auto"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    <div className="p-4">
                      <JsonViewer
                        data={data}
                        searchTerm={searchQuery}
                        defaultExpanded={isExpandedAll}
                        forceExpanded={isExpandedAll}
                        maxDepth={10}
                        className=""
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  ref={activeTab === 'raw' ? scrollContainerRef : null}
                  className="flex-1 min-h-0 border rounded-lg shadow-inner bg-gradient-to-b from-muted/20 to-muted/10 overflow-y-auto"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="p-4">
                    <pre className={cn(
                      "font-mono text-xs",
                      "whitespace-pre-wrap break-all",
                      "text-foreground/90"
                    )}>
                      {searchQuery ? (
                        rawJson.split('\n').map((line, index) => {
                          const regex = new RegExp(`(${searchQuery})`, 'gi')
                          const parts = line.split(regex)
                          
                          return (
                            <div key={index} className="hover:bg-muted/30 -mx-1 px-1 rounded transition-colors">
                              {parts.map((part, i) => (
                                <span
                                  key={i}
                                  className={
                                    regex.test(part) 
                                      ? "bg-yellow-500/30 text-yellow-600 dark:text-yellow-400 font-semibold px-0.5 rounded" 
                                      : ""
                                  }
                                >
                                  {part}
                                </span>
                              ))}
                            </div>
                          )
                        })
                      ) : (
                        rawJson
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}