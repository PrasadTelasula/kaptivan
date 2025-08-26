import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, Maximize2, Minimize2, ScrollText, Download, RefreshCw, Search, ChevronUp, ChevronDown, Minus, RotateCw, PlayCircle, PauseCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LogsWebSocketClient } from '@/services/logs-websocket';

interface LogsWindowProps {
  podName: string;
  namespace: string;
  context: string;
  containerName?: string;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const LogsWindow: React.FC<LogsWindowProps> = ({
  podName,
  namespace,
  context,
  containerName,
  onClose
}) => {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [tailLines, setTailLines] = useState(100);
  const [showSearch, setShowSearch] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [fontSize, setFontSize] = useState(12);
  
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({ 
    x: window.innerWidth / 2 - 400, 
    y: window.innerHeight / 2 - 300 
  });
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [lastTimestamp, setLastTimestamp] = useState<string>('');
  const [accumulatedLogs, setAccumulatedLogs] = useState<string[]>([]);
  const [newLineIndices, setNewLineIndices] = useState<Set<number>>(new Set());
  const wsClientRef = useRef<LogsWebSocketClient | null>(null);

  const fetchLogs = async (since?: boolean, initial?: boolean) => {
    if (!initial) {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      let url = `${API_BASE_URL}/api/v1/pods/${context}/${namespace}/${podName}/logs?tailLines=${tailLines}`;
      if (containerName) {
        url += `&container=${containerName}`;
      }
      if (since && lastTimestamp && !initial) {
        url += `&sinceTime=${encodeURIComponent(lastTimestamp)}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      let text = await response.text();
      
      // Check if the response is JSON (some backends return logs as JSON)
      try {
        const jsonResponse = JSON.parse(text);
        if (jsonResponse.logs) {
          text = jsonResponse.logs;
        } else if (jsonResponse.data) {
          text = jsonResponse.data;
        } else if (typeof jsonResponse === 'string') {
          text = jsonResponse;
        }
      } catch {
        // Not JSON, use as-is
      }
      
      if (text) {
        // Don't clean escape sequences - just use the raw text
        // Split by actual newlines in the response
        const lines = text.split('\n');
        
        if (lines.length > 0) {
          // Extract timestamp from the last non-empty line if it exists
          const nonEmptyLines = lines.filter(line => line.trim() !== '');
          if (nonEmptyLines.length > 0) {
            const lastLine = nonEmptyLines[nonEmptyLines.length - 1];
            const timestampMatch = lastLine.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/);
            if (timestampMatch) {
              setLastTimestamp(timestampMatch[0]);
            }
          }
          
          if (initial || !since) {
            // Initial load or full refresh - use raw text as-is
            setLogs(text);
            setAccumulatedLogs(lines);
            setNewLineIndices(new Set()); // Clear new line highlights on full refresh
          } else {
            // Incremental update
            const previousLength = accumulatedLogs.filter(line => line.trim() !== '').length;
            const newLines = lines.filter(line => line.trim() !== '');
            
            if (newLines.length > 0) {
              // Mark new lines for highlighting
              const newIndices = new Set<number>();
              for (let i = previousLength; i < previousLength + newLines.length; i++) {
                newIndices.add(i);
              }
              setNewLineIndices(newIndices);
              
              // Clear highlights after 3 seconds
              setTimeout(() => {
                setNewLineIndices(new Set());
              }, 3000);
            }
            
            const newAccumulated = [...accumulatedLogs, ...lines];
            // Keep only last 1000 lines to prevent memory issues
            const trimmedLogs = newAccumulated.slice(-1000);
            setAccumulatedLogs(trimmedLogs);
            setLogs(trimmedLogs.join('\n'));
            
            // Auto-scroll to bottom if at bottom
            if (logsContainerRef.current) {
              const container = logsContainerRef.current;
              const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
              if (isAtBottom) {
                setTimeout(() => {
                  container.scrollTop = container.scrollHeight;
                }, 10);
              }
            }
          }
        }
      } else if (initial || !since) {
        setLogs('No logs available');
      }
      
      // Update last refresh time
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToSearchResult = (index: number) => {
    if (searchResults.length === 0) return;
    
    const lineNumber = searchResults[index];
    const lineElement = lineRefs.current.get(lineNumber);
    
    if (lineElement && logsContainerRef.current) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight the line temporarily
      lineElement.classList.add('bg-yellow-500/20');
      setTimeout(() => {
        lineElement.classList.remove('bg-yellow-500/20');
      }, 2000);
    }
  };

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  };

  const handleSearchPrevious = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    scrollToSearchResult(prevIndex);
  };

  // Download logs as file
  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${podName}-${containerName || 'logs'}-${timestamp}.log`;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Search functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const lines = logs.split('\n');
    const results: number[] = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(term.toLowerCase())) {
        results.push(index);
      }
    });
    
    setSearchResults(results);
    setCurrentSearchIndex(0);
    if (results.length > 0) {
      scrollToSearchResult(0);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs(false, true);
  }, []);

  // WebSocket-based auto-refresh
  useEffect(() => {
    if (!autoRefresh) {
      // Disconnect WebSocket when auto-refresh is disabled
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
      return;
    }

    // Create WebSocket connection for log streaming
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${context}/${namespace}/${podName}/logs/ws?tailLines=${tailLines}${containerName ? `&container=${containerName}` : ''}&follow=true`;
    
    const wsClient = new LogsWebSocketClient(
      wsUrl,
      (logLine) => {
        // Handle incoming log line
        setAccumulatedLogs(prev => {
          const newLogs = [...prev, logLine];
          const trimmed = newLogs.slice(-1000); // Keep last 1000 lines
          
          // Mark new line for highlighting
          const newIndex = trimmed.length - 1;
          setNewLineIndices(prev => new Set([...prev, newIndex]));
          
          // Clear highlight after 3 seconds
          setTimeout(() => {
            setNewLineIndices(prev => {
              const updated = new Set(prev);
              updated.delete(newIndex);
              return updated;
            });
          }, 3000);
          
          return trimmed;
        });
        
        setLogs(prev => {
          const lines = prev.split('\n');
          lines.push(logLine);
          const trimmed = lines.slice(-1000);
          return trimmed.join('\n');
        });
        
        // Update last refresh time
        setLastRefreshTime(new Date());
        
        // Auto-scroll if at bottom
        if (logsContainerRef.current) {
          const container = logsContainerRef.current;
          const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
          if (isAtBottom) {
            setTimeout(() => {
              container.scrollTop = container.scrollHeight;
            }, 10);
          }
        }
      },
      (error) => {
        console.error('WebSocket error:', error);
        setError(error);
      },
      () => {
        console.log('WebSocket closed');
        // Optionally restart or notify user
      }
    );
    
    wsClient.connect();
    wsClientRef.current = wsClient;
    
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
    };
  }, [autoRefresh, context, namespace, podName, containerName, tailLines]);
  
  // Reset logs when container changes
  useEffect(() => {
    setAccumulatedLogs([]);
    setLastTimestamp('');
    setLogs('');
    fetchLogs(false, true);
  }, [podName, containerName]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth - 20, height: window.innerHeight - 20 });
      setPosition({ x: 10, y: 10 });
    }
    setIsMaximized(!isMaximized);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 20);
    setFontSize(newSize);
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 8);
    setFontSize(newSize);
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 left-4 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors z-50"
        onClick={toggleMinimize}
      >
        <ScrollText className="h-4 w-4 text-cyan-400" />
        <span className="text-sm text-slate-300">Logs: {containerName || podName}</span>
      </div>
    );
  }

  const renderLogs = () => {
    const lines = logs.split('\n');
    return lines.map((line, index) => {
      const isNewLine = newLineIndices.has(index);
      
      return (
        <div
          key={index}
          ref={(el) => {
            if (el) lineRefs.current.set(index, el);
          }}
          className={cn(
            "font-mono hover:bg-slate-800/50 px-2 transition-all duration-500",
            searchResults.includes(index) && "bg-yellow-500/10",
            searchResults[currentSearchIndex] === index && "bg-yellow-500/20",
            isNewLine && "bg-green-500/20 border-l-2 border-green-400 animate-pulse"
          )}
          style={{ minHeight: '20px', fontSize: `${fontSize}px` }}
        >
          <span className="text-slate-500 select-none mr-2 inline-block w-12">{String(index + 1).padStart(4, '0')}</span>
          <span className={cn(
            "whitespace-pre-wrap break-all",
            isNewLine ? "text-green-300" : "text-slate-300"
          )}>{line || '\u00A0'}</span>
        </div>
      );
    });
  };

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
      }}
      minWidth={400}
      minHeight={300}
      bounds="window"
      dragHandleClassName="logs-window-header"
      className="z-[9999]"
    >
      <div
        className={cn(
          "h-full bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="logs-window-header bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-200">
              Logs: {podName}/{containerName || 'default'}
            </span>
            {autoRefresh && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Font size controls */}
            <div className="flex items-center gap-0.5 mr-2 border-r border-slate-700 pr-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  decreaseFontSize();
                }}
                title="Decrease font size"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-slate-400 min-w-[20px] text-center">{fontSize}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-slate-700"
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
                setShowSearch(!showSearch);
              }}
              title="Search"
            >
              <Search className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                fetchLogs();
              }}
              title="Refresh logs once"
            >
              <RotateCw className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-6 w-6 hover:bg-slate-700",
                autoRefresh && "text-green-400"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setAutoRefresh(!autoRefresh);
              }}
              title={autoRefresh ? "Stop auto-refresh" : "Start auto-refresh"}
            >
              {autoRefresh ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              title="Download logs"
            >
              <Download className="h-3 w-3" />
            </Button>
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
              className="h-6 w-6 hover:bg-slate-700 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2">
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 h-7 text-xs bg-slate-900 border-slate-700"
            />
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleSearchPrevious}
                disabled={searchResults.length === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleSearchNext}
                disabled={searchResults.length === 0}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <span className="text-xs text-slate-400 ml-2">
                {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
              </span>
            </div>
          </div>
        )}

        {/* Logs container */}
        <div className="flex-1 overflow-hidden bg-slate-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-400">Loading logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-400">
                <p className="text-sm">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => fetchLogs()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div
              ref={logsContainerRef}
              className="h-full overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
            >
              {renderLogs()}
            </div>
          )}
        </div>

        {/* Footer with stats */}
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <span>Lines: {logs.split('\n').length}</span>
            <span>Size: {(new Blob([logs]).size / 1024).toFixed(1)} KB</span>
            {autoRefresh && (
              <>
                <span className="text-green-400">● Live Stream (WebSocket)</span>
                <span>Last: {lastRefreshTime.toLocaleTimeString()}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Tail: {tailLines} lines</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-xs"
              onClick={() => setTailLines(Math.min(tailLines + 100, 1000))}
            >
              +100
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-xs"
              onClick={() => setTailLines(Math.max(tailLines - 100, 100))}
            >
              -100
            </Button>
          </div>
        </div>
      </div>
    </Rnd>
  );
};