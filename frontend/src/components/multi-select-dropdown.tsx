import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Option {
  value: string
  label: string
  category?: string
}

interface MultiSelectDropdownProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  className
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([])
    } else {
      onChange(options.map(o => o.value))
    }
  }

  const clearAll = () => {
    onChange([])
  }

  // Group options by category
  const groupedOptions = filteredOptions.reduce((acc, option) => {
    const category = option.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(option)
    return acc
  }, {} as Record<string, Option[]>)

  const selectedLabels = selected
    .map(value => options.find(o => o.value === value)?.label)
    .filter(Boolean)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 justify-between text-xs", className)}
        >
          <span className="truncate">
            {selected.length === 0 
              ? placeholder 
              : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} selected`}
          </span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Resource Types</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {selected.length}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={toggleAll}
            >
              {selected.length === options.length ? 'Deselect All' : 'Select All'}
            </Button>
            {selected.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={clearAll}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
              <div key={category} className="mb-3">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {category}
                </div>
                {categoryOptions.map(option => (
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      selected.includes(option.value) && "bg-accent/50"
                    )}
                    onClick={() => toggleOption(option.value)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      selected.includes(option.value) 
                        ? "bg-primary border-primary" 
                        : "border-muted-foreground/50"
                    )}>
                      {selected.includes(option.value) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {selected.length > 0 && (
          <div className="p-2 border-t">
            <div className="text-xs text-muted-foreground">
              Selected: {selectedLabels.slice(0, 3).join(', ')}
              {selected.length > 3 && ` +${selected.length - 3} more`}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}