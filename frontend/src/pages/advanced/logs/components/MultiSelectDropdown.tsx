import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface MultiSelectDropdownProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  disabled?: boolean
  className?: string
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyText = 'No items found.',
  loading = false,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([])
    } else {
      onChange([...options])
    }
  }

  const isAllSelected = selected.length === options.length && options.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || (options.length === 0 && !loading)}
          className={cn(
            'w-full justify-between font-normal',
            !selected.length && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : selected.length > 0 ? (
              <div className="flex items-center gap-1 overflow-hidden">
                {selected.length <= 2 ? (
                  selected.map(item => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="h-5 px-1 text-xs"
                    >
                      {item}
                    </Badge>
                  ))
                ) : (
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-xs"
                  >
                    {selected.length} selected
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-xs">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {selected.length > 0 && !disabled && (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.length > 0 && (
              <CommandGroup>
                {options.length > 1 && (
                  <CommandItem
                    value="select-all"
                    onSelect={handleSelectAll}
                    className="font-medium"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isAllSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </CommandItem>
                )}
                {filteredOptions.map(option => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected.includes(option) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}