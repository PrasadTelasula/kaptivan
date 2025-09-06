import React from 'react'
import { Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface TimeRangeSelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const TIME_RANGES = [
  { value: 'last5m', label: 'Last 5 minutes' },
  { value: 'last15m', label: 'Last 15 minutes' },
  { value: 'last1h', label: 'Last 1 hour' },
  { value: 'last6h', label: 'Last 6 hours' },
  { value: 'last24h', label: 'Last 24 hours' },
  { value: 'last7d', label: 'Last 7 days' },
  { value: 'custom', label: 'Custom range' },
]

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  className
}) => {
  const currentRange = TIME_RANGES.find(r => r.value === value) || TIME_RANGES[1] // Default to last15m

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
        >
          <Clock className="h-4 w-4" />
          {currentRange.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={value === range.value ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onChange(range.value)
              }}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}