import React, { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { SqlEditor } from './components/sql-editor'
import { SqlEditorEnhanced } from './components/sql-editor-enhanced'
import { SchemaExplorer } from './components/schema-explorer'
import { QueryResults } from './components/query-results'
import { QueryExamples } from './components/query-examples'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, Play, History, Server, AlertCircle, Settings2, BookOpen, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export function SqlQueryEditorPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    data: any[];
    metadata?: {
      executionTime: number;
      rowCount: number;
      resourceType: string;
      queriedClusters: string[];
    };
    errors?: string[];
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([])
  const [useEnhancedEditor, setUseEnhancedEditor] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(540)
  const [currentSection, setCurrentSection] = useState<'schema' | 'examples' | 'history'>('schema')
  
  // Resize handler for unified drawer
  const handleDrawerResize = (clientX: number) => {
    const newWidth = window.innerWidth - clientX
    const minWidth = 300
    const maxWidth = Math.min(window.innerWidth * 0.8, 800)
    const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
    console.log('Drawer resize:', { clientX, newWidth, clampedWidth, maxWidth })
    setDrawerWidth(clampedWidth)
  }
  
  // Section navigation
  const sections = [
    { id: 'schema' as const, title: 'Schema Explorer', icon: Database },
    { id: 'examples' as const, title: 'Query Examples', icon: BookOpen },
    { id: 'history' as const, title: 'Query History', icon: History }
  ]
  
  const getCurrentSectionIndex = () => sections.findIndex(s => s.id === currentSection)
  
  const navigateToSection = (direction: 'prev' | 'next') => {
    const currentIndex = getCurrentSectionIndex()
    if (direction === 'prev' && currentIndex > 0) {
      setCurrentSection(sections[currentIndex - 1].id)
    } else if (direction === 'next' && currentIndex < sections.length - 1) {
      setCurrentSection(sections[currentIndex + 1].id)
    }
  }
  
  // Resize handle component
  const ResizeHandle = ({ onResize }: { onResize: (clientX: number) => void }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault()
        onResize(e.clientX)
      }
      
      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault()
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'default'
        document.body.style.userSelect = 'auto'
      }
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    
    return (
      <div
        className="absolute left-0 top-0 bottom-0 w-2 bg-transparent hover:bg-primary/10 cursor-col-resize transition-colors z-10"
        onMouseDown={handleMouseDown}
        style={{ marginLeft: '-1px' }}
      >
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-border hover:bg-primary transition-colors rounded-full" />
      </div>
    )
  }
  
  // Get current context from Zustand store
  const { currentContext, selectedContexts } = useClusterStore()
  
  // Use the first selected context or the current context
  const activeContext = selectedContexts.length > 0 ? selectedContexts[0] : currentContext


  const executeQuery = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    
    try {
      // Get the contexts to query
      const contextsToQuery = selectedContexts.length > 0 ? selectedContexts : (currentContext ? [currentContext] : [])
      
      if (contextsToQuery.length === 0) {
        setError('Please select at least one cluster first')
        return
      }
      
      // Remove cluster filter from query if present (we'll filter after combining results)
      let actualQuery = query
      let clusterFilter: string | null = null
      
      // Check if query contains cluster filter
      const clusterMatch = query.match(/WHERE\s+.*?cluster\s*=\s*['"]([^'"]+)['"]/i)
      if (clusterMatch) {
        clusterFilter = clusterMatch[1]
        // Remove cluster condition from query
        actualQuery = query.replace(/\s*(AND\s+)?cluster\s*=\s*['"][^'"]+['"]\s*(AND\s*)?/gi, (_match, before, after) => {
          if (before && after) return ' AND '
          if (before || after) return ' '
          return ''
        })
        // Clean up WHERE clause if it's empty
        actualQuery = actualQuery.replace(/WHERE\s+(ORDER|LIMIT|$)/i, '$1')
        actualQuery = actualQuery.replace(/WHERE\s+AND/i, 'WHERE')
      }
      
      // Query all selected clusters in parallel
      const queryPromises = contextsToQuery.map(async (context) => {
        // Skip this cluster if there's a filter and it doesn't match
        if (clusterFilter && context !== clusterFilter) {
          return { context, data: { data: [] }, error: null }
        }
        
        try {
          const response = await fetch(`http://localhost:8080/api/v1/sql/query?context=${context}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: actualQuery }),
          })

          if (!response.ok) {
            throw new Error(`Query failed for ${context}: ${response.statusText}`)
          }

          const data = await response.json()
          // Add cluster context to each row
          if (data.data && Array.isArray(data.data)) {
            data.data = data.data.map((row: any) => ({
              ...row,
              cluster: context
            }))
          }
          return { context, data, error: null }
        } catch (err) {
          return { 
            context, 
            data: null, 
            error: err instanceof Error ? err.message : 'Query failed' 
          }
        }
      })
      
      const results = await Promise.all(queryPromises)
      
      // Combine results from all clusters
      const combinedData: any[] = []
      const errors: string[] = []
      let totalExecutionTime = 0
      
      results.forEach(result => {
        if (result.data && result.data.data) {
          combinedData.push(...result.data.data)
          totalExecutionTime += result.data.metadata?.executionTime || 0
        }
        if (result.error) {
          errors.push(`${result.context}: ${result.error}`)
        }
      })
      
      if (errors.length > 0 && combinedData.length === 0) {
        setError(errors.join('\n'))
      } else {
        setResults({
          data: combinedData,
          metadata: {
            executionTime: totalExecutionTime,
            rowCount: combinedData.length,
            resourceType: '',
            queriedClusters: contextsToQuery
          },
          errors: errors.length > 0 ? errors : undefined
        })
        
        if (!queryHistory.includes(query)) {
          setQueryHistory(prev => [query, ...prev.slice(0, 9)])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <TooltipProvider>
      <div className="h-screen bg-background flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar className="hidden lg:block border-r" />
          <main className="flex-1 overflow-hidden min-w-0">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-6 w-full max-w-full">
                <div className="space-y-4 sm:space-y-6 w-full max-w-full">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">SQL Query Editor</h2>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {selectedContexts.length > 0 ? (
                            <Badge variant="outline" className="gap-1 transition-all hover:scale-105">
                              <Server className="h-3 w-3" />
                              {selectedContexts.length === 1 
                                ? selectedContexts[0]
                                : `${selectedContexts.length} clusters`}
                            </Badge>
                          ) : activeContext ? (
                            <Badge variant="outline" className="gap-1 transition-all hover:scale-105">
                              <Server className="h-3 w-3" />
                              {activeContext}
                            </Badge>
                          ) : null}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{selectedContexts.length > 0 
                            ? `Active clusters: ${selectedContexts.join(', ')}`
                            : `Current cluster: ${activeContext || 'None'}`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          {/* Unified Navigation Drawer */}
                          <div className="flex items-center gap-2 order-2 sm:order-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => {
                                setCurrentSection('schema')
                                setIsDrawerOpen(true)
                              }}
                            >
                              <Database className="h-4 w-4" />
                              Schema
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => {
                                setCurrentSection('examples')
                                setIsDrawerOpen(true)
                              }}
                            >
                              <BookOpen className="h-4 w-4" />
                              Examples
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => {
                                setCurrentSection('history')
                                setIsDrawerOpen(true)
                              }}
                            >
                              <History className="h-4 w-4" />
                              History
                            </Button>
                          </div>
                          
                          {/* Unified Drawer */}
                          <Sheet 
                            open={isDrawerOpen} 
                            onOpenChange={setIsDrawerOpen}
                            modal={false}
                          >
                            <SheetContent 
                              side="right" 
                              className="border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                              style={{ width: `${drawerWidth}px` }}
                              hideOverlay={true}
                              onInteractOutside={(e) => e.preventDefault()}
                              onEscapeKeyDown={(e) => e.preventDefault()}
                            >
                              {/* Navigation Controls - positioned like pods drawer */}
                              <div className="absolute top-6 -left-16">
                                <div className="flex flex-col items-center gap-2">
                                  <button
                                    onClick={() => navigateToSection('prev')}
                                    disabled={getCurrentSectionIndex() === 0}
                                    className="group relative bg-background/95 backdrop-blur border-2 border-primary/20 hover:border-primary/40 rounded-full p-2 shadow-sm hover:shadow-md hover:scale-105 hover:bg-primary/5 disabled:opacity-40 disabled:border-border/30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent transition-all duration-200"
                                    title="Previous section"
                                  >
                                    <ChevronUp className="h-4 w-4 text-foreground/70 group-hover:text-primary" />
                                  </button>
                                  
                                  {/* Section Counter */}
                                  <div className="bg-background/95 backdrop-blur border-2 border-accent/20 rounded-full px-2.5 py-1.5 shadow-sm min-w-[48px] text-center">
                                    <div className="text-xs font-medium text-foreground/80">
                                      {getCurrentSectionIndex() + 1}
                                      <span className="text-muted-foreground mx-0.5">/</span>
                                      {sections.length}
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => navigateToSection('next')}
                                    disabled={getCurrentSectionIndex() === sections.length - 1}
                                    className="group relative bg-background/95 backdrop-blur border-2 border-primary/20 hover:border-primary/40 rounded-full p-2 shadow-sm hover:shadow-md hover:scale-105 hover:bg-primary/5 disabled:opacity-40 disabled:border-border/30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent transition-all duration-200"
                                    title="Next section"
                                  >
                                    <ChevronDown className="h-4 w-4 text-foreground/70 group-hover:text-primary" />
                                  </button>
                                </div>
                              </div>
                              <ResizeHandle onResize={handleDrawerResize} />
                              <SheetHeader>
                                <div className="flex items-center gap-2">
                                  {React.createElement(sections[getCurrentSectionIndex()].icon, { className: "h-4 w-4" })}
                                  <SheetTitle>{sections[getCurrentSectionIndex()].title}</SheetTitle>
                                  <div className="ml-auto">
                                    <span className="text-xs text-muted-foreground px-3 py-1 bg-muted/50 rounded-full">
                                      {getCurrentSectionIndex() + 1} of {sections.length}
                                    </span>
                                  </div>
                                </div>
                                <SheetDescription>
                                  {currentSection === 'schema' && 'Explore available tables and fields in your Kubernetes clusters'}
                                  {currentSection === 'examples' && 'Ready-to-use SQL queries and example templates'}
                                  {currentSection === 'history' && 'Your recently executed queries and search history'}
                                </SheetDescription>
                              </SheetHeader>
                              
                              <div className="mt-6 h-[calc(100%-8rem)] overflow-hidden">
                                <div className="h-full transition-all duration-300 ease-in-out">
                                  {currentSection === 'schema' && (
                                    <div className="h-full animate-in fade-in-0 slide-in-from-right-2 duration-300">
                                      <SchemaExplorer 
                                        context={activeContext || ''}
                                        onFieldClick={(resource, field) => {
                                          // Smart field insertion logic
                                          const fieldText = `${field}`
                                          if (query) {
                                            // Check if we have a FROM clause
                                            if (query.toLowerCase().includes('from')) {
                                              // Insert into SELECT clause
                                              const selectIndex = query.toLowerCase().indexOf('select') + 6
                                              const fromIndex = query.toLowerCase().indexOf('from')
                                              const selectPart = query.substring(selectIndex, fromIndex).trim()
                                              if (selectPart === '*' || selectPart === '') {
                                                setQuery(`SELECT ${fieldText} FROM ${resource}`)
                                              } else {
                                                setQuery(query.substring(0, fromIndex - 1) + `, ${fieldText} ` + query.substring(fromIndex - 1))
                                              }
                                            } else {
                                              setQuery(query + ` FROM ${resource}`)
                                            }
                                          } else {
                                            setQuery(`SELECT ${fieldText} FROM ${resource}`)
                                          }
                                        }}
                                        onQueryExample={(exampleQuery) => {
                                          setQuery(exampleQuery)
                                        }}
                                      />
                                    </div>
                                  )}
                                  
                                  {currentSection === 'examples' && (
                                    <div className="h-full animate-in fade-in-0 slide-in-from-right-2 duration-300">
                                      <ScrollArea className="h-full">
                                        <QueryExamples onSelectExample={setQuery} />
                                      </ScrollArea>
                                    </div>
                                  )}
                                  
                                  {currentSection === 'history' && (
                                    <div className="h-full animate-in fade-in-0 slide-in-from-right-2 duration-300">
                                      <ScrollArea className="h-full">
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                                            <History className="h-3 w-3" />
                                            Query History
                                            {queryHistory.length > 0 && (
                                              <Badge variant="outline" className="ml-auto text-xs">
                                                {queryHistory.length}
                                              </Badge>
                                            )}
                                          </h4>
                                          {queryHistory.length === 0 ? (
                                            <div className="text-center py-8">
                                              <p className="text-sm text-muted-foreground">
                                                No queries executed yet
                                              </p>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {queryHistory.slice().reverse().map((historicalQuery, index) => (
                                                <button
                                                  key={index}
                                                  onClick={() => setQuery(historicalQuery)}
                                                  className="w-full text-left p-3 text-sm rounded border hover:bg-accent hover:text-accent-foreground transition-colors"
                                                >
                                                  <div className="font-mono text-xs opacity-50 mb-1">
                                                    #{queryHistory.length - index}
                                                  </div>
                                                  <div className="font-mono">
                                                    {historicalQuery.length > 60
                                                      ? `${historicalQuery.substring(0, 60)}...`
                                                      : historicalQuery}
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                          
                        
                        <div className="flex items-center gap-2 order-1 sm:order-2">
                          <Switch
                            id="enhanced-editor"
                            checked={useEnhancedEditor}
                            onCheckedChange={setUseEnhancedEditor}
                          />
                          <Label htmlFor="enhanced-editor" className="text-sm flex items-center gap-1">
                            <Settings2 className="h-4 w-4" />
                            <span className="hidden sm:inline">IntelliSense</span>
                            <span className="sm:hidden">AI</span>
                          </Label>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm sm:text-base">
                      <span className="hidden sm:inline">Query Kubernetes resources using SQL-like syntax with auto-complete and schema discovery</span>
                      <span className="sm:hidden">Query Kubernetes resources with SQL syntax</span>
                    </p>
                  </div>

                  {!activeContext && !selectedContexts.length && (
                    <Alert className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please select a cluster from the sidebar to start querying Kubernetes resources.
                      </AlertDescription>
                    </Alert>
                  )}

                   {/* Simple Layout with Non-Modal Drawer Support */}
                   <div className="space-y-6 animate-in fade-in-0 zoom-in-95 duration-500">
                     {/* Query Editor */}
                     <Card className="transition-all duration-200 hover:shadow-md">
                       <CardHeader className="pb-3 px-4 sm:px-6">
                         <CardTitle className="flex items-center gap-2">
                           <Database className="h-5 w-5 animate-pulse" />
                           Query Editor
                         </CardTitle>
                         <CardDescription>
                           {isLoading ? (
                             <Skeleton className="h-4 w-64" />
                           ) : (
                             selectedContexts.length > 0
                               ? `Querying ${selectedContexts.length} cluster${selectedContexts.length > 1 ? 's' : ''}: ${selectedContexts.join(', ')}`
                               : activeContext 
                                 ? useEnhancedEditor
                                   ? `IntelliSense enabled • Press Ctrl+Space for suggestions`
                                   : `Write SQL-like queries to retrieve resources from ${activeContext}`
                                 : 'Select a cluster to start querying'
                           )}
                         </CardDescription>
                       </CardHeader>
                       <CardContent className="pb-4 px-4 sm:px-6">
                         <div className="h-[300px] overflow-hidden">
                           {useEnhancedEditor ? (
                             <SqlEditorEnhanced
                               query={query}
                               onChange={setQuery}
                               onExecute={executeQuery}
                               isLoading={isLoading}
                             />
                           ) : (
                             <SqlEditor
                               query={query}
                               onChange={setQuery}
                               onExecute={executeQuery}
                               isLoading={isLoading}
                             />
                           )}
                         </div>
                       </CardContent>
                     </Card>
 
                     {/* Query Results */}
                     <Card className="transition-all duration-200 hover:shadow-md">
                       <CardHeader className="pb-3 px-4 sm:px-6">
                         <CardTitle className="flex items-center gap-2">
                           <Play className={`h-5 w-5 transition-transform ${isLoading ? 'animate-spin' : ''}`} />
                           Query Results
                           {results && (
                             <Badge variant="secondary" className="ml-auto">
                               {results.data.length} rows
                             </Badge>
                           )}
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="pb-4 px-4 sm:px-6">
                         <div className="h-[500px] overflow-auto">
                           <QueryResults
                             results={results}
                             error={error}
                             isLoading={isLoading}
                           />
                         </div>
                       </CardContent>
                     </Card>
                   </div>
                </div>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}