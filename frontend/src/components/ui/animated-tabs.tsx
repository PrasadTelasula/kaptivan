import { AnimatedBackground } from '@/components/core/animated-background'
import { cn } from '@/lib/utils'
import React from 'react'

interface AnimatedTabsProps {
  tabs: Array<{
    value: string
    label: string
    content?: React.ReactNode
  }>
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

export function AnimatedTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue || tabs[0]?.value)

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value)
    }
  }, [value])

  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue)
    onValueChange?.(newValue)
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-row mb-4">
        <AnimatedBackground
          defaultValue={activeTab}
          className="rounded-lg bg-muted/50 p-1"
          transition={{
            type: 'spring',
            bounce: 0.2,
            duration: 0.3,
          }}
          enableHover
          onValueChange={(val) => val && handleTabChange(val)}
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              data-id={tab.value}
              type="button"
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors duration-300',
                'flex items-center justify-center',
                'hover:text-foreground',
                activeTab === tab.value
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </AnimatedBackground>
      </div>
      
      {tabs.map((tab) => (
        <div
          key={tab.value}
          className={cn(
            'mt-4',
            activeTab === tab.value ? 'block' : 'hidden'
          )}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}