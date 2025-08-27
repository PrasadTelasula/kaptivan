import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { apiUrls } from '@/utils/api-urls'
import { Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface EmbeddedTerminalProps {
  cluster: string
  namespace: string
  podName: string
  containerName: string
  onConnectionChange?: (connected: boolean) => void
}

export function EmbeddedTerminal({
  cluster,
  namespace,
  podName,
  containerName,
  onConnectionChange
}: EmbeddedTerminalProps) {
  const { theme } = useTheme()
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const webLinksAddon = useRef<WebLinksAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Determine the effective theme
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }
  
  const effectiveTheme = getEffectiveTheme()

  const connectWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setIsConnecting(true)
    setError(null)

    const fullUrl = apiUrls.pods.execWs(cluster, namespace, podName, containerName)
    
    ws.current = new WebSocket(fullUrl)

    ws.current.onopen = () => {
      setIsConnecting(false)
      setIsConnected(true)
      setError(null)
      onConnectionChange?.(true)
      
      if (terminal.current) {
        terminal.current.focus()
        
        // Send initial terminal size
        const cols = terminal.current.cols
        const rows = terminal.current.rows
        if (cols && rows) {
          ws.current?.send(`resize:${cols},${rows}`)
        }
        
        // Send a carriage return to trigger the shell prompt
        setTimeout(() => {
          ws.current?.send('\r')
        }, 50)
      }
    }

    ws.current.onmessage = (event) => {
      if (!terminal.current) {
        return
      }

      if (event.data instanceof Blob) {
        // Handle binary data
        event.data.arrayBuffer().then(buffer => {
          const uint8Array = new Uint8Array(buffer)
          terminal.current?.write(uint8Array)
        })
      } else if (typeof event.data === 'string') {
        // Handle text data
        terminal.current.write(event.data)
      }
    }

    ws.current.onerror = (event) => {
      setError('Connection error occurred')
      setIsConnecting(false)
      setIsConnected(false)
      onConnectionChange?.(false)
    }

    ws.current.onclose = (event) => {
      setIsConnected(false)
      setIsConnecting(false)
      onConnectionChange?.(false)
      
      if (terminal.current && event.code !== 1000) {
        terminal.current.writeln('')
        terminal.current.writeln(`\x1b[31mConnection closed\x1b[0m`)
      }
    }
  }

  const initializeTerminal = () => {
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
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
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
    
    // Fit to container and send initial size
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit()
        // Send initial terminal size to backend
        const cols = terminal.current.cols
        const rows = terminal.current.rows
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(`resize:${cols},${rows}`)
        }
      }
    }, 100)

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
    // Initialize terminal first
    if (!terminalRef.current || terminal.current) {
      return
    }

    initializeTerminal()
    
    // Connect WebSocket after terminal is ready
    const timer = setTimeout(() => {
      connectWebSocket()
    }, 200)

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
      
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
    }
  }, [cluster, namespace, podName, containerName])

  // Handle parent container resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    })

    if (terminalRef.current?.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  if (isConnecting) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Connecting to {containerName}...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-destructive text-sm text-center">
          <div>Failed to connect</div>
          <div className="text-xs mt-1 text-destructive/70">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full bg-background"
      style={{ padding: '4px' }}
    />
  )
}