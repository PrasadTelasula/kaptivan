import { createContext, useContext, useRef, ReactNode } from 'react'
import { PersistentTerminal } from './persistent-terminal'
import { type TerminalHandle } from './embedded-terminal-fixed'

interface TerminalInfo {
  id: string
  cluster: string
  namespace: string
  podName: string
  containerName: string
}

interface TerminalManagerContextType {
  getTerminalElement: (terminal: TerminalInfo) => ReactNode
  registerRef: (id: string, ref: TerminalHandle | null) => void
}

const TerminalManagerContext = createContext<TerminalManagerContextType | null>(null)

export function useTerminalManager() {
  const context = useContext(TerminalManagerContext)
  if (!context) {
    throw new Error('useTerminalManager must be used within TerminalManagerProvider')
  }
  return context
}

interface TerminalManagerProviderProps {
  children: ReactNode
  terminals: TerminalInfo[]
  onRef: (id: string, ref: TerminalHandle | null) => void
}

export function TerminalManagerProvider({ children, terminals, onRef }: TerminalManagerProviderProps) {
  const terminalInstances = useRef<Map<string, ReactNode>>(new Map())

  const getTerminalElement = (terminal: TerminalInfo) => {
    if (!terminalInstances.current.has(terminal.id)) {
      terminalInstances.current.set(
        terminal.id,
        <PersistentTerminal
          key={terminal.id}
          id={terminal.id}
          cluster={terminal.cluster}
          namespace={terminal.namespace}
          podName={terminal.podName}
          containerName={terminal.containerName}
          onRef={(ref) => onRef(terminal.id, ref)}
        />
      )
    }
    return terminalInstances.current.get(terminal.id)
  }

  const registerRef = (id: string, ref: TerminalHandle | null) => {
    onRef(id, ref)
  }

  return (
    <TerminalManagerContext.Provider value={{ getTerminalElement, registerRef }}>
      {/* Render all terminal instances in a hidden container */}
      <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        {terminals.map(terminal => (
          <div key={terminal.id} id={`terminal-instance-${terminal.id}`}>
            {getTerminalElement(terminal)}
          </div>
        ))}
      </div>
      {children}
    </TerminalManagerContext.Provider>
  )
}