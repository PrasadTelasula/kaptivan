import { useEffect, useRef, memo } from 'react'
import { terminalManager } from '@/services/terminal-manager'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface ManagedTerminalProps {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
  isVisible: boolean
}

export const ManagedTerminal = memo(({
  id,
  cluster,
  namespace,
  podName,
  containerName,
  isVisible
}: ManagedTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    if (!containerRef.current) return
    
    // Create terminal if it doesn't exist
    if (!terminalManager.hasTerminal(id)) {
      terminalManager.createTerminal(id)
    }
    
    // Attach/detach terminal based on visibility
    if (isVisible && containerRef.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        terminalManager.attachToDOM(id, containerRef.current!)
        
        // Connect WebSocket if not connected
        const terminal = terminalManager.getTerminal(id)
        if (terminal && !terminal.isConnected && !terminal.websocket) {
          const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${cluster}/${namespace}/${podName}/exec/ws?container=${containerName}`
          terminalManager.connectWebSocket(id, wsUrl)
        }
      }, 50)
      
      return () => clearTimeout(timeoutId)
    } else {
      terminalManager.detachFromDOM(id)
    }
  }, [id, cluster, namespace, podName, containerName, isVisible])
  
  // Handle window resize and initial resize when visible
  useEffect(() => {
    if (!isVisible) return
    
    const handleResize = () => {
      terminalManager.resizeTerminal(id)
    }
    
    // Trigger immediate resize when terminal becomes visible
    const resizeTimeout = setTimeout(() => {
      handleResize()
    }, 100)
    
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [id, isVisible])
  
  // Cleanup on unmount (but only if component is truly being destroyed)
  useEffect(() => {
    return () => {
      // Don't destroy on view switch, only on actual terminal close
      // The parent component should call terminalManager.destroyTerminal when closing
    }
  }, [])
  
  return (
    <div 
      ref={containerRef}
      className="w-full h-full"
      style={{
        display: isVisible ? 'block' : 'none',
        minHeight: '100px'
      }}
    />
  )
}, (prevProps, nextProps) => {
  // Only re-render if visibility or identity changes
  return (
    prevProps.id === nextProps.id &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.cluster === nextProps.cluster &&
    prevProps.namespace === nextProps.namespace &&
    prevProps.podName === nextProps.podName &&
    prevProps.containerName === nextProps.containerName
  )
})

ManagedTerminal.displayName = 'ManagedTerminal'