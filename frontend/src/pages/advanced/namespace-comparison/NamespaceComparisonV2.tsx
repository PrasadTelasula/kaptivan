import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { MultiNamespaceSelector } from './components/MultiNamespaceSelector'
import { MultiResourcesCount } from './components/MultiResourcesCount'
import { useClusters } from './hooks/useClusters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ChevronLeft, GitCompare, BarChart3, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

interface NamespaceSelection {
  id?: string
  cluster: string
  namespace: string
  color: string
}

export function NamespaceComparisonV2() {
  const [selectedNamespaces, setSelectedNamespaces] = useState<NamespaceSelection[] | null>(null)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')

  const {
    clusters,
    isLoading: isLoadingClusters,
    error: clustersError
  } = useClusters()

  const handleCompare = (selections: NamespaceSelection[]) => {
    setSelectedNamespaces(selections)
  }

  const handleBack = () => {
    setSelectedNamespaces(null)
  }

  const handleExport = () => {
    // TODO: Implement export functionality for multi-namespace comparison
    console.log('Exporting in format:', exportFormat)
  }

  if (isLoadingClusters) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar className="hidden lg:block border-r" />
          <main className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="h-12 w-64 bg-muted rounded-lg mb-4" />
                <div className="h-64 w-full bg-muted rounded-lg" />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (clustersError) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar className="hidden lg:block border-r" />
          <main className="flex-1 p-6 overflow-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load clusters: {clustersError}
              </AlertDescription>
            </Alert>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="space-y-6">
            {/* Header */}
            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <GitCompare className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Multi-Namespace Comparison
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Compare multiple Kubernetes namespaces across different clusters
                  </p>
                </div>
              </div>
              {selectedNamespaces && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    New Comparison
                  </Button>
                </motion.div>
              )}
            </motion.div>

            {/* Main Content */}
            {!selectedNamespaces ? (
              <MultiNamespaceSelector
                clusters={clusters}
                onCompare={handleCompare}
                isLoading={false}
                error={null}
              />
            ) : (
              <motion.div 
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {/* Comparison Info */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Comparison Results
                        </CardTitle>
                        <CardDescription>
                          Analyzing {selectedNamespaces.length} namespaces across clusters
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedNamespaces.map((ns, idx) => (
                          <Badge 
                            key={idx}
                            variant="outline"
                            className={cn(
                              "text-xs",
                              ns.color.replace('bg-', 'border-').replace('/10', '')
                            )}
                          >
                            {ns.cluster}/{ns.namespace}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Comparison Tabs */}
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-0">
                    <Tabs defaultValue="resources" className="w-full">
                      <TabsList className="w-full justify-start rounded-none border-b bg-muted/50">
                        <TabsTrigger value="resources" className="gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Resource Comparison
                        </TabsTrigger>
                        <TabsTrigger value="export" className="gap-2">
                          <Download className="h-4 w-4" />
                          Export Options
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="resources" className="p-6">
                        <MultiResourcesCount selections={selectedNamespaces} />
                      </TabsContent>
                      
                      <TabsContent value="export" className="p-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-medium mb-2">Export Format</h3>
                            <div className="flex gap-4">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="csv"
                                  checked={exportFormat === 'csv'}
                                  onChange={(e) => setExportFormat(e.target.value as 'csv')}
                                  className="form-radio"
                                />
                                <span>CSV</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="json"
                                  checked={exportFormat === 'json'}
                                  onChange={(e) => setExportFormat(e.target.value as 'json')}
                                  className="form-radio"
                                />
                                <span>JSON</span>
                              </label>
                            </div>
                          </div>
                          
                          <Button onClick={handleExport} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export as {exportFormat.toUpperCase()}
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// Helper function for className utility
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}