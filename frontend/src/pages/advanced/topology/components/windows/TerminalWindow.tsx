import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, Terminal, FileText, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { apiUrls } from '@/utils/api-urls';

interface TerminalWindowProps {
  podName: string;
  namespace: string;
  context: string;
  containerName?: string;
  onClose: () => void;
  initialTab?: 'shell' | 'logs';
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  podName,
  namespace,
  context,
  containerName,
  onClose,
  initialTab = 'shell'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [logs, setLogs] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 0, y: 0 });
  const resizeHandleRef = useRef<string | null>(null);
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });

  // Prevent keyboard events from propagating when terminal is open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If the terminal window is open, stop all keyboard events from propagating
      if (windowRef.current && windowRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (windowRef.current && windowRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (windowRef.current && windowRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Add event listeners with capture phase to intercept events early
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    document.addEventListener('keyup', handleGlobalKeyUp, true);
    document.addEventListener('keypress', handleGlobalKeyPress, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
      document.removeEventListener('keyup', handleGlobalKeyUp, true);
      document.removeEventListener('keypress', handleGlobalKeyPress, true);
    };
  }, []);

  // Initialize XTerm when shell tab is active
  useEffect(() => {
    if (activeTab === 'shell' && terminalRef.current && !xtermRef.current) {

      // Create new terminal with exact same settings as working implementation
      const term = new XTerm({
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
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      
      // Open terminal in the DOM element
      term.open(terminalRef.current);
      
      // Fit after a small delay to ensure DOM is ready
      setTimeout(() => {
        if (fitAddon) {
          try {
            fitAddon.fit();
          } catch (err) {
            console.error('Error fitting terminal:', err);
          }
        }
      }, 50);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Focus the terminal after a small delay
      setTimeout(() => {
        term.focus();
        // Connect to WebSocket for shell
        connectToShell(term);
      }, 100);
    }
    
    // Cleanup only when component unmounts or tab changes away from shell
    return () => {
      if (activeTab !== 'shell' && xtermRef.current) {
        // Clean up disposables
        if ((xtermRef.current as any).inputDisposable) {
          (xtermRef.current as any).inputDisposable.dispose();
        }
        if ((xtermRef.current as any).resizeDisposable) {
          (xtermRef.current as any).resizeDisposable.dispose();
        }
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
        
        if (wsRef.current) {
          // Send exit command before closing
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send('exit\r');
            setTimeout(() => {
              wsRef.current?.send('\x04'); // Ctrl+D
              setTimeout(() => {
                wsRef.current?.close(1000, 'Terminal closed by user');
              }, 50);
            }, 50);
          } else {
            wsRef.current.close();
          }
          wsRef.current = null;
        }
      }
    };
  }, [activeTab]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        // Clean up disposables
        if ((xtermRef.current as any).inputDisposable) {
          (xtermRef.current as any).inputDisposable.dispose();
        }
        if ((xtermRef.current as any).resizeDisposable) {
          (xtermRef.current as any).resizeDisposable.dispose();
        }
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send('exit\r');
          wsRef.current.close(1000, 'Terminal window closed');
        } else {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, []);

  // Fetch logs when logs tab is active
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const connectToShell = (term: XTerm) => {
    const wsUrl = apiUrls.pods.execWs(context, namespace, podName, containerName);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    let isConnected = false;

    ws.onopen = () => {
      isConnected = true;
      term.focus();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Handle binary data - exact same as working implementation
        event.data.arrayBuffer().then(buffer => {
          const uint8Array = new Uint8Array(buffer);
          term.write(uint8Array);
        });
      } else if (typeof event.data === 'string') {
        // Filter out JSON control messages that shouldn't be displayed
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'resize' || parsed.type === 'input') {
            // Ignore control messages - they're not meant to be displayed
            return;
          }
        } catch {
          // Not JSON, treat as regular terminal output
        }
        term.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Only show error if we were previously connected
      if (isConnected) {
        term.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
      }
      isConnected = false;
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed with code:', event.code);
      // Only show close message for unexpected closures when we were connected
      if (event.code !== 1000 && event.code !== 1006 && isConnected) {
        term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
      }
      isConnected = false;
    };

    // Handle terminal input - send raw data, not JSON
    const disposable = term.onData((data) => {
      // Only log Enter key presses
      if (data === '\r' || data === '\n' || data === '\r\n') {
        console.log('Enter key detected:', JSON.stringify(data), 'bytes:', Array.from(new TextEncoder().encode(data)));
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle terminal resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`resize:${cols},${rows}`);
      }
    });
    
    // Store disposables for cleanup
    (term as any).inputDisposable = disposable;
    (term as any).resizeDisposable = resizeDisposable;
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      let url = apiUrls.pods.logs(context, namespace, podName, containerName);
      url += (url.includes('?') ? '&' : '?') + 'tailLines=1000';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || 'No logs available');
      } else {
        setLogs('Failed to fetch logs');
      }
    } catch (error) {
      setLogs(`Error fetching logs: ${error}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    
    if (handle === 'header') {
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      windowStartPos.current = { ...position };
    } else {
      resizeHandleRef.current = handle;
      resizeStartSize.current = { ...size };
      resizeStartPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - size.width, windowStartPos.current.x + deltaX)),
          y: Math.max(0, Math.min(window.innerHeight - size.height, windowStartPos.current.y + deltaY))
        });
      } else if (resizeHandleRef.current) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        
        let newWidth = resizeStartSize.current.width;
        let newHeight = resizeStartSize.current.height;
        let newX = position.x;
        let newY = position.y;

        if (resizeHandleRef.current.includes('right')) {
          newWidth = Math.max(400, resizeStartSize.current.width + deltaX);
        }
        if (resizeHandleRef.current.includes('left')) {
          newWidth = Math.max(400, resizeStartSize.current.width - deltaX);
          newX = position.x + deltaX;
        }
        if (resizeHandleRef.current.includes('bottom')) {
          newHeight = Math.max(300, resizeStartSize.current.height + deltaY);
        }
        if (resizeHandleRef.current.includes('top')) {
          newHeight = Math.max(300, resizeStartSize.current.height - deltaY);
          newY = position.y + deltaY;
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
        
        // Fit terminal to new size
        if (fitAddonRef.current) {
          setTimeout(() => fitAddonRef.current?.fit(), 0);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      resizeHandleRef.current = null;
    };

    if (isDragging || resizeHandleRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, position, size]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setPosition({ x: 0, y: 0 });
    }
    setIsMaximized(!isMaximized);
    
    // Fit terminal to new size
    if (fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 left-4 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors z-50"
        onClick={toggleMinimize}
      >
        <Terminal className="h-4 w-4 text-cyan-400" />
        <span className="text-sm text-slate-300">{podName}</span>
      </div>
    );
  }

  // Stop all events from propagating to the main app
  const handleStopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col overflow-hidden",
        isDragging && "cursor-move"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 9999,
      }}
      onClick={handleStopPropagation}
      onMouseDown={handleStopPropagation}
      onKeyDown={handleStopPropagation}
      onKeyUp={handleStopPropagation}
      onKeyPress={handleStopPropagation}
    >
      {/* Header */}
      <div
        className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between cursor-move select-none"
        onMouseDown={(e) => handleMouseDown(e, 'header')}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">
            {podName} - {containerName || 'default'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-slate-700"
            onClick={toggleMinimize}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-slate-700"
            onClick={toggleMaximize}
          >
            {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-slate-700 hover:text-red-400"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'shell' | 'logs')} className="flex-1 flex flex-col">
        <TabsList className="bg-slate-800 border-b border-slate-700 rounded-none h-10">
          <TabsTrigger value="shell" className="data-[state=active]:bg-slate-700">
            <Terminal className="h-3 w-3 mr-2" />
            Shell
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700">
            <FileText className="h-3 w-3 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shell" className="flex-1 m-0">
          <div 
            ref={terminalRef} 
            className="h-full bg-[#1e1e1e]" 
            onClick={() => xtermRef.current?.focus()}
            tabIndex={-1}
          />
        </TabsContent>

        <TabsContent value="logs" className="flex-1 m-0">
          <ScrollArea className="h-full bg-[#1e1e1e] p-4">
            {isLoadingLogs ? (
              <div className="text-slate-400">Loading logs...</div>
            ) : (
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{logs}</pre>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Resize handles */}
      <div
        className="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-cyan-400/20"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-cyan-400/20"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
      <div
        className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-cyan-400/20"
        onMouseDown={(e) => handleMouseDown(e, 'top')}
      />
      <div
        className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-cyan-400/20"
        onMouseDown={(e) => handleMouseDown(e, 'bottom')}
      />
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
        onMouseDown={(e) => handleMouseDown(e, 'top-left')}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
        onMouseDown={(e) => handleMouseDown(e, 'top-right')}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
        onMouseDown={(e) => handleMouseDown(e, 'bottom-left')}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
        onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
      />
    </div>
  );
};