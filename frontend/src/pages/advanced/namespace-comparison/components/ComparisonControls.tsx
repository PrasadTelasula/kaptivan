import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, Copy } from 'lucide-react'

interface ComparisonControlsProps {
  showDifferencesOnly: boolean
  onShowDifferencesChange: (value: boolean) => void
  onRefresh: () => void
  onExport: () => void
  isRefreshing?: boolean
}

export function ComparisonControls({
  showDifferencesOnly,
  onShowDifferencesChange,
  onRefresh,
  onExport,
  isRefreshing = false
}: ComparisonControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Switch
          id="show-diff"
          checked={showDifferencesOnly}
          onCheckedChange={onShowDifferencesChange}
        />
        <Label htmlFor="show-diff" className="cursor-pointer">
          Show differences only
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  )
}