import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { io, Socket } from 'socket.io-client'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { X, Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react'
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

interface PodTerminalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cluster: string
  namespace: string
  podName: string
  containers?: string[]
}

export function PodTerminal({
  open,
  onOpenChange,
  cluster,
  namespace,
  podName,
  containers = []
}: PodTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const socket = useRef<Socket | null>(null)
  const [selectedContainer, setSelectedContainer] = useState(containers[0] || '')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && terminalRef.current && !terminal.current) {
      // Initialize terminal
      terminal.current = new Terminal({
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

      // Add addons
      fitAddon.current = new FitAddon()
      terminal.current.loadAddon(fitAddon.current)
      
      const webLinksAddon = new WebLinksAddon()
      terminal.current.loadAddon(webLinksAddon)

      // Open terminal in the DOM
      terminal.current.open(terminalRef.current)
      fitAddon.current.fit()

      // Connect to WebSocket
      connectToExec()

      // Handle terminal input
      terminal.current.onData((data) => {
        if (socket.current && socket.current.connected) {
          socket.current.emit('input', data)
        }
      })

      // Handle window resize
      const handleResize = () => {
        if (fitAddon.current) {
          fitAddon.current.fit()
          if (socket.current && socket.current.connected) {
            socket.current.emit('resize', {
              cols: terminal.current?.cols,
              rows: terminal.current?.rows
            })
          }
        }
      }
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [open, cluster, namespace, podName, selectedContainer])

  const connectToExec = () => {
    // Connect to backend WebSocket endpoint
    const wsUrl = 'http://localhost:8080'
    socket.current = io(wsUrl, {
      path: '/ws',
      transports: ['websocket'],
      query: {
        cluster,
        namespace,
        pod: podName,
        container: selectedContainer || containers[0] || ''
      }
    })

    socket.current.on('connect', () => {
      setIsConnected(true)
      setError(null)
      terminal.current?.writeln('\r\n\x1b[32mConnected to pod terminal\x1b[0m\r\n')
    })

    socket.current.on('output', (data: string) => {
      terminal.current?.write(data)
    })

    socket.current.on('error', (err: any) => {
      setError(err.message || 'Connection error')
      terminal.current?.writeln(`\r\n\x1b[31mError: ${err.message || 'Connection failed'}\x1b[0m\r\n`)
    })

    socket.current.on('disconnect', () => {
      setIsConnected(false)
      terminal.current?.writeln('\r\n\x1b[33mDisconnected from pod terminal\x1b[0m\r\n')
    })
  }

  const handleClose = () => {
    if (socket.current) {
      socket.current.disconnect()
      socket.current = null
    }
    if (terminal.current) {
      terminal.current.dispose()
      terminal.current = null
    }
    fitAddon.current = null
    setIsConnected(false)
    setError(null)
    onOpenChange(false)
  }

  const handleContainerChange = (container: string) => {
    setSelectedContainer(container)
    
    // Reconnect with new container
    if (socket.current) {
      socket.current.disconnect()
    }
    if (terminal.current) {
      terminal.current.clear()
    }
    connectToExec()
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }, 100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh]' : 'max-w-4xl w-full h-[600px]'} p-0 flex flex-col`}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TerminalIcon className="h-5 w-5" />
              <div>
                <DialogTitle className="text-base">Pod Terminal</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {podName} / {namespace} / {cluster}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
        
        <div className="flex-1 bg-[#1e1e1e] p-2 overflow-hidden">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded text-sm mb-2">
              {error}
            </div>
          )}
          <div 
            ref={terminalRef} 
            className="h-full w-full"
            style={{ padding: '4px' }}
          />
        </div>
        
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-muted-foreground">
            Press Ctrl+C to interrupt • Ctrl+D to exit
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}