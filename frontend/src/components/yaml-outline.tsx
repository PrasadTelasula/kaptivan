import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronRight, ChevronDown, Hash, List, FileText } from 'lucide-react'
import { cn } from '@/utils/cn'

interface OutlineItem {
  key: string
  level: number
  line: number
  type: 'object' | 'array' | 'value'
  hasChildren: boolean
}

interface YamlOutlineProps {
  content: string
  onNavigate: (line: number) => void
  className?: string
}

export function YamlOutline({ content, onNavigate, className }: YamlOutlineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeItem, setActiveItem] = useState<string | null>(null)

  const outlineItems = useMemo(() => {
    const items: OutlineItem[] = []
    const lines = content.split('\n')
    const stack: string[] = []
    
    lines.forEach((line, index) => {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) return
      
      // Calculate indentation level
      const indent = line.search(/\S/)
      if (indent === -1) return
      
      const level = Math.floor(indent / 2)
      
      // Extract key from line
      const keyMatch = line.match(/^(\s*)([^:]+):(.*)$/)
      if (!keyMatch) return
      
      const key = keyMatch[2].trim()
      const value = keyMatch[3].trim()
      
      // Update stack based on indentation
      while (stack.length > level) {
        stack.pop()
      }
      
      const fullKey = [...stack, key].join('.')
      // Make key unique by including line number to prevent duplicates
      const uniqueKey = `${fullKey}-line${index + 1}`
      stack.push(key)
      
      // Determine type
      let type: OutlineItem['type'] = 'value'
      let hasChildren = false
      
      if (!value || value === '|' || value === '>') {
        // Check next line for children
        const nextLine = lines[index + 1]
        if (nextLine && nextLine.search(/\S/) > indent) {
          type = 'object'
          hasChildren = true
        }
      } else if (value.startsWith('[')) {
        type = 'array'
      } else if (value.startsWith('-')) {
        type = 'array'
        hasChildren = true
      }
      
      items.push({
        key: uniqueKey,
        level,
        line: index + 1,
        type,
        hasChildren
      })
    })
    
    return items
  }, [content])

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleNavigate = (item: OutlineItem) => {
    setActiveItem(item.key)
    onNavigate(item.line)
  }

  const getIcon = (type: OutlineItem['type']) => {
    switch (type) {
      case 'object':
        return Hash
      case 'array':
        return List
      default:
        return FileText
    }
  }

  // Auto-expand first level items
  useEffect(() => {
    const firstLevel = new Set(
      outlineItems
        .filter(item => item.level === 0 && item.hasChildren)
        .map(item => item.key)
    )
    setExpanded(firstLevel)
  }, [outlineItems])

  const renderItem = (item: OutlineItem) => {
    const isExpanded = expanded.has(item.key)
    const isActive = activeItem === item.key
    const Icon = getIcon(item.type)
    const pathWithoutLine = item.key.replace(/-line\d+$/, '')
    const displayKey = pathWithoutLine.split('.').pop() || pathWithoutLine
    
    // Find children by extracting the path part before the line number
    const itemPath = item.key.replace(/-line\d+$/, '')
    const children = outlineItems.filter(
      child => {
        const childPath = child.key.replace(/-line\d+$/, '')
        return childPath.startsWith(itemPath + '.') && 
          child.level === item.level + 1
      }
    )
    
    return (
      <div key={item.key}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start h-7 px-2 text-xs hover:bg-accent",
            isActive && "bg-accent",
            `pl-${2 + item.level * 4}`
          )}
          onClick={() => handleNavigate(item)}
        >
          {item.hasChildren && (
            <span
              className="mr-1"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(item.key)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {!item.hasChildren && <span className="w-4" />}
          <Icon className="h-3 w-3 mr-2" />
          <span className="truncate">{displayKey}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            L{item.line}
          </span>
        </Button>
        {isExpanded && children.map(child => renderItem(child))}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground">OUTLINE</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {outlineItems.length > 0 ? (
            outlineItems
              .filter(item => item.level === 0)
              .map(item => renderItem(item))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              No outline available
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}