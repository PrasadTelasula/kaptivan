import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Server, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DraggableQueryTable } from './draggable-query-table'
import { AnimatedTabs } from '@/components/ui/animated-tabs'

interface QueryResultsProps {
  results: any
  error: string | null
  isLoading: boolean
}

export function QueryResults({ results, error, isLoading }: QueryResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in-0 duration-300">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="border rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="animate-pulse">Executing query across clusters...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">Query Error</div>
          <div className="text-sm opacity-90 whitespace-pre-wrap">{error}</div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!results) {
    return null
  }

  const { data, metadata } = results
  
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground animate-in fade-in-0 zoom-in-95 duration-500">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm mt-2 opacity-75">Query executed successfully but returned no matching resources</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-green-500/10 animate-in zoom-in-95 duration-300">
            {data.length} {data.length === 1 ? 'result' : 'results'}
          </Badge>
          {results.metadata?.queriedClusters && results.metadata.queriedClusters.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Server className="h-3 w-3" />
              {results.metadata.queriedClusters.length === 1 
                ? results.metadata.queriedClusters[0]
                : `${results.metadata.queriedClusters.length} clusters`}
            </Badge>
          )}
          {metadata?.executionTime && (
            <Badge variant="secondary">
              {metadata.executionTime}ms
            </Badge>
          )}
        </div>
        {results.errors && results.errors.length > 0 && (
          <div className="text-sm text-amber-600">
            {results.errors.length} cluster{results.errors.length > 1 ? 's' : ''} had errors
          </div>
        )}
      </div>

      <AnimatedTabs
        defaultValue="table"
        tabs={[
          {
            value: 'table',
            label: 'Table View',
            content: (
              <>
                <DraggableQueryTable data={data} isLoading={isLoading} />
                {results.errors && results.errors.length > 0 && (
                  <Alert className="mt-4 animate-in fade-in-0 slide-in-from-top-2 duration-500">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Some clusters had errors:</p>
                      <ul className="text-xs space-y-1 ml-2">
                        {results.errors.map((error: string, idx: number) => (
                          <li key={idx} className="list-disc list-inside">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ),
          },
          {
            value: 'json',
            label: 'JSON View',
            content: (
              <ScrollArea className="h-[400px] border rounded-lg bg-muted/50">
                <pre className="p-4 text-sm font-mono">
                  <code className="language-json">{JSON.stringify(data, null, 2)}</code>
                </pre>
              </ScrollArea>
            ),
          },
        ]}
      />
    </div>
  )
}