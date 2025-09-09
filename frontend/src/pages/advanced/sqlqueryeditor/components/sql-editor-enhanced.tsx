import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Play, Loader2, Sparkles, Code2, Command } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SqlEditorEnhancedProps {
  query: string
  onChange: (value: string) => void
  onExecute: () => void
  isLoading: boolean
  suggestions?: SuggestionItem[]
}

interface SuggestionItem {
  type: 'keyword' | 'table' | 'field' | 'function' | 'operator'
  value: string
  description?: string
  insertText?: string
  icon?: string
}

// SQL Keywords
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 
  'LIMIT', 'AS', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
  'ON', 'IN', 'NOT', 'NULL', 'IS', 'LIKE', 'BETWEEN', 'EXISTS',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'HAVING'
]

// Kubernetes resources (tables)
const RESOURCES = [
  'pods', 'deployments', 'services', 'nodes', 'namespaces',
  'configmaps', 'secrets', 'statefulsets', 'daemonsets', 
  'jobs', 'cronjobs', 'replicasets', 'events'
]

// Common fields
const COMMON_FIELDS = [
  'name', 'namespace', 'uid', 'creationTimestamp', 'labels', 
  'annotations', 'phase', 'status', 'spec', 'metadata',
  'metadata.name', 'metadata.namespace', 'metadata.labels',
  'status.phase', 'status.conditions', 'spec.replicas'
]

// Operators
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', '~=']

export function SqlEditorEnhanced({ 
  query, 
  onChange, 
  onExecute, 
  isLoading,
  suggestions = []
}: SqlEditorEnhancedProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [currentSuggestions, setCurrentSuggestions] = useState<SuggestionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query) {
      updateSuggestions()
    }
  }, [query, cursorPosition])

  const updateSuggestions = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const position = textarea.selectionStart
    const textBeforeCursor = query.substring(0, position)
    const words = textBeforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1].toUpperCase()
    const previousWord = words.length > 1 ? words[words.length - 2].toUpperCase() : ''

    let suggestions: SuggestionItem[] = []

    // Context-aware suggestions
    if (previousWord === 'FROM') {
      // Suggest tables
      suggestions = RESOURCES.filter(r => r.toUpperCase().startsWith(currentWord))
        .map(r => ({
          type: 'table' as const,
          value: r,
          description: `Query ${r} resources`,
          icon: '🗂️'
        }))
    } else if (previousWord === 'SELECT' || previousWord === 'WHERE' || previousWord === 'BY') {
      // Suggest fields
      suggestions = COMMON_FIELDS.filter(f => f.toUpperCase().startsWith(currentWord))
        .map(f => ({
          type: 'field' as const,
          value: f,
          description: `Field: ${f}`,
          icon: '📊'
        }))
    } else if (['WHERE', 'AND', 'OR'].includes(previousWord)) {
      // Suggest fields for conditions
      suggestions = COMMON_FIELDS.filter(f => f.toUpperCase().startsWith(currentWord))
        .map(f => ({
          type: 'field' as const,
          value: f,
          description: `Field: ${f}`,
          icon: '📊'
        }))
    } else if (COMMON_FIELDS.some(f => f.toUpperCase() === previousWord)) {
      // Suggest operators after a field name
      suggestions = OPERATORS.map(op => ({
        type: 'operator' as const,
        value: op,
        description: `Operator: ${op}`,
        icon: '⚡'
      }))
    } else {
      // General keyword suggestions
      suggestions = SQL_KEYWORDS.filter(k => k.startsWith(currentWord))
        .map(k => ({
          type: 'keyword' as const,
          value: k,
          description: `SQL Keyword`,
          icon: '🔤'
        }))
    }

    // Add custom suggestions if provided
    if (suggestions.length === 0 && currentWord.length > 0) {
      suggestions = [...suggestions, ...suggestions.filter(s => 
        s.value.toUpperCase().includes(currentWord)
      )]
    }

    setCurrentSuggestions(suggestions.slice(0, 10))
    setShowSuggestions(suggestions.length > 0 && currentWord.length > 0)
    setSelectedIndex(0)
  }

  const insertSuggestion = (suggestion: SuggestionItem) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const position = textarea.selectionStart
    const textBeforeCursor = query.substring(0, position)
    const textAfterCursor = query.substring(position)
    const words = textBeforeCursor.split(/\s+/)
    const lastWordStart = textBeforeCursor.lastIndexOf(words[words.length - 1])
    
    const newText = 
      query.substring(0, lastWordStart) + 
      (suggestion.insertText || suggestion.value) + 
      (suggestion.type === 'keyword' ? ' ' : '') +
      textAfterCursor

    onChange(newText)
    setShowSuggestions(false)
    
    // Set cursor position after inserted text
    setTimeout(() => {
      const newPosition = lastWordStart + (suggestion.insertText || suggestion.value).length + 
                          (suggestion.type === 'keyword' ? 1 : 0)
      textarea.selectionStart = newPosition
      textarea.selectionEnd = newPosition
      textarea.focus()
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onExecute()
      return
    }

    if (showSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < currentSuggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : currentSuggestions.length - 1
          )
          break
        case 'Enter':
        case 'Tab':
          if (currentSuggestions[selectedIndex]) {
            e.preventDefault()
            insertSuggestion(currentSuggestions[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowSuggestions(false)
          break
      }
    } else if (e.key === ' ' && e.ctrlKey) {
      // Trigger suggestions with Ctrl+Space
      e.preventDefault()
      updateSuggestions()
      setShowSuggestions(true)
    }
  }

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'keyword': return 'text-blue-600 dark:text-blue-400'
      case 'table': return 'text-green-600 dark:text-green-400'
      case 'field': return 'text-purple-600 dark:text-purple-400'
      case 'function': return 'text-orange-600 dark:text-orange-400'
      case 'operator': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => {
                onChange(e.target.value)
                setCursorPosition(e.target.selectionStart)
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onClick={(e) => setCursorPosition(e.currentTarget.selectionStart)}
              placeholder="SELECT name, namespace, phase FROM pods WHERE phase = 'Running' LIMIT 10"
              className={cn(
                "min-h-[120px] font-mono text-sm resize-none transition-all duration-200",
                "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                "focus:shadow-lg focus:ring-2 focus:ring-blue-500/20",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              disabled={isLoading}
              spellCheck={false}
              autoComplete="off"
            />
            
            {/* Auto-complete suggestions */}
            {showSuggestions && currentSuggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
              >
                {currentSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.type}-${suggestion.value}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors",
                      index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onMouseDown={() => insertSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="shrink-0">{suggestion.icon}</span>
                    <span className={cn("font-mono", getSuggestionColor(suggestion.type))}>
                      {suggestion.value}
                    </span>
                    {suggestion.description && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {suggestion.description}
                      </span>
                    )}
                  </div>
                ))}
                <div className="px-2 py-1 mt-1 border-t text-xs text-muted-foreground">
                  <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd> or{' '}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to accept •{' '}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> to close
                </div>
              </div>
            )}

            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs animate-in fade-in-0 zoom-in-95 duration-300 cursor-help">
                    <Command className="h-3 w-3 mr-1" />
                    Ctrl + Space
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Trigger auto-complete</TooltipContent>
              </Tooltip>
              <Badge variant="secondary" className="text-xs animate-in fade-in-0 zoom-in-95 duration-300">
                <Code2 className="h-3 w-3 mr-1" />
                SQL
              </Badge>
              <Badge variant="outline" className="text-xs animate-in fade-in-0 zoom-in-95 duration-500">
                Ctrl/Cmd + Enter
              </Badge>
            </div>
          </div>
        </div>
      
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground animate-pulse" />
            <div className="text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-left-2 duration-500">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help hover:text-foreground transition-colors">
                    IntelliSense enabled • Auto-complete with Ctrl+Space
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-semibold mb-2">Auto-complete Features:</p>
                  <ul className="text-xs space-y-1">
                    <li>• Context-aware suggestions</li>
                    <li>• SQL keywords and operators</li>
                    <li>• Kubernetes resources and fields</li>
                    <li>• Navigate with arrow keys</li>
                    <li>• Accept with Tab or Enter</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Button
            onClick={onExecute}
            disabled={!query.trim() || isLoading}
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              "hover:shadow-lg hover:scale-105",
              isLoading && "animate-pulse"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">Executing...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
                Execute Query
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}