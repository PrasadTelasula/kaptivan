import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  Loader2,
  Link2
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

interface RelatedResourcesPopoverProps {
  clusterContext: string
  resourceName: string
  resourceKind: string
  resourceApiVersion: string
  resourceNamespace?: string
  onNavigate: (resource: RelatedResource) => void
  clusterName?: string
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

export function RelatedResourcesPopover({
  clusterContext,
  resourceName,
  resourceKind,
  resourceApiVersion,
  resourceNamespace,
  onNavigate,
  clusterName
}: RelatedResourcesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [relatedResources, setRelatedResources] = useState<RelatedResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchRelatedResources()
    }
  }, [open, clusterContext, resourceName, resourceKind, resourceApiVersion, resourceNamespace])

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

      const url = `/api/v1/manifests/${clusterContext}/${resourceName}/related?${params.toString()}`
      console.log('Fetching related resources from:', url)
      
      const response = await fetch(url)

      if (!response.ok) {
        const text = await response.text()
        console.error('Response not OK:', response.status, text)
        throw new Error(`Failed to fetch related resources: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Response is not JSON:', contentType, text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
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
  const hasRelated = owners.length > 0 || children.length > 0

  const handleResourceClick = (resource: RelatedResource) => {
    onNavigate(resource)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="View related resources"
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80" 
        align="end"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h4 className="font-medium text-sm">Related Resources</h4>
              {clusterName && (
                <span className="text-xs text-muted-foreground">
                  Cluster: {clusterName}
                </span>
              )}
            </div>
            {hasRelated && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {relatedResources.length}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-4">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          ) : !hasRelated ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                No related resources found
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {/* Owner References */}
                {owners.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        OWNER REFERENCES
                      </span>
                    </div>
                    <div className="space-y-1">
                      {owners.map((resource, index) => {
                        const Icon = getResourceIcon(resource.kind)
                        return (
                          <Button
                            key={`${resource.uid || index}`}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-left h-8 px-2"
                            onClick={() => handleResourceClick(resource)}
                          >
                            <Icon className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-xs">{resource.kind}</span>
                                {resource.namespace && (
                                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    {resource.namespace}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {resource.name}
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 ml-2 flex-shrink-0 text-muted-foreground" />
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
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        CHILD RESOURCES
                      </span>
                    </div>
                    <div className="space-y-1">
                      {children.map((resource, index) => {
                        const Icon = getResourceIcon(resource.kind)
                        return (
                          <Button
                            key={`${resource.uid || index}`}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-left h-8 px-2"
                            onClick={() => handleResourceClick(resource)}
                          >
                            <Icon className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-xs">{resource.kind}</span>
                                {resource.namespace && (
                                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                    {resource.namespace}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {resource.name}
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 ml-2 flex-shrink-0 text-muted-foreground" />
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}