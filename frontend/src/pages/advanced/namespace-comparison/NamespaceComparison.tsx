import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { MultiNamespaceSelector } from './components/MultiNamespaceSelector'
import { MultiResourcesCount } from './components/MultiResourcesCount'
import { DetailedDifferences } from './components/DetailedDifferences'
import { useClusters } from './hooks/useClusters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ChevronLeft, BarChart3, Download, FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

interface NamespaceSelection {
  id?: string
  cluster: string
  namespace: string
  color: string
}

export function NamespaceComparison() {
  const [selectedNamespaces, setSelectedNamespaces] = useState<NamespaceSelection[] | null>(null)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [activeTab, setActiveTab] = useState('resources')
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Multi-Namespace Comparison</h2>
                <p className="text-muted-foreground">
                  Compare multiple Kubernetes namespaces across different clusters
                </p>
              </div>
              {selectedNamespaces && (
                <Button 
                  variant="outline" 
                  onClick={handleBack}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  New Comparison
                </Button>
              )}
            </div>

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
                <Card className="border shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-baseline gap-2">
                          <CardTitle className="text-base font-medium">
                            Comparison Results
                          </CardTitle>
                          <CardDescription className="text-sm">
                            Analyzing {selectedNamespaces.length} namespaces across clusters
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {selectedNamespaces.map((ns, idx) => (
                          <Badge 
                            key={idx}
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${ns.color.replace('bg-', 'border-').replace('/10', '')}`}
                          >
                            {ns.cluster}/{ns.namespace}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Tabs Navigation */}
                <div className="mb-6">
                  <div className="relative flex flex-row gap-1">
                    <motion.button
                      type="button"
                      onClick={() => setActiveTab('resources')}
                      onMouseEnter={() => setHoveredTab('resources')}
                      onMouseLeave={() => setHoveredTab(null)}
                      className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground inline-flex items-center gap-2 rounded-lg"
                    >
                      {(hoveredTab === 'resources' || activeTab === 'resources') && (
                        <motion.div
                          layoutId="tab-background"
                          className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: hoveredTab === 'resources' ? 1 : activeTab === 'resources' ? 0.5 : 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: 'spring',
                            bounce: 0.2,
                            duration: 0.3,
                          }}
                        />
                      )}
                      <BarChart3 className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">Resource Comparison</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setActiveTab('detailed')}
                      onMouseEnter={() => setHoveredTab('detailed')}
                      onMouseLeave={() => setHoveredTab(null)}
                      className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground inline-flex items-center gap-2 rounded-lg"
                    >
                      {(hoveredTab === 'detailed' || activeTab === 'detailed') && (
                        <motion.div
                          layoutId="tab-background"
                          className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: hoveredTab === 'detailed' ? 1 : activeTab === 'detailed' ? 0.5 : 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: 'spring',
                            bounce: 0.2,
                            duration: 0.3,
                          }}
                        />
                      )}
                      <FileSearch className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">Detailed Differences</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setActiveTab('export')}
                      onMouseEnter={() => setHoveredTab('export')}
                      onMouseLeave={() => setHoveredTab(null)}
                      className="relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground inline-flex items-center gap-2 rounded-lg"
                    >
                      {(hoveredTab === 'export' || activeTab === 'export') && (
                        <motion.div
                          layoutId="tab-background"
                          className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: hoveredTab === 'export' ? 1 : activeTab === 'export' ? 0.5 : 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: 'spring',
                            bounce: 0.2,
                            duration: 0.3,
                          }}
                        />
                      )}
                      <Download className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">Export Options</span>
                    </motion.button>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'resources' ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <MultiResourcesCount selections={selectedNamespaces} />
                    </CardContent>
                  </Card>
                ) : activeTab === 'detailed' ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <DetailedDifferences selections={selectedNamespaces} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
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
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}