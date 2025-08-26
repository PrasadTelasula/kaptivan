import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { API_BASE_URL } from '@/config/constants'

interface EmbeddedTerminalFixedProps {
  cluster: string
  namespace: string
  podName: string
  containerName: string
}

export interface TerminalHandle {
  cleanup: () => void
}

export const EmbeddedTerminalFixed = forwardRef<TerminalHandle, EmbeddedTerminalFixedProps>(({
  cluster,
  namespace,
  podName,
  containerName
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const [isReady, setIsReady] = useState(false)
  const initializingRef = useRef(false)

  const cleanup = () => {
    console.log('Cleaning up terminal for:', containerName)
    initializingRef.current = false
    
    // Send exit command before closing to properly terminate shell
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send('exit\r')
      // Give it a moment to process
      setTimeout(() => {
        if (ws.current) {
          ws.current.close(1000, 'Terminal closed by user')
          ws.current = null
        }
      }, 100)
    } else if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    
    if (terminalInstance.current) {
      terminalInstance.current.dispose()
      terminalInstance.current = null
    }
    fitAddon.current = null
  }

  useImperativeHandle(ref, () => ({
    cleanup
  }), [containerName])

  useEffect(() => {
    // Clean up only on unmount, not when dependencies change
    return () => {
      cleanup()
    }
  }, []) // Empty deps to only cleanup on unmount

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current || initializingRef.current) {
      return
    }

    // Mark as initializing to prevent double initialization
    initializingRef.current = true

    // Check if element is visible
    const checkVisibilityAndInit = () => {
      if (!terminalRef.current || terminalInstance.current) return
      
      const rect = terminalRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // Not visible yet, check again
        requestAnimationFrame(checkVisibilityAndInit)
        return
      }

      // Element is visible, initialize terminal  
      console.log('Initializing terminal for:', containerName)
      
      // Clear the container first
      terminalRef.current.innerHTML = ''
      
      // Create terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
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
      
      // Open terminal in DOM
      terminal.open(terminalRef.current)
      fitAddon.current.fit()
      
      // Connect WebSocket
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${cluster}/${namespace}/${podName}/exec/ws?container=${containerName}`
      console.log('Connecting to WebSocket:', wsUrl)
      
      const websocket = new WebSocket(wsUrl)
      ws.current = websocket
      
      websocket.onopen = () => {
        console.log('WebSocket connected successfully')
        terminal.focus()
        setIsReady(true)
      }
      
      websocket.onmessage = (event) => {
        if (event.data instanceof Blob) {
          event.data.arrayBuffer().then(buffer => {
            const uint8Array = new Uint8Array(buffer)
            terminal.write(uint8Array)
          })
        } else if (typeof event.data === 'string') {
          terminal.write(event.data)
        }
      }
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        terminal.writeln('\r\n\x1b[31mConnection error\x1b[0m')
      }
      
      websocket.onclose = (event) => {
        console.log('WebSocket closed with code:', event.code)
        if (event.code !== 1000) {
          terminal.writeln('\r\n\x1b[31mConnection closed\x1b[0m')
        }
      }
      
      // Handle terminal input
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
    }

    // Start visibility check
    requestAnimationFrame(checkVisibilityAndInit)
  }, [cluster, namespace, podName, containerName])
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        fitAddon.current.fit()
      }
    }
    
    window.addEventListener('resize', handleResize)
    
    // Also use ResizeObserver for more reliable resize detection
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }
    
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [])
  
  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full p-1"
      style={{ 
        backgroundColor: '#1e1e1e',
        minHeight: '200px' // Ensure minimum height for terminal
      }}
    />
  )
})