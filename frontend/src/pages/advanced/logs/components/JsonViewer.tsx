import React, { useState, memo, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface JsonViewerProps {
  data: any
  searchTerm?: string
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
  isLast = false,
  depth = 0,
  maxDepth = 5
}: { 
  value: any
  searchTerm?: string
  isLast?: boolean
  depth?: number
  maxDepth?: number
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
      // Check if the string contains nested JSON and we haven't exceeded max depth
      if (depth < maxDepth && value.length > 10) { // Only check strings longer than 10 chars
        const trimmedValue = value.trim()
        if ((trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) || 
            (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))) {
          try {
            const parsedNestedJson = JSON.parse(value)
            // Only render as nested JSON if it's actually an object or array (not primitive)
            if (typeof parsedNestedJson === 'object' && parsedNestedJson !== null) {
              return (
                <div className="mt-1">
                  <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                    <span>Nested JSON</span>
                  </div>
                  <div className="ml-1 pl-2 py-1 bg-muted/8 rounded-sm border-l-2 border-blue-300 dark:border-blue-700">
                    <JsonNode
                      value={parsedNestedJson}
                      depth={0}
                      searchTerm={searchTerm}
                      maxDepth={maxDepth}
                      isLast={true}
                      path=""
                    />
                  </div>
                </div>
              )
            }
          } catch {
            // If parsing fails, treat as regular string
          }
        }
      }
      
      // Regular string rendering
      return (
        <span className="text-orange-600 dark:text-orange-400">
          "{highlightText(value, searchTerm)}"
        </span>
      )
    }
    return null
  }, [value, searchTerm, depth, maxDepth])

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
  maxDepth = 5,
  isLast = false,
  path = ''
}: {
  keyName?: string
  value: any
  depth?: number
  searchTerm?: string
  maxDepth?: number
  isLast?: boolean
  path?: string
}) => {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isPrimitive = !isObject && !isArray

  const indent = depth * 16 // Reduced from 20px to 16px for more compact nesting

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
        <JsonValue 
          value={value} 
          searchTerm={searchTerm} 
          isLast={isLast}
          depth={depth}
          maxDepth={maxDepth}
        />
      </div>
    )
  }

  const entries = isObject ? Object.entries(value) : value.map((v: any, i: number) => [i, v])
  const isEmpty = entries.length === 0

  return (
    <div style={{ marginLeft: depth > 0 ? `${indent}px` : 0 }} className="font-mono text-xs">
      <div className="flex items-start">
        {/* Removed collapse/expand button - always show content */}
        {keyName && (
          <>
            <span className="text-purple-600 dark:text-purple-400">
              {highlightText(keyName, searchTerm)}
            </span>
            <span className="text-gray-500">: </span>
          </>
        )}
        <span className="text-gray-500">{isArray ? '[' : '{'}</span>
        {isEmpty && <span className="text-gray-500">{isArray ? ']' : '}'}{!isLast && ','}</span>}
      </div>
      
      {!isEmpty && (
        <>
          {entries.map(([key, val], index) => (
            <div key={`${path}-${key}`} className={isArray && index > 0 ? "mt-1" : ""}>
              <JsonNode
                keyName={isArray ? undefined : String(key)}
                value={val}
                depth={depth + 1}
                searchTerm={searchTerm}
                maxDepth={maxDepth}
                isLast={index === entries.length - 1}
                path={`${path}-${key}`}
              />
            </div>
          ))}
          <span style={{ marginLeft: `${indent}px` }} className="text-gray-500">
            {isArray ? ']' : '}'}{!isLast && ','}
          </span>
        </>
      )}
    </div>
  )
})

JsonNode.displayName = 'JsonNode'

export const JsonViewer = memo(({
  data,
  searchTerm,
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
          maxDepth={maxDepth}
          isLast
        />
      </div>
    </div>
  )
})

JsonViewer.displayName = 'JsonViewer'