import { useEffect, useRef } from 'react'

interface TerminalPortalProps {
  terminalId: string
  className?: string
}

export function TerminalPortal({ terminalId, className = '' }: TerminalPortalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Find the terminal instance
    const terminalElement = document.getElementById(`terminal-${terminalId}`)
    if (!terminalElement) return

    // Move the terminal element to this container
    containerRef.current.appendChild(terminalElement)
    
    // Force the terminal to fit after moving
    setTimeout(() => {
      // Trigger a resize event to make xterm recalculate dimensions
      window.dispatchEvent(new Event('resize'))
      
      // Also try to find the terminal's fit addon and call fit()
      const terminalRefs = (window as any).__terminalRefs
      if (terminalRefs && terminalRefs[terminalId]) {
        // If we have access to the terminal instance, we could call fit here
        // But since we don't have direct access, triggering resize should work
      }
    }, 50)

    // Cleanup: move back to hidden container when unmounting
    return () => {
      const hiddenContainer = terminalElement.parentElement
      if (hiddenContainer && hiddenContainer !== containerRef.current) {
        // Terminal is already moved elsewhere
        return
      }
      
      // Find or create hidden container
      let hidden = document.getElementById('hidden-terminals')
      if (!hidden) {
        hidden = document.createElement('div')
        hidden.id = 'hidden-terminals'
        hidden.style.position = 'absolute'
        hidden.style.left = '-9999px'
        hidden.style.width = '1px'
        hidden.style.height = '1px'
        hidden.style.overflow = 'hidden'
        document.body.appendChild(hidden)
      }
      
      if (terminalElement.parentElement === containerRef.current) {
        hidden.appendChild(terminalElement)
      }
    }
  }, [terminalId])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}