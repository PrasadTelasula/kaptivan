import { useEffect, useRef, useState } from 'react'
import { EmbeddedTerminalFixed, type TerminalHandle } from './embedded-terminal-fixed'

interface Terminal {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
}

interface TerminalViewContainerProps {
  terminals: Terminal[]
  viewMode: 'tabs' | 'grid'
  activeTerminalId: string | null
  onTerminalRef: (id: string, ref: TerminalHandle | null) => void
}

export function TerminalViewContainer({
  terminals,
  viewMode,
  activeTerminalId,
  onTerminalRef
}: TerminalViewContainerProps) {
  const [initializedTerminals, setInitializedTerminals] = useState<Set<string>>(new Set())

  return (
    <div className="relative h-full w-full">
      {terminals.map((terminal, index) => {
        // Determine visibility based on view mode
        let isVisible = false
        if (viewMode === 'tabs') {
          isVisible = terminal.id === activeTerminalId
        } else if (viewMode === 'grid') {
          isVisible = index < 4 // Show first 4 in grid
        }

        // Mark as initialized if visible
        if (isVisible && !initializedTerminals.has(terminal.id)) {
          setInitializedTerminals(prev => new Set([...prev, terminal.id]))
        }

        // Only render if it has been visible at least once
        if (!initializedTerminals.has(terminal.id) && !isVisible) {
          return null
        }

        return (
          <div
            key={terminal.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              visibility: isVisible ? 'visible' : 'hidden',
              pointerEvents: isVisible ? 'auto' : 'none',
              zIndex: isVisible ? 1 : 0
            }}
          >
            <EmbeddedTerminalFixed
              ref={(ref) => onTerminalRef(terminal.id, ref)}
              cluster={terminal.cluster}
              namespace={terminal.namespace}
              podName={terminal.podName}
              containerName={terminal.containerName}
            />
          </div>
        )
      })}
    </div>
  )
}