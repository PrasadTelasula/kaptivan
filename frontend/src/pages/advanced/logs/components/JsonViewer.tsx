import React, { useState, memo, useMemo } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface JsonViewerProps {
  data: any
  searchTerm?: string
  defaultExpanded?: boolean
  forceExpanded?: boolean
  maxDepth?: number
  className?: string
}

const highlightText = (text: string, searchTerm?: string) => {
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

const JsonValue = memo(({ 
  value, 
  searchTerm,
  isLast = false 
}: { 
  value: any
  searchTerm?: string
  isLast?: boolean 
}) => {
  const formattedValue = useMemo(() => {
    if (value === null) return <span className="text-gray-500">null</span>
    if (value === undefined) return <span className="text-gray-500">undefined</span>
    if (typeof value === 'boolean') {
      return <span className="text-blue-600 dark:text-blue-400">{value.toString()}</span>
    }
    if (typeof value === 'number') {
      return <span className="text-green-600 dark:text-green-400">{value}</span>
    }
    if (typeof value === 'string') {
      return (
        <span className="text-orange-600 dark:text-orange-400">
          "{highlightText(value, searchTerm)}"
        </span>
      )
    }
    return null
  }, [value, searchTerm])

  return (
    <>
      {formattedValue}
      {!isLast && <span className="text-gray-500">,</span>}
    </>
  )
})

JsonValue.displayName = 'JsonValue'

const JsonNode = memo(({ 
  keyName,
  value,
  depth = 0,
  searchTerm,
  defaultExpanded = false,
  forceExpanded = false,
  maxDepth = 5,
  isLast = false,
  path = ''
}: {
  keyName?: string
  value: any
  depth?: number
  searchTerm?: string
  defaultExpanded?: boolean
  forceExpanded?: boolean
  maxDepth?: number
  isLast?: boolean
  path?: string
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (forceExpanded) return true
    if (defaultExpanded && depth < 2) return true
    if (depth >= maxDepth) return false
    // Auto-expand if search term is found in this node
    if (searchTerm && JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase())) {
      return true
    }
    return false
  })
  
  // Update expansion state when forceExpanded changes
  React.useEffect(() => {
    if (forceExpanded !== undefined) {
      setIsExpanded(forceExpanded)
    }
  }, [forceExpanded])

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isPrimitive = !isObject && !isArray

  const toggleExpanded = () => setIsExpanded(!isExpanded)

  const indent = depth * 20

  if (isPrimitive) {
    return (
      <div style={{ marginLeft: `${indent}px` }} className="font-mono text-xs">
        {keyName && (
          <>
            <span className="text-purple-600 dark:text-purple-400">
              {highlightText(keyName, searchTerm)}
            </span>
            <span className="text-gray-500">: </span>
          </>
        )}
        <JsonValue value={value} searchTerm={searchTerm} isLast={isLast} />
      </div>
    )
  }

  const entries = isObject ? Object.entries(value) : value.map((v: any, i: number) => [i, v])
  const isEmpty = entries.length === 0

  return (
    <div style={{ marginLeft: depth > 0 ? `${indent}px` : 0 }} className="font-mono text-xs">
      <div className="flex items-start">
        {!isEmpty && (
          <button
            onClick={toggleExpanded}
            className="mr-1 p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {keyName && (
          <>
            <span className="text-purple-600 dark:text-purple-400">
              {highlightText(keyName, searchTerm)}
            </span>
            <span className="text-gray-500">: </span>
          </>
        )}
        <span className="text-gray-500">
          {isArray ? '[' : '{'}
        </span>
        {!isExpanded && !isEmpty && (
          <span className="text-gray-400 ml-1 text-[10px]">
            {isArray ? `${entries.length} items` : `${entries.length} keys`}
          </span>
        )}
        {!isExpanded && (
          <span className="text-gray-500">
            {isArray ? ']' : '}'}
            {!isLast && ','}
          </span>
        )}
      </div>
      
      {isExpanded && (
        <>
          {entries.map(([key, val], index) => (
            <JsonNode
              key={`${path}-${key}`}
              keyName={isArray ? undefined : String(key)}
              value={val}
              depth={depth + 1}
              searchTerm={searchTerm}
              defaultExpanded={defaultExpanded}
              forceExpanded={forceExpanded}
              maxDepth={maxDepth}
              isLast={index === entries.length - 1}
              path={`${path}-${key}`}
            />
          ))}
          <div style={{ marginLeft: `${indent}px` }} className="text-gray-500">
            {isArray ? ']' : '}'}
            {!isLast && ','}
          </div>
        </>
      )}
    </div>
  )
})

JsonNode.displayName = 'JsonNode'

export const JsonViewer = memo(({
  data,
  searchTerm,
  defaultExpanded = false,
  forceExpanded = false,
  maxDepth = 5,
  className
}: JsonViewerProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const parsedData = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }, [data])

  return (
    <div className={cn("relative group", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
      
      <div className="p-2 bg-muted/30 rounded overflow-x-auto">
        <JsonNode
          value={parsedData}
          searchTerm={searchTerm}
          defaultExpanded={defaultExpanded}
          forceExpanded={forceExpanded}
          maxDepth={maxDepth}
          isLast
        />
      </div>
    </div>
  )
})

JsonViewer.displayName = 'JsonViewer'