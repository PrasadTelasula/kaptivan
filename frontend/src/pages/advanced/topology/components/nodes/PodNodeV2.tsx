import React, { useState } from 'react';
import { Box, Circle, AlertTriangle, CheckCircle2, Clock, XCircle, FileCode, Info, Container, Cpu, MemoryStick, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { Badge } from '@/components/ui/badge';
import { formatAge } from '../../utils/age-formatter';

interface PodNodeProps {
  data: {
    label: string;
    phase?: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const PodNodeV2: React.FC<PodNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  const [expandedContainer, setExpandedContainer] = useState<number | null>(null);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const toggleContainerInfo = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedContainer(expandedContainer === index ? null : index);
  };
  
  const { resource } = data;
  const phase = resource.phase || data.phase;
  
  const getPhaseConfig = () => {
    switch (phase) {
      case 'Running':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-200 dark:border-green-800',
          gradient: 'from-green-500 to-emerald-600'
        };
      case 'Pending':
        return {
          icon: <Clock className="h-4 w-4" />,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
          gradient: 'from-amber-500 to-orange-600'
        };
      case 'Failed':
      case 'CrashLoopBackOff':
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-200 dark:border-red-800',
          gradient: 'from-red-500 to-rose-600'
        };
      case 'Terminating':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          gradient: 'from-gray-500 to-gray-600'
        };
      default:
        return {
          icon: <Circle className="h-4 w-4" />,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          gradient: 'from-blue-500 to-cyan-600'
        };
    }
  };

  const config = getPhaseConfig();
  const containers = resource.containers || [];
  const containerCount = containers.length;
  const readyContainers = containers.filter((c: any) => c.ready).length;
  
  // Calculate total CPU and memory across all containers
  const calculateTotalResources = () => {
    let totalCpuRequests = 0;
    let totalCpuLimits = 0;
    let totalMemRequests = 0;
    let totalMemLimits = 0;
    
    containers.forEach((container: any) => {
      if (container.resources?.requests?.cpu) {
        const cpu = container.resources.requests.cpu;
        // Parse CPU values (e.g., "100m" = 0.1, "2" = 2)
        if (cpu.endsWith('m')) {
          totalCpuRequests += parseInt(cpu) / 1000;
        } else {
          totalCpuRequests += parseFloat(cpu);
        }
      }
      if (container.resources?.limits?.cpu) {
        const cpu = container.resources.limits.cpu;
        if (cpu.endsWith('m')) {
          totalCpuLimits += parseInt(cpu) / 1000;
        } else {
          totalCpuLimits += parseFloat(cpu);
        }
      }
      if (container.resources?.requests?.memory) {
        const mem = container.resources.requests.memory;
        // Parse memory values (e.g., "128Mi" = 128, "1Gi" = 1024)
        if (mem.endsWith('Mi')) {
          totalMemRequests += parseInt(mem);
        } else if (mem.endsWith('Gi')) {
          totalMemRequests += parseInt(mem) * 1024;
        }
      }
      if (container.resources?.limits?.memory) {
        const mem = container.resources.limits.memory;
        if (mem.endsWith('Mi')) {
          totalMemLimits += parseInt(mem);
        } else if (mem.endsWith('Gi')) {
          totalMemLimits += parseInt(mem) * 1024;
        }
      }
    });
    
    // Format CPU (show in cores or millicores)
    const formatCpu = (value: number) => {
      if (value === 0) return '–';
      if (value < 1) return `${Math.round(value * 1000)}m`;
      return value.toFixed(1);
    };
    
    // Format memory (show in Mi or Gi)
    const formatMem = (value: number) => {
      if (value === 0) return '–';
      if (value >= 1024) return `${(value / 1024).toFixed(1)}Gi`;
      return `${value}Mi`;
    };
    
    return {
      cpu: `${formatCpu(totalCpuRequests)}/${formatCpu(totalCpuLimits)}`,
      memory: `${formatMem(totalMemRequests)}/${formatMem(totalMemLimits)}`
    };
  };
  
  const totalResources = calculateTotalResources();
  
  return (
    <MultiHandleWrapper>
        <div className="relative group">
        {/* Status-based glow */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
          config.gradient
        )} />
        
        <div className={cn(
          "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border shadow-xl transition-all duration-300 hover:shadow-2xl",
          config.borderColor,
          expandedContainer !== null ? "min-w-[480px]" : "min-w-[440px]"
        )}>
          
          {/* Header */}
          <div className="p-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                  <Box className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pod
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[200px]">
                    {data.label}
                  </div>
                </div>
              </div>
              {/* Phase Badge - with margin to prevent overlap with YAML button */}
              <div className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mr-8",
                config.bgColor, config.color
              )}>
                {config.icon}
                {phase}
              </div>
            </div>
          </div>
        
        {/* Containers Section */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="font-medium">Containers ({readyContainers}/{containerCount})</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatAge(resource.startTime)}
                </span>
              </div>
              {readyContainers === containerCount ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
            </div>
          </div>
          
          {/* Total Resources Summary */}
          {(totalResources.cpu !== '–/–' || totalResources.memory !== '–/–') && (
            <div className="flex items-center gap-4 p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg mb-2">
              <div className="flex items-center gap-1.5 text-[10px]">
                <Cpu className="h-3 w-3 text-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">Total CPU:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{totalResources.cpu}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <MemoryStick className="h-3 w-3 text-purple-500" />
                <span className="text-gray-600 dark:text-gray-400">Total Mem:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{totalResources.memory}</span>
              </div>
            </div>
          )}
          
          {/* Container List */}
          <div className="space-y-1.5">
            {containers.map((container: any, index: number) => (
              <div key={index} className="relative">
                <div 
                  className={cn(
                    "flex items-center justify-between p-1.5 rounded-lg transition-all cursor-pointer",
                    "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800",
                    expandedContainer === index && "bg-gray-100 dark:bg-gray-800"
                  )}
                  onClick={(e) => toggleContainerInfo(index, e)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Container className="h-3 w-3 text-gray-400" />
                    <span className="text-xs font-medium truncate max-w-[140px]">{container.name}</span>
                    {container.ready ? (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500 text-green-600">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-500 text-amber-600">
                        Not Ready
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {container.restartCount > 0 && (
                      <div className="flex items-center gap-0.5">
                        <RefreshCw className="h-2.5 w-2.5 text-amber-500" />
                        <span className="text-[10px] text-amber-600 font-medium">{container.restartCount}</span>
                      </div>
                    )}
                    <Info className={cn(
                      "h-3 w-3 transition-transform",
                      expandedContainer === index ? "rotate-180 text-blue-500" : "text-gray-400"
                    )} />
                  </div>
                </div>
                
                {/* Expanded Container Info */}
                {expandedContainer === index && (
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] space-y-1">
                    {/* Image */}
                    <div className="flex items-start gap-1">
                      <span className="text-gray-500 dark:text-gray-400">Image:</span>
                      <span className="font-mono text-gray-700 dark:text-gray-300 break-all flex-1">
                        {container.image || 'N/A'}
                      </span>
                    </div>
                    
                    {/* Resources */}
                    {(container.resources?.requests || container.resources?.limits) && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-2.5 w-2.5 text-blue-500" />
                          <span className="text-gray-500">CPU:</span>
                          <span className="font-mono">
                            {container.resources?.requests?.cpu || '–'} / {container.resources?.limits?.cpu || '–'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MemoryStick className="h-2.5 w-2.5 text-purple-500" />
                          <span className="text-gray-500">Mem:</span>
                          <span className="font-mono">
                            {container.resources?.requests?.memory || '–'} / {container.resources?.limits?.memory || '–'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* State */}
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-gray-500">State:</span>
                      <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">
                        {container.state || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Node and IP info - all on single line */}
        {(resource.nodeName || resource.podIP || resource.hostIP) && (
          <div className="px-3 pb-3 -mt-1">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
              {resource.nodeName && (
                <>
                  <span>Node:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">
                    {resource.nodeName}
                  </span>
                </>
              )}
              {resource.podIP && (
                <>
                  <span className="border-l border-gray-300 dark:border-gray-600 pl-2">Pod IP:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300 mr-2">
                    {resource.podIP}
                  </span>
                </>
              )}
              {resource.hostIP && (
                <>
                  <span className="border-l border-gray-300 dark:border-gray-600 pl-2">Node IP:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {resource.hostIP}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* YAML button - positioned in top-right corner, visible on hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleOpenYaml}
                >
                  <FileCode className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View YAML</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
    
    {/* YAML Window */}
    {showYaml && data.namespace && data.context && (
      <TerminalPortal>
        <YamlWindow
          resourceType="pod"
          resourceName={data.resource.name || data.label}
          namespace={data.namespace}
          context={data.context}
          onClose={() => setShowYaml(false)}
        />
      </TerminalPortal>
    )}
    </MultiHandleWrapper>
  );
};

export default PodNodeV2;