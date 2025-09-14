import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Shield,
  Copy,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useState } from 'react'
import type { LintResult } from '../index'

interface LintResultsProps {
  results: LintResult[]
  error: string | null
  yamlContent: string
}

export function LintResults({ results, error, yamlContent }: LintResultsProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityBadgeVariant = (severity: string): any => {
    switch (severity) {
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      case 'info':
        return 'default'
      default:
        return 'outline'
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const filteredResults = selectedSeverity === 'all' 
    ? results 
    : results.filter(r => r.severity === selectedSeverity)

  const severityCounts = {
    error: results.filter(r => r.severity === 'error').length,
    warning: results.filter(r => r.severity === 'warning').length,
    info: results.filter(r => r.severity === 'info').length,
  }

  const exportResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: severityCounts,
      results: results,
      yamlContent: yamlContent
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lint-report-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyResults = async () => {
    const summary = `Lint Results Summary:
- Errors: ${severityCounts.error}
- Warnings: ${severityCounts.warning}
- Info: ${severityCounts.info}

Details:
${results.map(r => `${r.severity.toUpperCase()}: ${r.message} (${r.check})`).join('\n')}
`
    try {
      await navigator.clipboard.writeText(summary)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Linting Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (results.length === 0) {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-700 dark:text-green-400">All Checks Passed!</AlertTitle>
        <AlertDescription className="text-green-600 dark:text-green-500">
          Your YAML manifest follows all best practices and security guidelines.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {severityCounts.error} Errors
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {severityCounts.warning} Warnings
          </Badge>
          <Badge variant="default" className="gap-1">
            <Info className="h-3 w-3" />
            {severityCounts.info} Info
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyResults}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportResults}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Tabs value={selectedSeverity} onValueChange={setSelectedSeverity}>
        <TabsList>
          <TabsTrigger value="all">All ({results.length})</TabsTrigger>
          <TabsTrigger value="error">Errors ({severityCounts.error})</TabsTrigger>
          <TabsTrigger value="warning">Warnings ({severityCounts.warning})</TabsTrigger>
          <TabsTrigger value="info">Info ({severityCounts.info})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedSeverity} className="mt-4">
          <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {filteredResults.map((result, index) => {
                  const id = `${result.check}-${index}`
                  const isExpanded = expandedItems.has(id)
                  
                  return (
                    <div
                      key={id}
                      className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getSeverityIcon(result.severity)}
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{result.check}</span>
                              <Badge variant={getSeverityBadgeVariant(result.severity)}>
                                {result.severity}
                              </Badge>
                              {result.line > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Line {result.line}
                                  {result.column > 0 && `:${result.column}`}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {result.message}
                            </p>
                            {result.object && (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {result.object}
                              </code>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      {isExpanded && result.remediation && (
                        <Alert className="mt-3">
                          <Shield className="h-4 w-4" />
                          <AlertTitle className="text-sm">Remediation</AlertTitle>
                          <AlertDescription className="text-sm mt-2">
                            {result.remediation}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )
                })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}