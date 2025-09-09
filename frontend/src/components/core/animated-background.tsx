import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedBackgroundProps {
  children: React.ReactNode
  defaultValue?: string
  className?: string
  transition?: Transition
  enableHover?: boolean
  onValueChange?: (value: string | null) => void
}

export function AnimatedBackground({
  children,
  defaultValue,
  className,
  transition = {
    type: 'spring',
    bounce: 0.2,
    duration: 0.3,
  },
  enableHover = false,
  onValueChange,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(defaultValue || null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    if (defaultValue) {
      setActiveId(defaultValue)
    }
  }, [defaultValue])

  const handleClick = (id: string) => {
    setActiveId(id)
    onValueChange?.(id)
  }

  const handleMouseEnter = (id: string) => {
    if (enableHover) {
      setHoverId(id)
    }
  }

  const handleMouseLeave = () => {
    if (enableHover) {
      setHoverId(null)
    }
  }

  const getItemRect = (id: string) => {
    const item = itemRefs.current.get(id)
    const container = containerRef.current
    
    if (!item || !container) return null
    
    const itemRect = item.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    
    return {
      left: itemRect.left - containerRect.left,
      top: itemRect.top - containerRect.top,
      width: itemRect.width,
      height: itemRect.height,
    }
  }

  const currentId = hoverId || activeId
  const currentRect = currentId ? getItemRect(currentId) : null

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center p-1', className)}
    >
      <AnimatePresence>
        {currentRect && (
          <motion.div
            className="absolute bg-white dark:bg-zinc-700 rounded-md shadow-sm"
            initial={false}
            animate={{
              x: currentRect.left,
              y: currentRect.top,
              width: currentRect.width,
              height: currentRect.height,
            }}
            transition={transition}
            style={{
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>
      
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        
        const id = child.props['data-id'] || child.props.value
        
        return React.cloneElement(child as React.ReactElement<any>, {
          ref: (el: HTMLElement) => {
            if (el) itemRefs.current.set(id, el)
          },
          onClick: () => {
            handleClick(id)
            child.props.onClick?.()
          },
          onMouseEnter: () => {
            handleMouseEnter(id)
            child.props.onMouseEnter?.()
          },
          onMouseLeave: () => {
            handleMouseLeave()
            child.props.onMouseLeave?.()
          },
          style: {
            ...child.props.style,
            position: 'relative',
            zIndex: 1,
          },
          className: cn(
            child.props.className,
            'relative z-10'
          ),
          'data-active': activeId === id,
          'data-hover': hoverId === id,
        })
      })}
    </div>
  )
}