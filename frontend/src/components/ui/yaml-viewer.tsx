import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface YamlViewerProps {
  content: string
  className?: string
  height?: string
}

export function YamlViewer({ content, className, height = "420px" }: YamlViewerProps) {
  const lines = content.split('\n')
  
  const highlightYamlLine = (line: string) => {
    // Handle empty lines
    if (!line.trim()) return <span>&nbsp;</span>
    
    // Check for comments
    if (line.trim().startsWith('#')) {
      return <span style={{ color: '#6b7280' }}>{line}</span>
    }
    
    // Parse key-value pairs
    const keyValueMatch = line.match(/^(\s*)([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (keyValueMatch) {
      const [, indent, key, value] = keyValueMatch
      
      // Handle different value types
      let valueElement
      if (!value || value === '|' || value === '>') {
        // No value or multiline indicator
        valueElement = <span style={{ color: '#9ca3af' }}>:</span>
      } else if (value.startsWith('"') || value.startsWith("'")) {
        // String value - bright green like in manifest viewer
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#34d399' }}>{value}</span>
          </>
        )
      } else if (/^\d+$/.test(value)) {
        // Number value - amber/orange like in manifest viewer
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#fbbf24' }}>{value}</span>
          </>
        )
      } else if (value === 'true' || value === 'false' || value === 'null') {
        // Boolean or null - orange
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#fb923c' }}>{value}</span>
          </>
        )
      } else if (value.match(/^[A-Z]/) || value === 'Active' || value === 'Deployment' || value === 'Namespace') {
        // Type values (like Active, Deployment) - orange
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#fb923c' }}>{value}</span>
          </>
        )
      } else if (value.includes('/')) {
        // Path-like values - orange
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#fb923c' }}>{value}</span>
          </>
        )
      } else {
        // Other values (unquoted strings) - bright green
        valueElement = (
          <>
            <span style={{ color: '#9ca3af' }}>: </span>
            <span style={{ color: '#34d399' }}>{value}</span>
          </>
        )
      }
      
      return (
        <>
          <span>{indent}</span>
          <span style={{ color: '#06b6d4' }}>{key}</span>
          {valueElement}
        </>
      )
    }
    
    // Handle list items
    if (line.trim().startsWith('-')) {
      const listMatch = line.match(/^(\s*)-\s*(.*)$/)
      if (listMatch) {
        const [, indent, value] = listMatch
        
        // Check if the value is a key-value pair
        const nestedKeyValueMatch = value.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
        if (nestedKeyValueMatch) {
          const [, nestedKey, nestedValue] = nestedKeyValueMatch
          
          // Determine value color
          let valueStyle = { color: '#34d399' }
          if (/^\d+$/.test(nestedValue) || /^\d+%$/.test(nestedValue)) {
            valueStyle = { color: '#fbbf24' }
          } else if (nestedValue === 'true' || nestedValue === 'false' || nestedValue === 'null') {
            valueStyle = { color: '#fb923c' }
          } else if (nestedValue.match(/^[A-Z]/)) {
            valueStyle = { color: '#fb923c' }
          }
          
          return (
            <>
              <span>{indent}</span>
              <span style={{ color: '#9ca3af' }}>- </span>
              <span style={{ color: '#06b6d4' }}>{nestedKey}</span>
              <span style={{ color: '#9ca3af' }}>: </span>
              <span style={valueStyle}>{nestedValue}</span>
            </>
          )
        }
        
        // Regular list item - green
        return (
          <>
            <span>{indent}</span>
            <span style={{ color: '#9ca3af' }}>- </span>
            <span style={{ color: '#34d399' }}>{value}</span>
          </>
        )
      }
    }
    
    // Handle long annotation values that wrap to next line
    if (line.match(/^\s+\{/)) {
      return <span style={{ color: '#34d399' }}>{line}</span>
    }
    
    // Handle special cases like "apiVersion: apps/v1"
    if (line.includes(':') && !line.match(/^(\s*)([a-zA-Z0-9_.-]+):\s*(.*)$/)) {
      const colonIndex = line.indexOf(':')
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      
      let valueColor = '#34d399'
      if (value.includes('/')) {
        valueColor = '#fb923c'
      }
      
      return (
        <>
          <span style={{ color: '#06b6d4' }}>{key}</span>
          <span style={{ color: '#9ca3af' }}>: </span>
          <span style={{ color: valueColor }}>{value}</span>
        </>
      )
    }
    
    // Default: return line as-is
    return <span style={{ color: '#e5e7eb' }}>{line}</span>
  }
  
  return (
    <div className={cn("bg-[#0a0a0a] rounded-md overflow-hidden", className)}>
      <ScrollArea className={`h-[${height}]`}>
        <div className="flex">
          {/* Line numbers column */}
          <div className="select-none px-3 py-4 text-right" style={{ minWidth: '50px' }}>
            {lines.map((_, index) => (
              <div 
                key={index} 
                className="text-xs font-mono leading-[1.5] h-[18px]"
                style={{ color: '#4b5563' }}
              >
                {index + 1}
              </div>
            ))}
          </div>
          
          {/* Content column */}
          <div className="flex-1 pr-6 py-4">
            <pre className="text-xs font-mono">
              {lines.map((line, index) => (
                <div key={index} className="leading-[1.5] h-[18px]">
                  <code>{highlightYamlLine(line)}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}