import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { API_BASE_URL } from '@/config/constants'

interface PodTerminalTestProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cluster: string
  namespace: string
  podName: string
  container?: string
}

export function PodTerminalTest({
  open,
  onOpenChange,
  cluster,
  namespace,
  podName,
  container = 'nginx'
}: PodTerminalTestProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState('Disconnected')
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      setMessages([])
      return
    }
    
    // Add initial message
    setMessages(['Starting terminal initialization...'])

    // Initialize terminal
    if (terminalRef.current && !terminalInstance.current) {
      setMessages(prev => [...prev, 'Creating terminal instance...'])
      terminalInstance.current = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
        }
      })
      
      fitAddon.current = new FitAddon()
      terminalInstance.current.loadAddon(fitAddon.current)
      terminalInstance.current.open(terminalRef.current)
      fitAddon.current.fit()
      setMessages(prev => [...prev, 'Terminal opened'])
    }
    
    // Cleanup
    return () => {
      setMessages(prev => [...prev, 'Cleaning up...'])
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose()
        terminalInstance.current = null
      }
    }
  }, [open])

  const connectWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      setMessages(prev => [...prev, 'Already connected'])
      return
    }
    
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${cluster}/${namespace}/${podName}/exec/ws?container=${container}`
    setMessages(prev => [...prev, `Connecting to: ${wsUrl}`])
    
    try {
      ws.current = new WebSocket(wsUrl)
      
      ws.current.onopen = () => {
        setStatus('Connected')
        setMessages(prev => [...prev, 'WebSocket connected'])
        terminalInstance.current?.writeln('Connected!')
      }
      
      ws.current.onmessage = (event) => {
        if (event.data instanceof Blob) {
          // Convert blob to array buffer for proper binary handling
          event.data.arrayBuffer().then(buffer => {
            const uint8Array = new Uint8Array(buffer)
            const text = new TextDecoder().decode(buffer)
            setMessages(prev => [...prev, `Received: ${text.substring(0, 50)}`])
            // Write the binary data directly to terminal
            terminalInstance.current?.write(uint8Array)
          })
        } else {
          setMessages(prev => [...prev, `Received text: ${event.data}`])
          terminalInstance.current?.write(event.data)
        }
      }
      
      ws.current.onerror = (error) => {
        setStatus('Error')
        setMessages(prev => [...prev, `Error: ${error}`])
      }
      
      ws.current.onclose = () => {
        setStatus('Disconnected')
        setMessages(prev => [...prev, 'WebSocket closed'])
      }
      
      // Handle input
      if (terminalInstance.current) {
        terminalInstance.current.onData((data) => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(data)
            setMessages(prev => [...prev, `Sent: ${data}`])
          } else {
            setMessages(prev => [...prev, `Cannot send - not connected`])
          }
        })
      }
    } catch (error) {
      setMessages(prev => [...prev, `Error creating WebSocket: ${error}`])
      setStatus('Error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[600px] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>Terminal Test - {status}</DialogTitle>
          <DialogDescription>
            {podName} / {namespace} / {cluster}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex">
          <div className="w-1/2 bg-[#1e1e1e] p-2">
            <div ref={terminalRef} className="h-full" />
          </div>
          
          <div className="w-1/2 p-2 overflow-auto">
            <h3 className="font-bold mb-2">Debug Messages:</h3>
            <div className="text-xs font-mono space-y-1">
              {messages.map((msg, i) => (
                <div key={i} className="border-b pb-1">{msg}</div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="px-4 py-2 border-t flex gap-2">
          <Button onClick={connectWebSocket} variant="default">
            Connect WebSocket
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}