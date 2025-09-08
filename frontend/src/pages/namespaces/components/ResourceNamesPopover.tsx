import { useState, useEffect } from "react"
import { Info, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { namespacesApi } from "../services/api"

interface ResourceNamesPopoverProps {
  namespace: string
  cluster: string
  resourceType: string
  count: number
  allNamespaces: Array<{
    namespace: string
    cluster: string
    count: number
  }>
  isHighlighted?: boolean
}

export function ResourceNamesPopover({
  namespace,
  cluster,
  resourceType,
  count,
  allNamespaces,
  isHighlighted = false
}: ResourceNamesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resourceNames, setResourceNames] = useState<string[]>([])
  const [otherResourceNames, setOtherResourceNames] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    if (open && resourceNames.length === 0) {
      fetchResourceNames()
    }
  }, [open])

  const fetchResourceNames = async () => {
    setLoading(true)
    try {
      // Fetch names for current namespace
      const response = await namespacesApi.getResourceNames(cluster, namespace, resourceType)
      setResourceNames(response.names || [])

      // Fetch names for other namespaces
      const otherNames = new Map<string, string[]>()
      for (const ns of allNamespaces) {
        if (ns.namespace !== namespace || ns.cluster !== cluster) {
          try {
            const otherResponse = await namespacesApi.getResourceNames(ns.cluster, ns.namespace, resourceType)
            otherNames.set(`${ns.cluster}/${ns.namespace}`, otherResponse.names || [])
          } catch (error) {
            console.error(`Error fetching resource names for ${ns.namespace}:`, error)
          }
        }
      }
      setOtherResourceNames(otherNames)
    } catch (error) {
      console.error('Error fetching resource names:', error)
    } finally {
      setLoading(false)
    }
  }

  // Find unique resources
  const uniqueResources = resourceNames.filter(name => {
    let isUnique = true
    otherResourceNames.forEach((names) => {
      if (names.includes(name)) {
        isUnique = false
      }
    })
    return isUnique
  })

  // Find common resources
  const commonResources = resourceNames.filter(name => !uniqueResources.includes(name))

  const formatResourceType = (type: string) => {
    return type
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  // Don't show popover if counts are the same across all namespaces
  const showPopover = allNamespaces.some(ns => ns.count !== count)

  if (!showPopover) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 hover:bg-transparent ml-1"
        >
          <Info className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-auto" align="center" side="top">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {namespace}
              </Badge>
              {formatResourceType(resourceType)}
            </h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading resource names...</span>
              </div>
            ) : resourceNames.length > 0 ? (
              <div className="space-y-3">
                {uniqueResources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Unique to this namespace ({uniqueResources.length}):
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {uniqueResources.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant="default"
                          className="text-xs px-2 py-0.5"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {commonResources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Shared resources ({commonResources.length}):
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {commonResources.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs px-2 py-0.5"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {resourceNames.length > 0 && uniqueResources.length === 0 && commonResources.length === 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      All resources ({resourceNames.length}):
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {resourceNames.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs px-2 py-0.5"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No resources found</p>
            )}
          </div>
          
          {isHighlighted && !loading && (
            <Alert className="py-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                This namespace has {count > allNamespaces[0]?.count ? 'more' : 'fewer'} {formatResourceType(resourceType).toLowerCase()} than others
              </AlertDescription>
            </Alert>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}