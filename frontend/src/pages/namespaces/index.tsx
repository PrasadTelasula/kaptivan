"use client"

import { useState, useEffect } from "react"
import { Grid3X3, List, RefreshCw, AlertCircle } from "lucide-react"
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar-new'
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TooltipProvider } from "@/components/ui/tooltip"

import { NamespaceCard } from "./components/NamespaceCard"
import { NamespaceTable } from "./components/NamespaceTable"
import { NamespaceFilters } from "./components/NamespaceFilters"
import { useNamespaces, useFilteredNamespaces } from "./hooks/useNamespaces"
import type { FilterState, Namespace } from "./types"

export function MultiClusterNamespaces() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filters, setFilters] = useState<FilterState>({
    clusters: [],
    search: "",
    status: "all",
    labels: {}
  })

  const { 
    clusters, 
    namespaces, 
    isLoading, 
    error, 
    refetch 
  } = useNamespaces()

  const filteredNamespaces = useFilteredNamespaces(namespaces, filters)

  // Refetch namespaces when cluster selection changes
  useEffect(() => {
    if (filters.clusters.length > 0) {
      refetch()
    }
  }, [filters.clusters]) // Remove refetch from dependencies to avoid infinite loop

  if (isLoading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block border-r shrink-0" />
        <main className="flex-1 flex flex-col p-4 overflow-auto">
          <TooltipProvider>
            <div className="space-y-6">
              <PageHeader />
              
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <NamespaceFilters
                  clusters={clusters}
                  namespaces={namespaces}
                  filters={filters}
                  onFiltersChange={setFilters}
                />

                <Actions
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>

              <Separator />

              <NamespaceContent
                viewMode={viewMode}
                namespaces={filteredNamespaces}
              />
            </div>
          </TooltipProvider>
        </main>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold">Multi-Cluster Namespaces</h1>
      <p className="text-muted-foreground">
        View and monitor namespaces across all your Kubernetes clusters
      </p>
    </div>
  )
}

function Actions({ 
  viewMode, 
  onViewModeChange
}: {
  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
}) {
  return (
    <div className="flex gap-2">
      <ToggleGroup type="single" value={viewMode} onValueChange={(v) => 
        v && onViewModeChange(v as "grid" | "list")
      }>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <Grid3X3 className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view">
          <List className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

function NamespaceContent({ 
  viewMode, 
  namespaces
}: {
  viewMode: "grid" | "list"
  namespaces: Namespace[]
}) {
  return (
    <Tabs value={viewMode}>
      <TabsList className="hidden">
        <TabsTrigger value="grid">Grid</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
      </TabsList>

      <TabsContent value="grid" className="mt-0">
        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {namespaces.map((namespace, index) => (
              <NamespaceCard
                key={`ns-${index}-${namespace.clusterId || namespace.cluster}-${namespace.name || index}`}
                namespace={namespace}
              />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <NamespaceTable
          namespaces={namespaces}
        />
      </TabsContent>
    </Tabs>
  )
}

function LoadingState() {
  return (
    <div className="container mx-auto p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={onRetry} className="mt-2" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </Alert>
    </div>
  )
}

