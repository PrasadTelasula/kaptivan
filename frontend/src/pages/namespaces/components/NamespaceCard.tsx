import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, Eye, Server, Network, Layers, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResourceStats } from "./ResourceStats"
import { NamespaceDetailsDialog } from "./NamespaceDetailsDialog"
import type { Namespace, ResourceCount } from "../types"
import { namespacesApi } from "../services/api"
import { cn } from "@/lib/utils"

interface NamespaceCardProps {
  namespace: Namespace
}

export function NamespaceCard({ namespace }: NamespaceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [resources, setResources] = useState<ResourceCount | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    // Load resources immediately to show badges
    if (!resources) {
      fetchResources()
    }
  }, [])

  useEffect(() => {
    if (isExpanded && !resources) {
      fetchResources()
    }
  }, [isExpanded])

  const fetchResources = async () => {
    setIsLoading(true)
    try {
      const data = await namespacesApi.getNamespaceResources(namespace.clusterId, namespace.name)
      if (data?.resources) {
        setResources(data.resources)
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalResources = resources 
    ? Object.values(resources).reduce((sum, count) => sum + count, 0)
    : namespace.podCount + namespace.serviceCount

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">{namespace.name}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{namespace.cluster}</span>
              <Badge 
                variant={namespace.status === "Active" ? "outline" : "secondary"}
                className="h-5"
              >
                {namespace.status}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDetailsOpen(true)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Resource Summary Badges */}
        {resources && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {resources.pods > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                <Server className="h-3 w-3 mr-1" />
                {resources.pods} Pods
              </Badge>
            )}
            {resources.services > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                <Network className="h-3 w-3 mr-1" />
                {resources.services} Svc
              </Badge>
            )}
            {resources.deployments > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                <Layers className="h-3 w-3 mr-1" />
                {resources.deployments} Deploy
              </Badge>
            )}
            {(resources.configMaps + resources.secrets) > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                <Database className="h-3 w-3 mr-1" />
                {resources.configMaps + resources.secrets} Config
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-2xl font-bold">
              {resources?.pods ?? namespace.podCount}
            </div>
            <p className="text-xs text-muted-foreground">Pods</p>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {resources?.services ?? namespace.serviceCount}
            </div>
            <p className="text-xs text-muted-foreground">Services</p>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {resources?.deployments ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Deployments</p>
          </div>
          <div>
            <div className="text-2xl font-bold">{totalResources}</div>
            <p className="text-xs text-muted-foreground">Total Resources</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Show Details
            </>
          )}
        </Button>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : resources ? (
              <ResourceStats resources={resources} variant="detailed" />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No resource data available
              </p>
            )}
          </div>
        )}
      </CardContent>
      <NamespaceDetailsDialog
        namespace={namespace}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </Card>
  )
}