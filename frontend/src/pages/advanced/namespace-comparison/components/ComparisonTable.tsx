import type { CompareRow } from '../types/index'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ComparisonTableProps {
  rows: CompareRow[]
  namespaceA: string
  namespaceB: string
  showDifferencesOnly: boolean
}

export function ComparisonTable({
  rows,
  namespaceA,
  namespaceB,
  showDifferencesOnly
}: ComparisonTableProps) {
  // Filter rows if showing differences only
  const displayRows = showDifferencesOnly
    ? rows.filter(row => row.delta !== undefined || row.section)
    : rows

  const getSeverityBadgeVariant = (severity?: 'ok' | 'warn' | 'crit') => {
    switch (severity) {
      case 'crit':
        return 'destructive'
      case 'warn':
        return 'secondary'
      case 'ok':
        return 'default'
      default:
        return undefined
    }
  }

  const getSeverityColor = (severity?: 'ok' | 'warn' | 'crit') => {
    switch (severity) {
      case 'crit':
        return 'text-red-500'
      case 'warn':
        return 'text-yellow-500'
      case 'ok':
        return 'text-green-500'
      default:
        return ''
    }
  }

  const renderValue = (value: string | number, severity?: 'ok' | 'warn' | 'crit') => {
    if (severity) {
      return (
        <Badge variant={getSeverityBadgeVariant(severity)} className="font-mono">
          {value}
        </Badge>
      )
    }
    return <span className="font-mono">{value}</span>
  }

  const renderDelta = (delta?: string | number) => {
    if (!delta) return <span className="text-muted-foreground">–</span>
    
    const deltaStr = delta.toString()
    if (deltaStr.startsWith('+')) {
      return <span className="text-yellow-500 font-mono">{deltaStr}</span>
    } else if (deltaStr.startsWith('-') || deltaStr === '↓') {
      return <span className="text-blue-500 font-mono">{deltaStr}</span>
    } else if (deltaStr === '↑') {
      return <span className="text-yellow-500 font-mono">{deltaStr}</span>
    }
    
    return <span className="font-mono">{deltaStr}</span>
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Metric</TableHead>
              <TableHead className="text-center">{namespaceA}</TableHead>
              <TableHead className="text-center">{namespaceB}</TableHead>
              <TableHead className="text-center">Delta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, index) => {
              // Section header row
              if (row.section !== undefined) {
                return (
                  <TableRow key={`section-${index}`} className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      {row.section || <Separator className="my-2" />}
                    </TableCell>
                  </TableRow>
                )
              }

              // Data row
              return (
                <TableRow key={`row-${index}`}>
                  <TableCell className="font-medium">
                    {row.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">
                            {row.metric}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{row.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.metric
                    )}
                  </TableCell>
                  <TableCell className={cn("text-center", getSeverityColor(row.severityA))}>
                    {renderValue(row.valueA, row.severityA)}
                  </TableCell>
                  <TableCell className={cn("text-center", getSeverityColor(row.severityB))}>
                    {renderValue(row.valueB, row.severityB)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderDelta(row.delta)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}