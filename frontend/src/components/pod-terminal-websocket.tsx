import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { X, Maximize2, Minimize2, Terminal as TerminalIcon, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiUrls } from '@/utils/api-urls'

interface PodTerminalWebSocketProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cluster: string
  namespace: string
  podName: string
  containers?: string[]
}

export function PodTerminalWebSocket({
  open,
  onOpenChange,
  cluster,
  namespace,
  podName,
  containers = []
}: PodTerminalWebSocketProps) {
  const { theme } = useTheme()
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const webLinksAddon = useRef<WebLinksAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const [selectedContainer, setSelectedContainer] = useState(containers[0] || '')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setIsConnecting(true)
    setError(null)

    const fullUrl = apiUrls.pods.execWs(cluster, namespace, podName, selectedContainer)
    
    ws.current = new WebSocket(fullUrl)

    ws.current.onopen = () => {
      setIsConnecting(false)
      setIsConnected(true)
      setError(null)
      
      if (terminal.current) {
        terminal.current.focus()
      }
    }

    ws.current.onmessage = (event) => {
      if (!terminal.current) {
        return
      }

      if (event.data instanceof Blob) {
        // Handle binary data - convert blob to array buffer then write the binary data directly
        event.data.arrayBuffer().then(buffer => {
          const uint8Array = new Uint8Array(buffer)
          // Write binary data directly to terminal
          terminal.current?.write(uint8Array)
        })
      } else if (typeof event.data === 'string') {
        // Check if it's a JSON control message (like resize events)
        // These shouldn't be displayed in the terminal
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'resize' || parsed.type === 'input') {
            // Ignore control messages - they're not meant to be displayed
            return
          }
        } catch {
          // Not JSON, treat as regular terminal output
        }
        
        // Handle text data
        terminal.current.write(event.data)
      }
    }

    ws.current.onerror = (event) => {
      setError('Connection error occurred')
      setIsConnecting(false)
      setIsConnected(false)
    }

    ws.current.onclose = (event) => {
      setIsConnected(false)
      setIsConnecting(false)
      
      if (terminal.current && event.code !== 1000) {
        terminal.current.writeln('')
        terminal.current.writeln(`\x1b[31mConnection closed\x1b[0m`)
      }
    }
  }

  const initializeTerminal = () => {
    // Prevent double initialization
    if (!terminalRef.current || terminal.current) {
      return
    }
    
    // Get the current effective theme
    const currentTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme

    // Terminal theme based on app theme
    const terminalTheme = currentTheme === 'dark' ? {
      background: '#020817',  // Matches dark mode background
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

    // Create terminal instance
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: terminalTheme,
      scrollback: 10000,
      convertEol: true,
    })

    // Add addons
    fitAddon.current = new FitAddon()
    webLinksAddon.current = new WebLinksAddon()
    terminal.current.loadAddon(fitAddon.current)
    terminal.current.loadAddon(webLinksAddon.current)

    // Open terminal in the DOM
    terminal.current.open(terminalRef.current)
    fitAddon.current.fit()

    // Don't write any initial messages - wait for the shell prompt

    // Handle terminal input
    terminal.current.onData((data) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(data)
      }
    })

    // Handle resize
    terminal.current.onResize(({ cols, rows }) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        // Send resize message to backend
        ws.current.send(`resize:${cols},${rows}`)
      }
    })
  }

  useEffect(() => {
    if (!open) {
      // Clean up when dialog closes
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
      if (terminal.current) {
        terminal.current.dispose()
        terminal.current = null
      }
      fitAddon.current = null
      webLinksAddon.current = null
      setIsConnected(false)
      setIsConnecting(false)
      setError(null)
      return
    }

    // Dialog is opening - initialize everything
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      initializeTerminal()
      
      // Wait a bit more for terminal to be fully ready
      requestAnimationFrame(() => {
        connectWebSocket()
      })
    })

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

  const handleClose = () => {
    // Close WebSocket connection
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }

    // Dispose terminal
    if (terminal.current) {
      terminal.current.dispose()
      terminal.current = null
    }

    fitAddon.current = null
    webLinksAddon.current = null
    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
    onOpenChange(false)
  }

  const handleContainerChange = (container: string) => {
    setSelectedContainer(container)
    
    // Close current connection
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }

    // Clear terminal
    if (terminal.current) {
      terminal.current.clear()
      terminal.current.writeln(`\x1b[33mSwitching to container: ${container}\x1b[0m`)
      terminal.current.writeln('')
    }

    // Reconnect with new container
    connectWebSocket()
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }, 100)
  }

  const clearTerminal = () => {
    terminal.current?.clear()
  }

  const reconnect = () => {
    if (ws.current) {
      ws.current.close()
    }
    connectWebSocket()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh]' : 'max-w-5xl w-full h-[700px]'} p-0 flex flex-col`}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="sr-only">Pod Terminal</DialogTitle>
          <DialogDescription className="sr-only">
            Terminal access to pod {podName} in namespace {namespace}
          </DialogDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TerminalIcon className="h-5 w-5" />
              <div>
                <div className="text-base font-semibold">Pod Terminal</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {podName} / {namespace} / {cluster}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Connection status */}
              <div className="flex items-center gap-2 text-xs">
                {isConnecting && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-muted-foreground">Connecting...</span>
                  </>
                )}
                {isConnected && (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-500">Connected</span>
                  </>
                )}
                {!isConnecting && !isConnected && (
                  <>
                    <div className="h-2 w-2 bg-red-500 rounded-full" />
                    <span className="text-red-500">Disconnected</span>
                  </>
                )}
              </div>
              
              {/* Container selector */}
              {containers.length > 1 && (
                <Select value={selectedContainer} onValueChange={handleContainerChange}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Select container" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map(container => (
                      <SelectItem key={container} value={container}>
                        {container}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Action buttons */}
              {!isConnected && !isConnecting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnect}
                >
                  Reconnect
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearTerminal}
                disabled={!terminal.current}
              >
                Clear
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
          <div 
            ref={terminalRef} 
            className="h-full w-full"
            style={{ padding: '8px' }}
          />
        </div>
        
        {error && (
          <div className="px-4 py-2 border-t bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        )}
        
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Terminal session • {isConnected ? 'Type to send input' : 'Not connected'}
          </div>
          <div className="text-muted-foreground">
            Ctrl+C to interrupt • Ctrl+D to exit
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}