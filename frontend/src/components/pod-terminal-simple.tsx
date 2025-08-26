import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { X, Maximize2, Minimize2, Terminal as TerminalIcon, Play, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { podsService } from '@/services/pods.service'

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
  const [selectedContainer, setSelectedContainer] = useState(containers[0] || '')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [command, setCommand] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

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

      // Open terminal in the DOM
      terminal.current.open(terminalRef.current)
      fitAddon.current.fit()

      // Write welcome message
      terminal.current.writeln('\x1b[32mPod Terminal\x1b[0m')
      terminal.current.writeln(`Connected to: ${podName}`)
      terminal.current.writeln(`Namespace: ${namespace}`)
      terminal.current.writeln(`Container: ${selectedContainer || 'default'}`)
      terminal.current.writeln('')
      terminal.current.writeln('Type a command and press Enter to execute.')
      terminal.current.writeln('Use arrow keys to navigate command history.')
      terminal.current.writeln('')

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
    }
  }, [open, cluster, namespace, podName, selectedContainer])

  const executeCommand = async () => {
    if (!command.trim() || isExecuting) return

    setIsExecuting(true)
    
    // Add to history
    setCommandHistory(prev => [...prev, command])
    setHistoryIndex(-1)

    // Display command in terminal
    terminal.current?.writeln(`\x1b[33m$ ${command}\x1b[0m`)

    try {
      // Execute command in pod
      const response = await podsService.execCommand(
        cluster,
        namespace,
        podName,
        selectedContainer || containers[0] || '',
        command.split(' ')
      )

      // Display output
      if (response.stdout) {
        terminal.current?.write(response.stdout)
      }
      if (response.stderr) {
        terminal.current?.write(`\x1b[31m${response.stderr}\x1b[0m`)
      }
      if (!response.stdout && !response.stderr) {
        terminal.current?.writeln('\x1b[90m(no output)\x1b[0m')
      }
    } catch (error: any) {
      terminal.current?.writeln(`\x1b[31mError: ${error.message || 'Command execution failed'}\x1b[0m`)
    } finally {
      terminal.current?.writeln('')
      setIsExecuting(false)
      setCommand('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCommand('')
      }
    }
  }

  const handleClose = () => {
    if (terminal.current) {
      terminal.current.dispose()
      terminal.current = null
    }
    fitAddon.current = null
    setCommand('')
    setCommandHistory([])
    setHistoryIndex(-1)
    onOpenChange(false)
  }

  const handleContainerChange = (container: string) => {
    setSelectedContainer(container)
    if (terminal.current) {
      terminal.current.clear()
      terminal.current.writeln(`\x1b[33mSwitched to container: ${container}\x1b[0m`)
      terminal.current.writeln('')
    }
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
              <Button
                variant="outline"
                size="sm"
                onClick={clearTerminal}
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
        
        <div className="flex-1 bg-[#1e1e1e] p-2 overflow-hidden flex flex-col">
          <div 
            ref={terminalRef} 
            className="flex-1 w-full"
            style={{ padding: '4px' }}
          />
          
          <div className="flex gap-2 mt-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command (e.g., ls -la, cat /etc/hostname, env)"
              className="flex-1 bg-background/90 border-muted"
              disabled={isExecuting}
              autoFocus
            />
            <Button 
              onClick={executeCommand}
              disabled={isExecuting || !command.trim()}
              size="sm"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Commands: {commandHistory.length} • Use ↑↓ for history
          </div>
          <div className="text-muted-foreground">
            Type 'help' for common commands
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}