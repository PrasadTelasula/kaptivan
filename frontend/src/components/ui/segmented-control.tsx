import * as React from "react"
import { cn } from "@/lib/utils"

interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: {
    value: string
    label: string
    icon?: React.ReactNode
  }[]
  className?: string
}

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className
}: SegmentedControlProps) {
  return (
    <div className={cn(
      "inline-flex p-1 bg-muted rounded-lg",
      className
    )}>
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5",
            "text-sm font-medium ring-offset-background transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            index > 0 && "ml-1"
          )}
        >
          {option.icon && (
            <span className="mr-2">{option.icon}</span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  )
}