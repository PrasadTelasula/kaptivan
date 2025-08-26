import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { API_BASE_URL } from '@/config/constants'
import { Loader2 } from 'lucide-react'

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
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const webLinksAddon = useRef<WebLinksAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setIsConnecting(true)
    setError(null)

    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${cluster}/${namespace}/${podName}/exec/ws`
    const params = new URLSearchParams()
    if (containerName) {
      params.append('container', containerName)
    }
    
    const fullUrl = params.toString() ? `${wsUrl}?${params}` : wsUrl
    
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

    // Create terminal instance
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#000000',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
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
      <div className="h-full flex items-center justify-center bg-black">
        <div className="flex items-center gap-2 text-green-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Connecting to {containerName}...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-red-400 text-sm text-center">
          <div>Failed to connect</div>
          <div className="text-xs mt-1 text-red-400/70">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full bg-black"
      style={{ padding: '4px' }}
    />
  )
}