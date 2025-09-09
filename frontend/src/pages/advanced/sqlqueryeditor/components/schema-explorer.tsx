import { useState, useEffect } from 'react'
import { ChevronRight, Database, Table, Columns, Info, Code, Search, Copy, Check, RefreshCw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FieldInfo {
  name: string
  type: string
  description: string
  path: string
}

interface SchemaResource {
  name: string
  fields: FieldInfo[]
  fieldSamples?: Record<string, any>
  sampleQuery?: string
}

interface SchemaExplorerProps {
  context: string
  onFieldClick?: (resource: string, field: string) => void
  onQueryExample?: (query: string) => void
}

export function SchemaExplorer({ context, onFieldClick, onQueryExample }: SchemaExplorerProps) {
  const [resources, setResources] = useState<SchemaResource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedResources, setExpandedResources] = useState<string[]>(['pods'])
  const [dynamicMode, setDynamicMode] = useState(false)

  // Fetch schema data
  useEffect(() => {
    fetchSchema()
  }, [context, dynamicMode])

  const fetchSchema = async () => {
    setLoading(true)
    try {
      // First get static schema
      const response = await fetch(`http://localhost:8080/api/v1/sql/schema`)
      const data = await response.json()
      
      const resourceList: SchemaResource[] = []
      
      // If dynamic mode, fetch dynamic schema for each resource
      if (dynamicMode && context) {
        for (const resourceName of Object.keys(data.supported_resources)) {
          try {
            const dynamicResponse = await fetch(
              `http://localhost:8080/api/v1/sql/schema?dynamic=true&context=${context}&resource=${resourceName}`
            )
            if (dynamicResponse.ok) {
              const dynamicData = await dynamicResponse.json()
              resourceList.push({
                name: resourceName,
                fields: dynamicData.fields || [],
                fieldSamples: dynamicData.field_samples,
                sampleQuery: data.supported_resources[resourceName].sample_query
              })
            }
          } catch (err) {
            // Fallback to static if dynamic fails
            const resource = data.supported_resources[resourceName]
            resourceList.push({
              name: resourceName,
              fields: resource.fields.map((f: string) => ({
                name: f,
                type: 'unknown',
                description: '',
                path: f
              })),
              sampleQuery: resource.sample_query
            })
          }
        }
      } else {
        // Use static schema
        for (const [resourceName, resource] of Object.entries(data.supported_resources)) {
          const res = resource as any
          resourceList.push({
            name: resourceName,
            fields: res.fields.map((f: string) => ({
              name: f,
              type: 'unknown',
              description: '',
              path: f
            })),
            sampleQuery: res.sample_query
          })
        }
      }
      
      setResources(resourceList)
    } catch (error) {
      console.error('Failed to fetch schema:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-green-600 dark:text-green-400'
      case 'number': return 'text-blue-600 dark:text-blue-400'
      case 'boolean': return 'text-purple-600 dark:text-purple-400'
      case 'object': return 'text-orange-600 dark:text-orange-400'
      case 'array': return 'text-yellow-600 dark:text-yellow-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return '"abc"'
      case 'number': return '123'
      case 'boolean': return '✓/✗'
      case 'object': return '{}'
      case 'array': return '[]'
      default: return '?'
    }
  }

  const filteredResources = resources.filter(resource => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return resource.name.toLowerCase().includes(term) ||
           resource.fields.some(f => 
             f.name.toLowerCase().includes(term) ||
             f.description.toLowerCase().includes(term)
           )
  })

  const formatSampleValue = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} items]`
      }
      return '{...}'
    }
    const str = String(value)
    return str.length > 50 ? str.substring(0, 50) + '...' : str
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Schema Explorer</h3>
              <Badge variant="secondary" className="text-xs">
                {resources.length} tables
              </Badge>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={fetchSchema}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables and fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Dynamic Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={dynamicMode ? "default" : "outline"}
              size="sm"
              onClick={() => setDynamicMode(!dynamicMode)}
              className="text-xs"
            >
              {dynamicMode ? "Dynamic Discovery" : "Static Schema"}
            </Button>
            {dynamicMode && (
              <Badge variant="secondary" className="text-xs">
                Live from cluster
              </Badge>
            )}
          </div>
        </div>

        {/* Resources List */}
        <ScrollArea className="flex-1">
          <Accordion 
            type="multiple" 
            value={expandedResources}
            onValueChange={setExpandedResources}
            className="px-4 pb-4"
          >
            {filteredResources.map((resource) => (
              <AccordionItem key={resource.name} value={resource.name} className="border-b">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Table className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{resource.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto mr-2">
                      {resource.fields.length} fields
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {/* Sample Query */}
                    {resource.sampleQuery && (
                      <div className="mb-3 p-2 bg-muted/50 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Sample Query</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              copyToClipboard(resource.sampleQuery!, `query-${resource.name}`)
                              onQueryExample?.(resource.sampleQuery!)
                            }}
                          >
                            {copiedField === `query-${resource.name}` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <code className="text-xs font-mono text-foreground/80 break-all">
                          {resource.sampleQuery}
                        </code>
                      </div>
                    )}

                    {/* Fields List */}
                    <div className="space-y-1">
                      {resource.fields.map((field) => (
                        <div
                          key={`${resource.name}-${field.name}`}
                          className={cn(
                            "group px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
                            "flex items-start gap-2"
                          )}
                          onClick={() => onFieldClick?.(resource.name, field.name)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Columns className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="font-mono text-sm">{field.name}</span>
                              <span className={cn("text-xs font-mono", getTypeColor(field.type))}>
                                {getTypeIcon(field.type)}
                              </span>
                              {field.type !== 'unknown' && (
                                <Badge variant="outline" className="text-xs py-0 h-5">
                                  {field.type}
                                </Badge>
                              )}
                            </div>
                            
                            {field.description && (
                              <p className="text-xs text-muted-foreground mt-1 ml-5">
                                {field.description}
                              </p>
                            )}

                            {/* Field Sample Value */}
                            {dynamicMode && resource.fieldSamples?.[field.name] !== undefined && (
                              <div className="mt-1 ml-5">
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {formatSampleValue(resource.fieldSamples[field.name])}
                                </code>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyToClipboard(field.name, `${resource.name}-${field.name}`)
                                  }}
                                >
                                  {copiedField === `${resource.name}-${field.name}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy field name</TooltipContent>
                            </Tooltip>
                            
                            {field.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {field.description}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {filteredResources.length} / {resources.length} resources
            </span>
            <div className="flex items-center gap-2">
              <Code className="h-3 w-3" />
              <span>SQL syntax supported</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}