import React, { useState } from 'react';
import { Package, Cpu, MemoryStick, Heart, AlertTriangle, Terminal, FileText, Info, RefreshCw, Layers, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShellWindow } from '../windows/ShellWindow';
import { LogsWindow } from '../windows/LogsWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { formatAge } from '../../utils/age-formatter';
import { terminalManager } from '@/services/terminal-manager';

interface ContainerNodeProps {
  data: {
    label: string;
    ready?: boolean;
    resource: any;
    podName?: string;
    namespace?: string;
    context?: string;
  };
}

const ContainerNodeV2: React.FC<ContainerNodeProps> = ({ data }) => {
  const { resource } = data;
  const isReady = data.ready ?? resource.ready ?? true;
  const hasResources = !!(resource.resources?.requests || resource.resources?.limits);
  const [showShell, setShowShell] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const terminalIdRef = React.useRef<string | null>(null);
  
  const formatResource = (value: string) => {
    if (!value) return 'N/A';
    if (value.includes('m')) return value;
    if (value.includes('Mi') || value.includes('Gi')) return value;
    return value;
  };
  
  // Handle shell window state changes
  React.useEffect(() => {
    // When shell is closed, cleanup the terminal
    if (!showShell && terminalIdRef.current) {
      const terminalId = terminalIdRef.current;
      // Destroy the terminal
      terminalManager.destroyTerminal(terminalId);
      terminalIdRef.current = null;
    }
  }, [showShell]);
  
  // Store terminal ID when shell window reports it
  const handleTerminalCreated = React.useCallback((terminalId: string) => {
    terminalIdRef.current = terminalId;
  }, []);
  
  const handleOpenShell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShell(true);
  };

  const handleOpenLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLogs(true);
  };
  
  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };
  
  return (
    <>
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Container glow effect */}
      <div className={cn(
        "absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
        isReady 
          ? "bg-gradient-to-r from-green-500 to-emerald-600" 
          : "bg-gradient-to-r from-amber-500 to-orange-600"
      )} />
      
      <div className={cn(
        "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl transition-all duration-300",
        isReady 
          ? "border border-green-200/50 dark:border-green-800/50" 
          : "border border-amber-200/50 dark:border-amber-800/50",
        showInfo ? "min-w-[360px]" : "min-w-[300px]"
      )}>
        
        {/* Header */}
        <div className="px-2.5 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "p-1 rounded-md",
                isReady 
                  ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                  : "bg-gradient-to-br from-amber-500 to-orange-600"
              )}>
                <Package className="h-3 w-3 text-white" />
              </div>
              <div>
                <div className="text-[9px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Container
                </div>
                <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[140px]">
                  {data.label}
                </div>
              </div>
            </div>
            
            {/* Action buttons in top-right */}
            <div className="flex items-center gap-0.5 ml-auto">
              {/* Info button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={toggleInfo}
                    >
                      <Info className={cn(
                        "h-3 w-3 transition-all",
                        showInfo ? "rotate-180 text-blue-500" : "text-gray-400"
                      )} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showInfo ? 'Hide' : 'Show'} Details</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Shell button - only for ready containers */}
              {isReady && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 hover:bg-cyan-500/20"
                        onClick={handleOpenShell}
                      >
                        <Terminal className="h-3 w-3 text-cyan-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open Shell</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* Logs button - always visible for debugging */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-5 w-5",
                        isReady ? "hover:bg-blue-500/20" : "hover:bg-amber-500/20"
                      )}
                      onClick={handleOpenLogs}
                    >
                      <FileText className={cn(
                        "h-3 w-3",
                        isReady ? "text-blue-500" : "text-amber-500"
                      )} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isReady ? 'View Logs' : 'View Logs (Debug Issue)'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        
        {/* Basic Info Section */}
        <div className="px-2.5 pt-2 pb-2.5 space-y-0.5">
          {/* First row: Ready badge with age and CPU */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge 
                variant={isReady ? 'success' : 'warning'} 
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {isReady ? 'Ready' : 'Not Ready'}
              </Badge>
              {/* Container age next to Ready */}
              <div className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 text-gray-400" />
                <span className="text-[10px] text-gray-500">
                  {formatAge(resource.startTime)}
                </span>
              </div>
            </div>
            
            {/* CPU on the right */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <Cpu className="h-2.5 w-2.5 text-blue-500" />
              <span className="text-gray-500">CPU:</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {resource.resources?.requests?.cpu ? formatResource(resource.resources.requests.cpu) : '–'}/{resource.resources?.limits?.cpu ? formatResource(resource.resources.limits.cpu) : '–'}
              </span>
            </div>
          </div>
          
          {/* Second row: State and Memory */}
          <div className="flex items-center justify-between">
            {/* State */}
            <div>
              {resource.state && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">State:</span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                    {resource.state}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Memory on the right */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <MemoryStick className="h-2.5 w-2.5 text-purple-500" />
              <span className="text-gray-500">Mem:</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {resource.resources?.requests?.memory ? formatResource(resource.resources.requests.memory) : '–'}/{resource.resources?.limits?.memory ? formatResource(resource.resources.limits.memory) : '–'}
              </span>
            </div>
          </div>
          
          {/* Third row: Restart count if any */}
          {resource.restartCount > 0 && (
            <div className="flex items-center gap-0.5">
              <RefreshCw className="h-2.5 w-2.5 text-amber-500" />
              <span className="text-[10px] text-amber-600 font-medium">Restarts: {resource.restartCount}</span>
            </div>
          )}
        </div>
        
        {/* Expandable Info Section */}
        {showInfo && (
          <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-200 dark:border-gray-700">
            {/* Image */}
            <div className="space-y-1 pt-2">
              <div className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image</div>
              <div className="text-[10px] font-mono text-gray-700 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded">
                {resource.image || 'N/A'}
              </div>
            </div>
            
            {/* Ports */}
            {resource.ports && resource.ports.length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ports</div>
                <div className="flex flex-wrap gap-1">
                  {resource.ports.map((port: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                      {port.containerPort}{port.protocol ? `/${port.protocol}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Mounts */}
            {resource.mounts && resource.mounts.length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-2.5 w-2.5" />
                  Volume Mounts ({resource.mounts.length})
                </div>
                <div className="space-y-0.5 text-[9px] text-gray-600 dark:text-gray-400">
                  {resource.mounts.slice(0, 3).map((mount: any, idx: number) => (
                    <div key={idx} className="truncate">
                      • {mount.mountPath || mount}
                    </div>
                  ))}
                  {resource.mounts.length > 3 && (
                    <div className="text-gray-500">
                      +{resource.mounts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Probes */}
            {(resource.livenessProbe || resource.readinessProbe) && (
              <div className="flex items-center gap-2 text-[10px]">
                <Activity className="h-3 w-3 text-green-500" />
                <span className="text-gray-500">Health Checks:</span>
                <div className="flex gap-1">
                  {resource.livenessProbe && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">Liveness</Badge>
                  )}
                  {resource.readinessProbe && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">Readiness</Badge>
                  )}
                </div>
              </div>
            )}
            
            {/* Warning for high restart count */}
            {resource.restartCount > 5 && (
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded">
                <div className="flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5" />
                  <div className="text-[9px] text-amber-700 dark:text-amber-400">
                    Container has restarted {resource.restartCount} times. Check logs for issues.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
      </div>
    </div>
    </MultiHandleWrapper>
    
    {/* Shell Window - rendered outside of ReactFlow context */}
    {showShell && data.podName && data.namespace && data.context && (
      <TerminalPortal>
        <ShellWindow
          podName={data.podName}
          namespace={data.namespace}
          context={data.context}
          containerName={data.label}
          onClose={() => setShowShell(false)}
          onTerminalCreated={handleTerminalCreated}
        />
      </TerminalPortal>
    )}
    
    {/* Logs Window - rendered outside of ReactFlow context */}
    {showLogs && data.podName && data.namespace && data.context && (
      <TerminalPortal>
        <LogsWindow
          podName={data.podName}
          namespace={data.namespace}
          context={data.context}
          containerName={data.label}
          onClose={() => setShowLogs(false)}
        />
      </TerminalPortal>
    )}
    </>
  );
};

export default ContainerNodeV2;