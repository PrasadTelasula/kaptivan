import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { API_BASE_URL } from '@/config/constants'

interface EmbeddedTerminalSimpleProps {
  cluster: string
  namespace: string
  podName: string
  containerName: string
}

export function EmbeddedTerminalSimple({
  cluster,
  namespace,
  podName,
  containerName
}: EmbeddedTerminalSimpleProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !terminalRef.current) {
      return
    }
    
    initialized.current = true
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      // Create terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        theme: {
          background: '#1e1e1e',
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
      
      terminalInstance.current = terminal
      fitAddon.current = new FitAddon()
      terminal.loadAddon(fitAddon.current)
      
      // Open terminal
      terminal.open(terminalRef.current)
      fitAddon.current.fit()
      
      // Wait for terminal to be ready then connect
      requestAnimationFrame(() => {
        // Connect WebSocket
        const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${cluster}/${namespace}/${podName}/exec/ws?container=${containerName}`
        console.log('Connecting to:', wsUrl)
        
        const websocket = new WebSocket(wsUrl)
        ws.current = websocket
        
        websocket.onopen = () => {
          console.log('WebSocket connected')
          // Don't write any initial message or send commands
          // Let the shell prompt come naturally
          terminal.focus()
        }
        
        websocket.onmessage = (event) => {
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then(buffer => {
              const uint8Array = new Uint8Array(buffer)
              terminal.write(uint8Array)
            })
          } else {
            terminal.write(event.data)
          }
        }
        
        websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          terminal.writeln('\r\nConnection error')
        }
        
        websocket.onclose = () => {
          console.log('WebSocket closed')
          terminal.writeln('\r\nConnection closed')
        }
        
        // Handle input
        terminal.onData((data) => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(data)
          }
        })
        
        // Handle resize
        terminal.onResize(({ cols, rows }) => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(`resize:${cols},${rows}`)
          }
        })
      })
    })
    
    // Cleanup
    return () => {
      console.log('Cleaning up terminal')
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose()
        terminalInstance.current = null
      }
      fitAddon.current = null
      initialized.current = false
    }
  }, [cluster, namespace, podName, containerName])
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full"
      style={{ backgroundColor: '#1e1e1e', padding: '8px' }}
    />
  )
}