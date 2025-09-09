import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { SqlEditor } from './components/sql-editor'
import { SqlEditorEnhanced } from './components/sql-editor-enhanced'
import { SchemaExplorer } from './components/schema-explorer'
import { QueryResults } from './components/query-results'
import { QueryExamples } from './components/query-examples'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/ui/animated-tabs'
import { Database, Play, History, Server, AlertCircle, Settings2, BookOpen } from 'lucide-react'
import { useClusterStore } from '@/stores/cluster.store'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function SqlQueryEditorPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([])
  const [useEnhancedEditor, setUseEnhancedEditor] = useState(true)
  const [showSchemaExplorer, setShowSchemaExplorer] = useState(true)
  
  // Get current context from Zustand store
  const { currentContext, selectedContexts } = useClusterStore()
  
  // Use the first selected context or the current context
  const activeContext = selectedContexts.length > 0 ? selectedContexts[0] : currentContext

  const handleFieldClick = (resource: string, field: string) => {
    // Insert field into query at cursor position or append
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
  }

  const handleQueryExample = (exampleQuery: string) => {
    setQuery(exampleQuery)
  }

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
        actualQuery = query.replace(/\s*(AND\s+)?cluster\s*=\s*['"][^'"]+['"]\s*(AND\s*)?/gi, (match, before, after) => {
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

  const handleExampleSelect = (exampleQuery: string) => {
    setQuery(exampleQuery)
  }

  const handleHistorySelect = (historicalQuery: string) => {
    setQuery(historicalQuery)
  }

  return (
    <TooltipProvider>
      <div className="h-screen bg-background flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar className="hidden lg:block border-r" />
          <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-bold tracking-tight">SQL Query Editor</h2>
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
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="enhanced-editor"
                            checked={useEnhancedEditor}
                            onCheckedChange={setUseEnhancedEditor}
                          />
                          <Label htmlFor="enhanced-editor" className="text-sm flex items-center gap-1">
                            <Settings2 className="h-4 w-4" />
                            IntelliSense
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="schema-explorer"
                            checked={showSchemaExplorer}
                            onCheckedChange={setShowSchemaExplorer}
                          />
                          <Label htmlFor="schema-explorer" className="text-sm flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            Schema Explorer
                          </Label>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      Query Kubernetes resources using SQL-like syntax with auto-complete and schema discovery
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

                  <ResizablePanelGroup
                    direction="horizontal"
                    className="rounded-lg border animate-in fade-in-0 zoom-in-95 duration-500"
                  >
                    {showSchemaExplorer && (
                      <>
                        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                          <Card className="h-full rounded-none border-0">
                            <SchemaExplorer
                              context={activeContext}
                              onFieldClick={handleFieldClick}
                              onQueryExample={handleQueryExample}
                            />
                          </Card>
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                      </>
                    )}
                    <ResizablePanel defaultSize={showSchemaExplorer ? 50 : 75} minSize={50}>
                      <div className="h-full flex flex-col">
                        <ResizablePanelGroup direction="vertical">
                          <ResizablePanel defaultSize={40} minSize={20}>
                            <Card className="h-full rounded-none border-0">
                              <CardHeader className="pb-3">
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
                              <CardContent className="h-[calc(100%-5rem)] pb-0">
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
                              </CardContent>
                            </Card>
                          </ResizablePanel>
                          
                          <ResizableHandle withHandle />
                          
                          <ResizablePanel defaultSize={60} minSize={30}>
                            <Card className="h-full rounded-none border-0 border-t">
                              <CardHeader className="pb-3">
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
                              <CardContent className="h-[calc(100%-4rem)] pb-0">
                                <QueryResults
                                  results={results}
                                  error={error}
                                  isLoading={isLoading}
                                />
                              </CardContent>
                            </Card>
                          </ResizablePanel>
                        </ResizablePanelGroup>
                      </div>
                    </ResizablePanel>
                    
                    <ResizableHandle withHandle />
                    
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                      <div className="h-full p-4">
                        <AnimatedTabs
                          defaultValue="examples"
                          className="h-full flex flex-col"
                          tabs={[
                            {
                              value: 'examples',
                              label: 'Examples',
                              content: (
                                <ScrollArea className="h-full mt-4">
                                  <QueryExamples onSelectExample={handleExampleSelect} />
                                </ScrollArea>
                              ),
                            },
                            {
                              value: 'history',
                              label: 'History',
                              content: (
                                <Card className="h-full mt-4">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                      <History className="h-4 w-4" />
                                      Query History
                                      {queryHistory.length > 0 && (
                                        <Badge variant="outline" className="ml-auto">
                                          {queryHistory.length}
                                        </Badge>
                                      )}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ScrollArea className="h-[calc(100vh-20rem)]">
                                      {queryHistory.length === 0 ? (
                                        <div className="flex items-center justify-center h-32">
                                          <p className="text-sm text-muted-foreground">
                                            No queries executed yet
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {queryHistory.map((historicalQuery, index) => (
                                            <Tooltip key={index}>
                                              <TooltipTrigger asChild>
                                                <button
                                                  onClick={() => handleHistorySelect(historicalQuery)}
                                                  className="w-full text-left p-3 text-sm rounded-md border hover:bg-accent hover:text-accent-foreground transition-all hover:shadow-sm group"
                                                >
                                                  <div className="font-mono text-xs opacity-50 mb-1">#{queryHistory.length - index}</div>
                                                  {historicalQuery.length > 60
                                                    ? `${historicalQuery.substring(0, 60)}...`
                                                    : historicalQuery}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="left" className="max-w-md">
                                                <p className="font-mono text-xs break-all">{historicalQuery}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          ))}
                                        </div>
                                      )}
                                    </ScrollArea>
                                  </CardContent>
                                </Card>
                              ),
                            },
                          ]}
                        />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}