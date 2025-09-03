import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  websocket: WebSocket | null
  container: HTMLElement | null
  isConnected: boolean
}

class TerminalManager {
  private static instance: TerminalManager
  private terminals: Map<string, TerminalInstance> = new Map()
  private syncInputEnabled: boolean = false
  private syncTerminalIds: Set<string> = new Set()
  private inputHandlers: Map<string, any> = new Map()
  
  private constructor() {}
  
  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager()
    }
    return TerminalManager.instance
  }
  
  hasTerminal(id: string): boolean {
    return this.terminals.has(id)
  }
  
  getTerminal(id: string): TerminalInstance | undefined {
    return this.terminals.get(id)
  }
  
  createTerminal(id: string, theme?: 'light' | 'dark' | 'system'): TerminalInstance {
    // If terminal already exists, return it
    const existing = this.terminals.get(id)
    if (existing) {
      return existing
    }
    
    // Determine effective theme
    let effectiveTheme = theme || 'system'
    if (effectiveTheme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    // Terminal theme based on app theme
    const terminalTheme = effectiveTheme === 'dark' ? {
      background: '#18181b',  // Changed to neutral gray (zinc-900)
      foreground: '#e2e8f0',
      cursor: '#e2e8f0',
      black: '#1e293b',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f8fafc',
      brightBlack: '#475569',
      brightRed: '#f87171',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f1f5f9'
    } : {
      background: '#ffffff',
      foreground: '#1e293b',
      cursor: '#1e293b',
      black: '#f1f5f9',
      red: '#dc2626',
      green: '#059669',
      yellow: '#d97706',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#1e293b',
      brightBlack: '#cbd5e1',
      brightRed: '#ef4444',
      brightGreen: '#10b981',
      brightYellow: '#f59e0b',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#0f172a'
    }
    
    // Create new terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: terminalTheme,
      scrollback: 10000,
      convertEol: true,
    })
    
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    
    const instance: TerminalInstance = {
      terminal,
      fitAddon,
      websocket: null,
      container: null,
      isConnected: false
    }
    
    this.terminals.set(id, instance)
    return instance
  }
  
  attachToDOM(id: string, container: HTMLElement): void {
    const instance = this.terminals.get(id)
    if (!instance) return
    
    // If already attached to the same container, just ensure it's visible
    if (instance.container === container) {
      if (instance.terminal.element && instance.terminal.element.parentNode === container) {
        // Already attached to this container, just fit
        instance.fitAddon.fit()
        return
      }
    }
    
    // If already attached to a different container, move it
    if (instance.container && instance.container !== container) {
      // Don't detach, just move the element
      if (instance.terminal.element) {
        container.appendChild(instance.terminal.element)
        instance.container = container
        instance.fitAddon.fit()
        return
      }
    }
    
    // First time attachment
    if (!instance.terminal.element) {
      // Terminal hasn't been opened yet
      instance.terminal.open(container)
      instance.container = container
      instance.fitAddon.fit()
    } else {
      // Terminal was opened before but detached, reattach it
      container.appendChild(instance.terminal.element)
      instance.container = container
      instance.fitAddon.fit()
    }
  }
  
  detachFromDOM(id: string): void {
    const instance = this.terminals.get(id)
    if (!instance || !instance.container) return
    
    // Keep terminal alive but detach from DOM
    // This preserves the terminal buffer and state
    if (instance.terminal.element && instance.terminal.element.parentNode) {
      instance.terminal.element.parentNode.removeChild(instance.terminal.element)
    }
    instance.container = null
  }
  
  connectWebSocket(id: string, url: string): void {
    const instance = this.terminals.get(id)
    if (!instance) return
    
    // Don't reconnect if already connected or connecting
    if (instance.websocket?.readyState === WebSocket.OPEN || 
        instance.websocket?.readyState === WebSocket.CONNECTING) {
      console.log(`Terminal ${id} already connected/connecting, skipping reconnection`)
      return
    }
    
    // Close existing connection if any
    if (instance.websocket) {
      instance.websocket.close()
    }
    
    const websocket = new WebSocket(url)
    instance.websocket = websocket
    
    websocket.onopen = () => {
      instance.isConnected = true
      instance.terminal.focus()
    }
    
    websocket.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Handle binary data
        event.data.arrayBuffer().then(buffer => {
          const uint8Array = new Uint8Array(buffer)
          instance.terminal.write(uint8Array)
        })
      } else if (typeof event.data === 'string') {
        // Filter out JSON control messages that shouldn't be displayed
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'resize' || parsed.type === 'input') {
            // Ignore control messages - they're not meant to be displayed
            return
          }
        } catch {
          // Not JSON, treat as regular terminal output
        }
        instance.terminal.write(event.data)
      }
    }
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      // Only show error if we were previously connected
      if (instance.isConnected) {
        instance.terminal.write('\r\n\x1b[31mConnection error\x1b[0m\r\n')
      }
      instance.isConnected = false
    }
    
    websocket.onclose = (event) => {
      console.log('WebSocket closed with code:', event.code)
      // Only show close message for unexpected closures when we were connected
      if (event.code !== 1000 && event.code !== 1006 && instance.isConnected) {
        instance.terminal.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n')
      }
      instance.isConnected = false
    }
    
    // Handle terminal input - send raw data, not JSON
    const disposable = instance.terminal.onData((data) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(data)
      }
      
      // If sync input is enabled and this terminal is in the sync group, broadcast to others
      if (this.syncInputEnabled && this.syncTerminalIds.has(id)) {
        this.syncTerminalIds.forEach(terminalId => {
          if (terminalId !== id) { // Don't send to self
            const otherInstance = this.terminals.get(terminalId)
            if (otherInstance?.websocket?.readyState === WebSocket.OPEN) {
              otherInstance.websocket.send(data)
            }
          }
        })
      }
    })
    
    // Handle terminal resize events
    const resizeDisposable = instance.terminal.onResize(({ cols, rows }) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(`resize:${cols},${rows}`)
      }
    })
    
    // Store disposables for cleanup
    ;(instance as any).inputDisposable = disposable
    ;(instance as any).resizeDisposable = resizeDisposable
    this.inputHandlers.set(id, disposable)
  }
  
  resizeTerminal(id: string): void {
    const instance = this.terminals.get(id)
    if (!instance || !instance.container) return
    
    try {
      instance.fitAddon.fit()
      
      // Send resize command to backend if connected (in format backend expects)
      if (instance.websocket?.readyState === WebSocket.OPEN) {
        const dimensions = instance.fitAddon.proposeDimensions()
        if (dimensions) {
          instance.websocket.send(`resize:${dimensions.cols},${dimensions.rows}`)
        }
      }
    } catch (error) {
      // Ignore resize errors when terminal is being destroyed
      if (this.terminals.has(id)) {
        console.error(`Error resizing terminal ${id}:`, error)
      }
    }
  }
  
  sendCommand(id: string, command: string): void {
    const instance = this.terminals.get(id)
    if (!instance || !instance.websocket || instance.websocket.readyState !== WebSocket.OPEN) {
      return
    }
    
    // Send the command with a newline to execute it
    instance.websocket.send(command + '\r')
  }
  
  broadcastCommand(command: string, terminalIds?: string[]): void {
    // If no specific IDs provided, broadcast to all terminals
    const targetIds = terminalIds || Array.from(this.terminals.keys())
    
    targetIds.forEach(id => {
      this.sendCommand(id, command)
    })
  }
  
  getConnectedTerminals(): string[] {
    const connected: string[] = []
    this.terminals.forEach((instance, id) => {
      if (instance.isConnected && instance.websocket?.readyState === WebSocket.OPEN) {
        connected.push(id)
      }
    })
    return connected
  }
  
  enableSyncInput(terminalIds?: string[]): void {
    this.syncInputEnabled = true
    if (terminalIds) {
      this.syncTerminalIds = new Set(terminalIds)
    } else {
      // If no specific IDs, sync all terminals
      this.syncTerminalIds = new Set(this.terminals.keys())
    }
  }
  
  disableSyncInput(): void {
    this.syncInputEnabled = false
    this.syncTerminalIds.clear()
  }
  
  isSyncInputEnabled(): boolean {
    return this.syncInputEnabled
  }
  
  updateSyncTerminals(terminalIds: string[]): void {
    this.syncTerminalIds = new Set(terminalIds)
  }
  
  updateFontSize(id: string, fontSize: number): void {
    const instance = this.terminals.get(id)
    if (!instance) return
    
    // Update the terminal's font size
    instance.terminal.options.fontSize = fontSize
    
    // Trigger a fit to adjust to the new font size
    if (instance.fitAddon && instance.container) {
      instance.fitAddon.fit()
    }
  }
  
  focusTerminal(id: string): void {
    const instance = this.terminals.get(id)
    if (instance?.terminal) {
      instance.terminal.focus()
    }
  }
  
  destroyTerminal(id: string): void {
    const instance = this.terminals.get(id)
    if (!instance) {
      console.log(`Terminal ${id} not found, nothing to destroy`)
      return
    }
    
    // Send exit signals before closing WebSocket
    if (instance.websocket?.readyState === WebSocket.OPEN) {
      console.log(`Destroying terminal ${id} - sending termination signals`)
      
      // Send multiple termination signals immediately to ensure shell process exits
      // 1. Send Ctrl+C to interrupt any running command
      instance.websocket.send('\x03')
      
      // 2. Send Ctrl+D (EOF) to signal end of input
      instance.websocket.send('\x04')
      
      // 3. Send exit command as fallback
      instance.websocket.send('exit\r')
      
      // 4. Send another Ctrl+D for good measure
      instance.websocket.send('\x04')
      
      // 5. Close the WebSocket connection immediately
      instance.websocket.close(1000, 'Terminal closed by user')
    } else if (instance.websocket?.readyState === WebSocket.CONNECTING) {
      // If still connecting, abort the connection
      console.log(`Terminal ${id} still connecting, aborting connection`)
      instance.websocket.close()
    } else if (instance.websocket) {
      instance.websocket.close()
    }
    
    // Clean up disposables
    if ((instance as any).inputDisposable) {
      (instance as any).inputDisposable.dispose()
    }
    
    // Detach from DOM
    this.detachFromDOM(id)
    
    // Dispose terminal
    instance.terminal.dispose()
    
    // Remove from map
    this.terminals.delete(id)
  }
  
  getAllTerminalIds(): string[] {
    return Array.from(this.terminals.keys())
  }
  
  updateTheme(theme?: 'dark' | 'light'): void {
    // Determine effective theme
    let effectiveTheme = theme
    if (!effectiveTheme) {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    // Terminal theme based on app theme
    const terminalTheme = effectiveTheme === 'dark' ? {
      background: '#18181b',  // Changed to neutral gray (zinc-900)
      foreground: '#e2e8f0',
      cursor: '#e2e8f0',
      black: '#1e293b',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f8fafc',
      brightBlack: '#475569',
      brightRed: '#f87171',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f1f5f9'
    } : {
      background: '#ffffff',
      foreground: '#1e293b',
      cursor: '#1e293b',
      black: '#f1f5f9',
      red: '#dc2626',
      green: '#059669',
      yellow: '#d97706',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#1e293b',
      brightBlack: '#cbd5e1',
      brightRed: '#ef4444',
      brightGreen: '#10b981',
      brightYellow: '#f59e0b',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#0f172a'
    }
    
    // Update theme for all existing terminals
    this.terminals.forEach(instance => {
      if (instance.terminal) {
        instance.terminal.options.theme = terminalTheme
      }
    })
  }
  
  closeAllTerminals(): void {
    // Send exit command to all connected terminals first
    this.terminals.forEach((instance, id) => {
      if (instance.websocket?.readyState === WebSocket.OPEN) {
        // Send exit command to gracefully terminate the shell
        instance.websocket.send('exit\r')
        // Give it a moment to process
        setTimeout(() => {
          // Send Ctrl+D (EOF) as backup
          instance.websocket.send('\x04')
          // Then close the WebSocket
          setTimeout(() => {
            instance.websocket?.close(1000, 'User closed all terminals')
          }, 100)
        }, 100)
      }
    })
    
    // Clean up all terminals after giving time for graceful shutdown
    setTimeout(() => {
      const terminalIds = Array.from(this.terminals.keys())
      terminalIds.forEach(id => {
        this.destroyTerminal(id)
      })
    }, 500)
  }
}

export const terminalManager = TerminalManager.getInstance()