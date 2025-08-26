import React, { useRef, useEffect, useState } from 'react';
import { X, Maximize2, Minimize2, Terminal, FileText, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { terminalManager } from '@/services/terminal-manager';

interface TerminalWindowProps {
  podName: string;
  namespace: string;
  context: string;
  containerName?: string;
  onClose: () => void;
  initialTab?: 'shell' | 'logs';
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowStartPos = useRef({ x: 0, y: 0 });
  const resizeHandleRef = useRef<string | null>(null);
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  
  // Generate stable terminal ID using useMemo to prevent reconnections
  const terminalId = React.useMemo(
    () => `${podName}-${containerName || 'default'}-${Date.now()}`,
    [podName, containerName] // Only regenerate if pod or container changes
  );

  // Initialize terminal only once on mount
  useEffect(() => {
    // Create terminal if it doesn't exist
    if (!terminalManager.hasTerminal(terminalId)) {
      terminalManager.createTerminal(terminalId);
      
      // Connect WebSocket only once when creating
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${context}/${namespace}/${podName}/exec/ws${containerName ? `?container=${containerName}` : ''}`;
      terminalManager.connectWebSocket(terminalId, wsUrl);
    }
  }, [terminalId, context, namespace, podName, containerName]);

  // Attach terminal to DOM once container is ready
  useEffect(() => {
    if (terminalContainerRef.current && terminalManager.hasTerminal(terminalId)) {
      // Attach terminal to DOM (only happens once since container is always mounted)
      terminalManager.attachToDOM(terminalId, terminalContainerRef.current);
      
      // Initial resize
      setTimeout(() => {
        terminalManager.resizeTerminal(terminalId);
      }, 100);
    }
  }, [terminalId]);

  // Handle tab switching - only focus when shell tab is active
  useEffect(() => {
    if (activeTab === 'shell' && terminalManager.hasTerminal(terminalId)) {
      setTimeout(() => {
        terminalManager.focusTerminal(terminalId);
        terminalManager.resizeTerminal(terminalId);
      }, 50);
    }
  }, [activeTab, terminalId]);

  // Handle window resize
  useEffect(() => {
    if (!isVisible()) return;
    
    const handleResize = () => {
      if (activeTab === 'shell') {
        terminalManager.resizeTerminal(terminalId);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [terminalId, activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalManager.destroyTerminal(terminalId);
    };
  }, [terminalId]);

  // Fetch logs when logs tab is active
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const containerParam = containerName ? `&container=${containerName}` : '';
      const response = await fetch(`${API_BASE_URL}/api/v1/pods/${context}/${namespace}/${podName}/logs?tailLines=1000${containerParam}`);
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

  const isVisible = () => !isMinimized;

  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation(); // Only stop propagation to ReactFlow
    
    if (handle === 'header') {
      e.preventDefault();
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      windowStartPos.current = { ...position };
    } else {
      e.preventDefault();
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
        
        // Resize terminal
        if (activeTab === 'shell') {
          setTimeout(() => terminalManager.resizeTerminal(terminalId), 0);
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
  }, [isDragging, position, size, activeTab, terminalId]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setPosition({ x: 0, y: 0 });
    }
    setIsMaximized(!isMaximized);
    
    // Resize terminal
    if (activeTab === 'shell') {
      setTimeout(() => terminalManager.resizeTerminal(terminalId), 100);
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

        <TabsContent value="shell" className="flex-1 m-0" forceMount>
          <div 
            ref={terminalContainerRef} 
            className="h-full bg-[#1e1e1e]"
            style={{ display: activeTab === 'shell' ? 'block' : 'none' }}
          />
        </TabsContent>

        <TabsContent value="logs" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full w-full bg-[#1e1e1e]">
            <div className="p-4">
              {isLoadingLogs ? (
                <div className="text-slate-400">Loading logs...</div>
              ) : (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all overflow-wrap-anywhere">{logs}</pre>
              )}
            </div>
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
    </div>
  );
};