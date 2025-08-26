import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Power, PowerOff } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useClusterStore } from '@/stores/cluster.store'

export function ClusterSelector() {
  const [open, setOpen] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  
  const {
    clusters,
    currentContext,
    selectedContexts,
    currentClusterVersion,
    fetchClusters,
    connectCluster,
    disconnectCluster,
    setCurrentContext,
    toggleClusterSelection,
    selectAllClusters,
    clearSelection,
    isClusterSelected,
  } = useClusterStore()

  useEffect(() => {
    fetchClusters()
  }, [fetchClusters])

  const handleConnect = async (context: string) => {
    setConnecting(context)
    try {
      await connectCluster(context)
      // Don't close the popover, let user continue selecting
      // setOpen(false)
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (context: string) => {
    try {
      await disconnectCluster(context)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const currentCluster = clusters.find(c => c.context === currentContext)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
        >
          {currentContext ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="truncate">
                {clusters.find(c => c.context === currentContext)?.name || currentContext}
              </span>
            </div>
          ) : selectedContexts.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="truncate">
                {selectedContexts.length === 1 
                  ? clusters.find(c => c.context === selectedContexts[0])?.name
                  : `${selectedContexts.length} clusters selected`}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select cluster...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 max-h-[400px]">
        <Command>
          <CommandInput placeholder="Search clusters..." className="h-9 border-0" />
          <CommandEmpty>No cluster found.</CommandEmpty>
          <div className="p-2 border-b border-border">
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => selectAllClusters()}
                className="h-7 text-xs"
              >
                Select All Connected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => clearSelection()}
                className="h-7 text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
          <CommandGroup className="max-h-[250px] overflow-y-auto">
            {clusters.map((cluster) => (
              <CommandItem
                key={cluster.context}
                value={cluster.context}
                onSelect={() => {
                  if (cluster.connected) {
                    toggleClusterSelection(cluster.context)
                    // Also set as current context for pages that need a single cluster
                    setCurrentContext(cluster.context)
                  }
                }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {cluster.connected && (
                    <Checkbox
                      checked={isClusterSelected(cluster.context)}
                      onCheckedChange={() => {
                        toggleClusterSelection(cluster.context)
                        // Also set as current context for pages that need a single cluster
                        setCurrentContext(cluster.context)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      cluster.connected ? "bg-green-500" : "bg-gray-400"
                    )}
                  />
                  <div>
                    <div className="font-medium">{cluster.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {cluster.context}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {cluster.connected ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDisconnect(cluster.context)
                      }}
                    >
                      <PowerOff className="h-3 w-3" />
                    </Button>
                  ) : connecting === cluster.context ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConnect(cluster.context)
                      }}
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
        {selectedContexts.length === 1 && currentClusterVersion && (
          <div className="border-t p-3 text-xs">
            <div className="font-medium mb-1">Cluster Info</div>
            <div className="space-y-1 text-muted-foreground">
              <div>Kubernetes {currentClusterVersion.gitVersion}</div>
              <div>Platform: {currentClusterVersion.platform}</div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}