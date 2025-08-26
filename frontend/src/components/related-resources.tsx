import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  Layers,
  Package,
  Box,
  Database,
  GitBranch,
  Network,
  Loader2
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface RelatedResource {
  name: string
  namespace?: string
  kind: string
  apiVersion: string
  relationship: 'owner' | 'child'
  uid?: string
}

interface RelatedResourcesProps {
  clusterContext: string
  resourceName: string
  resourceKind: string
  resourceApiVersion: string
  resourceNamespace?: string
  onNavigate: (resource: RelatedResource) => void
}

// Icon mapping for different resource kinds
const getResourceIcon = (kind: string) => {
  const iconMap: Record<string, React.ElementType> = {
    'Deployment': Layers,
    'ReplicaSet': Package,
    'Pod': Box,
    'StatefulSet': Database,
    'DaemonSet': GitBranch,
    'Service': Network,
  }
  return iconMap[kind] || Box
}

export function RelatedResources({
  clusterContext,
  resourceName,
  resourceKind,
  resourceApiVersion,
  resourceNamespace,
  onNavigate
}: RelatedResourcesProps) {
  const [relatedResources, setRelatedResources] = useState<RelatedResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRelatedResources()
  }, [clusterContext, resourceName, resourceKind, resourceApiVersion, resourceNamespace])

  const fetchRelatedResources = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      params.append('kind', resourceKind)
      params.append('apiVersion', resourceApiVersion)
      if (resourceNamespace) {
        params.append('namespace', resourceNamespace)
      }

      const response = await fetch(
        `/api/v1/manifests/${clusterContext}/${resourceName}/related?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch related resources')
      }

      const data = await response.json()
      setRelatedResources(data.resources || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch related resources')
      setRelatedResources([])
    } finally {
      setLoading(false)
    }
  }

  const owners = relatedResources.filter(r => r.relationship === 'owner')
  const children = relatedResources.filter(r => r.relationship === 'child')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (relatedResources.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">No related resources found</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Owner References */}
        {owners.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Owner References</h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {owners.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {owners.map((resource, index) => {
                const Icon = getResourceIcon(resource.kind)
                return (
                  <Button
                    key={`${resource.uid || index}`}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => onNavigate(resource)}
                  >
                    <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{resource.kind}</span>
                        {resource.namespace && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {resource.namespace}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {resource.name}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0" />
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Separator if both exist */}
        {owners.length > 0 && children.length > 0 && (
          <Separator />
        )}

        {/* Child Resources */}
        {children.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Child Resources</h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {children.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {children.map((resource, index) => {
                const Icon = getResourceIcon(resource.kind)
                return (
                  <Button
                    key={`${resource.uid || index}`}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => onNavigate(resource)}
                  >
                    <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{resource.kind}</span>
                        {resource.namespace && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {resource.namespace}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {resource.name}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0" />
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}