import { memo, useRef, useEffect } from 'react'
import { EmbeddedTerminalFixed, type TerminalHandle } from './embedded-terminal-fixed'

interface TerminalWrapperProps {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
  onRef?: (ref: TerminalHandle | null) => void
}

// Memoized wrapper to prevent re-initialization when parent re-renders
export const TerminalWrapper = memo(({
  id,
  cluster,
  namespace,
  podName,
  containerName,
  onRef
}: TerminalWrapperProps) => {
  const hasInitialized = useRef(false)
  const terminalRef = useRef<TerminalHandle | null>(null)
  
  useEffect(() => {
    // Mark as initialized
    if (!hasInitialized.current) {
      hasInitialized.current = true
    }
  }, [])
  
  const handleRef = (ref: TerminalHandle | null) => {
    if (ref && !terminalRef.current) {
      terminalRef.current = ref
      onRef?.(ref)
    }
  }
  
  return (
    <EmbeddedTerminalFixed
      ref={handleRef}
      cluster={cluster}
      namespace={namespace}
      podName={podName}
      containerName={containerName}
    />
  )
}, (prevProps, nextProps) => {
  // Only re-render if the terminal identity changes
  return (
    prevProps.id === nextProps.id &&
    prevProps.cluster === nextProps.cluster &&
    prevProps.namespace === nextProps.namespace &&
    prevProps.podName === nextProps.podName &&
    prevProps.containerName === nextProps.containerName
  )
})

TerminalWrapper.displayName = 'TerminalWrapper'