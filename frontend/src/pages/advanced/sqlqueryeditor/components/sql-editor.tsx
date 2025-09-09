import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Play, Loader2, Sparkles, Code2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SqlEditorProps {
  query: string
  onChange: (value: string) => void
  onExecute: () => void
  isLoading: boolean
}

export function SqlEditor({ query, onChange, onExecute, isLoading }: SqlEditorProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onExecute()
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative">
            <Textarea
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT name, namespace, phase FROM pods WHERE phase = 'Running' LIMIT 10"
              className={cn(
                "min-h-[120px] font-mono text-sm resize-none transition-all duration-200",
                "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                "focus:shadow-lg focus:ring-2 focus:ring-blue-500/20",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              disabled={isLoading}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs animate-in fade-in-0 zoom-in-95 duration-300">
                <Code2 className="h-3 w-3 mr-1" />
                SQL
              </Badge>
              <Badge variant="outline" className="text-xs animate-in fade-in-0 zoom-in-95 duration-500">
                Ctrl/Cmd + Enter
              </Badge>
            </div>
          </div>
        </div>
      
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground animate-pulse" />
            <div className="text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-left-2 duration-500">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help hover:text-foreground transition-colors">
                    Supported resources: pods, deployments, services, nodes, and more
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-semibold mb-2">Available Resources:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>• pods</div>
                    <div>• deployments</div>
                    <div>• services</div>
                    <div>• nodes</div>
                    <div>• namespaces</div>
                    <div>• configmaps</div>
                    <div>• secrets</div>
                    <div>• statefulsets</div>
                    <div>• daemonsets</div>
                    <div>• jobs</div>
                    <div>• cronjobs</div>
                    <div>• replicasets</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Button
            onClick={onExecute}
            disabled={!query.trim() || isLoading}
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              "hover:shadow-lg hover:scale-105",
              isLoading && "animate-pulse"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">Executing...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
                Execute Query
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}