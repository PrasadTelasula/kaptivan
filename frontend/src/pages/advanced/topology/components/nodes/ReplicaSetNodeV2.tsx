import React, { useState } from 'react';
import { Copy, Layers, Activity, CheckCircle, AlertCircle, FileCode, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { formatAge } from '../../utils/age-formatter';

interface ReplicaSetNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const ReplicaSetNodeV2: React.FC<ReplicaSetNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource } = data;
  const replicas = resource.desired || 0;
  const readyReplicas = resource.ready || 0;
  const isHealthy = readyReplicas === replicas && replicas > 0;
  
  return (
    <MultiHandleWrapper>
      <div className="relative group">
        {/* Animated gradient background */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-25 blur-lg transition duration-500 animate-gradient-xy" />
        
        <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[280px] transition-all duration-300 border border-purple-200/50 dark:border-purple-800/50">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-violet-500 rounded-lg blur opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-br from-purple-500 to-violet-600 p-1.5 rounded-lg shadow-lg">
                  <Copy className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ReplicaSet
                </div>
                <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[140px]">
                  {data.label}
                </div>
              </div>
            </div>
          </div>
          
          {/* Replica Status */}
          <div className="space-y-2">
            {/* Status Badge */}
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              replicas === 0 
                ? "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                : isHealthy 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {replicas === 0 ? (
                <Layers className="h-3 w-3" />
              ) : isHealthy ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {replicas === 0 ? 'Scaled Down' : isHealthy ? 'Healthy' : 'Scaling'}
            </div>
            
            {/* Replica Count with Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Replicas</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {readyReplicas}/{replicas}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${replicas > 0 ? (readyReplicas / replicas) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* Replica Visualization and Age */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Layers className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                <div className="flex gap-0.5">
                  {[...Array(Math.min(5, replicas))].map((_, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        i < readyReplicas
                          ? "bg-gradient-to-r from-purple-500 to-violet-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      )}
                    />
                  ))}
                  {replicas > 5 && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">
                      +{replicas - 5}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatAge(resource.creationTimestamp)}
                </span>
              </div>
            </div>
          </div>
          
          {/* YAML button - positioned in top-right corner, visible on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
        
        {/* YAML Window */}
        {showYaml && data.namespace && data.context && (
          <TerminalPortal>
            <YamlWindow
              resourceType="replicaset"
              resourceName={data.resource?.name || data.label}
              namespace={data.namespace}
              context={data.context}
              onClose={() => setShowYaml(false)}
            />
          </TerminalPortal>
        )}
      </div>
    </MultiHandleWrapper>
  );
};

export default ReplicaSetNodeV2;