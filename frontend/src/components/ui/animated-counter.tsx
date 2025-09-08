import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}

export function AnimatedCounter({
  value,
  duration = 1000,
  className,
  prefix = "",
  suffix = ""
}: AnimatedCounterProps) {
  const countRef = useRef<HTMLSpanElement>(null)
  const previousValue = useRef(0)

  useEffect(() => {
    if (!countRef.current) return

    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart)
      
      if (countRef.current) {
        countRef.current.textContent = `${prefix}${currentValue}${suffix}`
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = endValue
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration, prefix, suffix])

  return (
    <span ref={countRef} className={cn("tabular-nums", className)}>
      {prefix}{value}{suffix}
    </span>
  )
}