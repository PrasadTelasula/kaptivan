import React from 'react';
import { X, Container, Cpu, MemoryStick, RefreshCw, Image, Activity, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  usage?: {
    cpu?: string;
    memory?: string;
    cpuPercentage?: number;
    memoryPercentage?: number;
  };
}

interface PodInfoWindowProps {
  podName: string;
  namespace: string;
  nodeName?: string;
  phase: string;
  containers: ContainerInfo[];
  onClose: () => void;
}

const PodInfoWindow: React.FC<PodInfoWindowProps> = ({
  podName,
  namespace,
  nodeName,
  phase,
  containers,
  onClose
}) => {
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Running': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950';
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950';
      case 'Failed': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950';
      case 'Succeeded': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950';
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950';
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running': return 'success';
      case 'waiting': return 'warning';
      case 'terminated': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Container className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Pod Information</h2>
                <p className="text-sm text-white/80">{podName}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Pod Overview */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Namespace</p>
                <p className="text-sm font-medium">{namespace}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phase</p>
                <Badge className={cn("text-xs", getPhaseColor(phase))}>
                  {phase}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Node</p>
                <p className="text-sm font-medium">{nodeName || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Containers</p>
                <p className="text-sm font-medium">{containers.length}</p>
              </div>
            </div>

            <Separator />

            {/* Containers */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Container className="h-5 w-5" />
                Containers
              </h3>

              {containers.map((container, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                  {/* Container Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{container.name}</h4>
                        <Badge variant={getStateColor(container.state)} className="text-xs">
                          {container.state}
                        </Badge>
                        {container.ready && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            Ready
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Image className="h-3 w-3" />
                        <span className="font-mono truncate max-w-md">{container.image}</span>
                      </div>
                    </div>
                    {container.restartCount > 0 && (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <RefreshCw className="h-4 w-4" />
                        <span className="text-sm font-medium">{container.restartCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Resources Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CPU Resources */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Cpu className="h-4 w-4 text-blue-500" />
                        CPU
                      </div>
                      <div className="space-y-1 pl-6">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Request</span>
                          <span className="font-mono">{container.resources?.requests?.cpu || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Limit</span>
                          <span className="font-mono">{container.resources?.limits?.cpu || 'Not set'}</span>
                        </div>
                        {container.usage?.cpu && (
                          <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Current Usage</span>
                              <span className="font-mono">{container.usage.cpu}</span>
                            </div>
                            {container.usage.cpuPercentage !== undefined && (
                              <Progress value={container.usage.cpuPercentage} className="h-1.5" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Memory Resources */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MemoryStick className="h-4 w-4 text-purple-500" />
                        Memory
                      </div>
                      <div className="space-y-1 pl-6">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Request</span>
                          <span className="font-mono">{container.resources?.requests?.memory || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Limit</span>
                          <span className="font-mono">{container.resources?.limits?.memory || 'Not set'}</span>
                        </div>
                        {container.usage?.memory && (
                          <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Current Usage</span>
                              <span className="font-mono">{container.usage.memory}</span>
                            </div>
                            {container.usage.memoryPercentage !== undefined && (
                              <Progress value={container.usage.memoryPercentage} className="h-1.5" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Container Status Alert if needed */}
                  {container.restartCount > 5 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        <p className="font-medium">High restart count detected</p>
                        <p className="text-amber-600 dark:text-amber-400">
                          This container has restarted {container.restartCount} times. Check logs for issues.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Overall Resource Usage Summary */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-indigo-500" />
                <h3 className="font-semibold">Resource Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Total CPU Requests</p>
                  <p className="font-mono font-medium">
                    {containers.reduce((sum, c) => {
                      const cpu = c.resources?.requests?.cpu;
                      if (!cpu) return sum;
                      const value = parseInt(cpu.replace(/[^0-9]/g, '')) || 0;
                      return sum + value;
                    }, 0)}m
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Total Memory Requests</p>
                  <p className="font-mono font-medium">
                    {containers.reduce((sum, c) => {
                      const mem = c.resources?.requests?.memory;
                      if (!mem) return sum;
                      const value = parseInt(mem.replace(/[^0-9]/g, '')) || 0;
                      return sum + value;
                    }, 0)}Mi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodInfoWindow;