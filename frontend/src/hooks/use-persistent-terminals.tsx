import { useRef, useEffect } from 'react'
import { type TerminalHandle } from '@/components/embedded-terminal-fixed'

interface TerminalInstance {
  element: HTMLDivElement | null
  handle: TerminalHandle | null
}

export function usePersistentTerminals() {
  const instances = useRef<Map<string, TerminalInstance>>(new Map())

  const registerTerminal = (id: string, element: HTMLDivElement | null, handle: TerminalHandle | null) => {
    if (!instances.current.has(id)) {
      instances.current.set(id, { element, handle })
    } else {
      const instance = instances.current.get(id)!
      if (element) instance.element = element
      if (handle) instance.handle = handle
    }
  }

  const moveTerminal = (id: string, targetContainer: HTMLDivElement | null) => {
    if (!targetContainer) return
    
    const instance = instances.current.get(id)
    if (instance?.element) {
      // Move the terminal DOM element to the new container
      targetContainer.appendChild(instance.element)
    }
  }

  const cleanupTerminal = (id: string) => {
    const instance = instances.current.get(id)
    if (instance) {
      instance.handle?.cleanup()
      instances.current.delete(id)
    }
  }

  return {
    registerTerminal,
    moveTerminal,
    cleanupTerminal,
    instances: instances.current
  }
}