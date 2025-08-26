import { useRef, useEffect, useState, memo } from 'react'
import { EmbeddedTerminalFixed, type TerminalHandle } from './embedded-terminal-fixed'

// Global terminal instances storage
const terminalInstances = new Map<string, { ref: TerminalHandle | null, initialized: boolean }>()

// Expose to window for cleanup purposes
if (typeof window !== 'undefined') {
  (window as any).__terminalInstances = terminalInstances
}

interface TerminalContainerProps {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
  isVisible: boolean
  onRef?: (ref: TerminalHandle | null) => void
}

export const TerminalContainer = memo(({
  id,
  cluster,
  namespace,
  podName,
  containerName,
  isVisible,
  onRef
}: TerminalContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    // Check if this terminal ID has been initialized before
    const existing = terminalInstances.get(id)
    if (!existing) {
      terminalInstances.set(id, { ref: null, initialized: false })
    }
    
    // Only render if visible and not already initialized
    if (isVisible && !terminalInstances.get(id)?.initialized) {
      setShouldRender(true)
      terminalInstances.set(id, { ...terminalInstances.get(id)!, initialized: true })
    } else if (terminalInstances.get(id)?.initialized) {
      setShouldRender(true)
    }
  }, [id, isVisible])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't cleanup terminal instances - they should persist
    }
  }, [id])

  return (
    <div 
      ref={containerRef}
      className="h-full w-full"
      style={{ 
        display: isVisible ? 'block' : 'none',
        height: '100%',
        width: '100%'
      }}
    >
      {shouldRender && (
        <EmbeddedTerminalFixed
          ref={(ref) => {
            const existing = terminalInstances.get(id)
            if (ref && existing && !existing.ref) {
              existing.ref = ref
              terminalInstances.set(id, { ...existing, ref })
              onRef?.(ref)
            }
          }}
          cluster={cluster}
          namespace={namespace}
          podName={podName}
          containerName={containerName}
        />
      )}
    </div>
  )
})