import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { X, Maximize2, Minimize2, Terminal, Minus, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { terminalManager } from '@/services/terminal-manager';
import { apiUrls } from '@/utils/api-urls';
import { useTheme } from '@/components/theme-provider';

interface ShellWindowProps {
  podName: string;
  namespace: string;
  context: string;
  containerName?: string;
  onClose: () => void;
}


export const ShellWindow: React.FC<ShellWindowProps> = ({
  podName,
  namespace,
  context,
  containerName,
  onClose
}) => {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({ 
    x: window.innerWidth / 2 - 400, 
    y: window.innerHeight / 2 - 300 
  });
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  
  // Generate unique terminal ID for each window instance
  // This ensures a fresh terminal connection each time the window is opened
  const terminalIdRef = React.useRef<string | null>(null);
  if (!terminalIdRef.current) {
    terminalIdRef.current = `${context}-${namespace}-${podName}-${containerName || 'default'}-shell-${Date.now()}`;
  }
  const terminalId = terminalIdRef.current;

  // Initialize terminal only once when terminalId is set
  // Use a ref to track if we've already initialized to prevent StrictMode double-execution
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initializedRef.current) {
      return;
    }
    
    // Create terminal if it doesn't exist
    if (!terminalManager.hasTerminal(terminalId)) {
      initializedRef.current = true;
      terminalManager.createTerminal(terminalId, theme);
      
      // Connect WebSocket only once when creating
      const wsUrl = apiUrls.pods.execWs(context, namespace, podName, containerName);
      terminalManager.connectWebSocket(terminalId, wsUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]); // Only depend on terminalId which is stable for the same pod/container

  // Attach terminal to DOM once container is ready
  useEffect(() => {
    if (terminalContainerRef.current && terminalManager.hasTerminal(terminalId)) {
      // Attach terminal to DOM
      terminalManager.attachToDOM(terminalId, terminalContainerRef.current);
      
      // Initial resize and focus
      setTimeout(() => {
        terminalManager.resizeTerminal(terminalId);
        terminalManager.focusTerminal(terminalId);
      }, 100);
    }
  }, [terminalId]);

  // Handle window resize
  useEffect(() => {
    if (isMinimized) return;
    
    const handleResize = () => {
      terminalManager.resizeTerminal(terminalId);
    };
    
    // Resize terminal when window size changes
    handleResize();
  }, [terminalId, size, isMinimized]);

  // Cleanup on actual page navigation (not StrictMode remounts)
  useEffect(() => {
    const currentTerminalId = terminalId;
    
    // Cleanup on actual unmount (page navigation, not StrictMode)
    const handleBeforeUnload = () => {
      terminalManager.destroyTerminal(currentTerminalId);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Don't destroy here - let the close button handle it
    };
  }, [terminalId]);
  
  // Proper cleanup when window is closed
  const handleClose = useCallback(() => {
    terminalManager.destroyTerminal(terminalId);
    onClose();
  }, [terminalId, onClose]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth - 20, height: window.innerHeight - 20 });
      setPosition({ x: 10, y: 10 });
    }
    setIsMaximized(!isMaximized);
    
    // Resize terminal after state update
    setTimeout(() => terminalManager.resizeTerminal(terminalId), 100);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 24);
    setFontSize(newSize);
    terminalManager.updateFontSize(terminalId, newSize);
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 10);
    setFontSize(newSize);
    terminalManager.updateFontSize(terminalId, newSize);
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 left-4 bg-card border rounded-lg p-2 shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors z-50"
        onClick={toggleMinimize}
      >
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-sm text-card-foreground">Shell: {containerName || podName}</span>
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={{ x: position.x, y: position.y }}
      onDragStop={(e, d) => {
        setPosition({ x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        setSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height)
        });
        setPosition(position);
        // Resize terminal after size change
        setTimeout(() => terminalManager.resizeTerminal(terminalId), 0);
      }}
      onResize={() => {
        // Also resize during resize drag for smooth experience
        terminalManager.resizeTerminal(terminalId);
      }}
      minWidth={400}
      minHeight={300}
      bounds="window"
      dragHandleClassName="shell-window-header"
      className="z-[9999]"
    >
      <div
        className={cn(
          "h-full bg-card border rounded-lg shadow-2xl flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="shell-window-header bg-muted border-b px-4 py-2 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Shell: {podName}/{containerName || 'default'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Font size controls */}
            <div className="flex items-center gap-0.5 mr-2 border-r pr-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  decreaseFontSize();
                }}
                title="Decrease font size"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground min-w-[20px] text-center">{fontSize}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  increaseFontSize();
                }}
                title="Increase font size"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
            
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimize();
              }}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximize();
              }}
            >
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Terminal Container */}
        <div 
          ref={terminalContainerRef} 
          className="flex-1 bg-background overflow-hidden"
        />
      </div>
    </Rnd>
  );
};