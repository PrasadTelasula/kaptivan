import { useRef, useEffect, useState, memo } from 'react'
import { EmbeddedTerminalFixed, type TerminalHandle } from './embedded-terminal-fixed'

interface PersistentTerminalProps {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
  onRef?: (ref: TerminalHandle | null) => void
}

// Memoize to prevent re-renders when parent changes
export const PersistentTerminal = memo(({
  id,
  cluster,
  namespace,
  podName,
  containerName,
  onRef
}: PersistentTerminalProps) => {
  const terminalRef = useRef<TerminalHandle | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Initialize only once
    setIsInitialized(true)
  }, [])

  if (!isInitialized) {
    return null
  }

  return (
    <EmbeddedTerminalFixed
      ref={(ref) => {
        if (ref && !terminalRef.current) {
          terminalRef.current = ref
          onRef?.(ref)
        }
      }}
      cluster={cluster}
      namespace={namespace}
      podName={podName}
      containerName={containerName}
    />
  )
})