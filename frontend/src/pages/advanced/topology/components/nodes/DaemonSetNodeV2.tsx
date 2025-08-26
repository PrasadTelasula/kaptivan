import React, { useState } from 'react';
import { Server, AlertCircle, CheckCircle2, Clock, MapPin, Activity, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import MultiHandleWrapper from './MultiHandleWrapper';
import { formatAge } from '../../utils/age-formatter';
import { Button } from '@/components/ui/button';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';

interface DaemonSetNodeProps {
  data: {
    label: string;
    status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
    resource: {
      desiredNumberScheduled: number;
      currentNumberScheduled: number;
      numberReady: number;
      numberAvailable?: number;
      numberMisscheduled?: number;
      updatedNumberScheduled?: number;
      updateStrategy?: string;
      nodeSelector?: Record<string, string>;
      creationTimestamp?: string;
    };
    namespace: string;
    context?: string;
  };
  selected?: boolean;
}

const DaemonSetNodeV2: React.FC<DaemonSetNodeProps> = ({ data, selected }) => {
  const { resource } = data;
  const [showYaml, setShowYaml] = useState(false);
  
  const readyPercentage = resource.desiredNumberScheduled > 0 
    ? Math.round((resource.numberReady / resource.desiredNumberScheduled) * 100)
    : 0;
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const getStatusConfig = () => {
    switch (data.status) {
      case 'Healthy':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-200 dark:border-green-800',
          gradient: 'from-green-500 to-emerald-600'
        };
      case 'Warning':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
          gradient: 'from-amber-500 to-orange-600'
        };
      case 'Error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-200 dark:border-red-800',
          gradient: 'from-red-500 to-rose-600'
        };
      default:
        return {
          icon: <Activity className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          gradient: 'from-gray-500 to-gray-600'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <MultiHandleWrapper>
      <div className={cn(
        "relative group transition-all duration-300",
        selected && "scale-105"
      )}>
        {/* Status-based glow */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
          config.gradient
        )} />
        
        <div className={cn(
          "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border shadow-xl transition-all duration-300 hover:shadow-2xl",
          config.borderColor,
          "w-[340px]"
        )}>
          {/* Header */}
          <div className="p-2.5 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                  <Server className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    DaemonSet
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[160px]">
                    {data.label}
                  </div>
                </div>
              </div>
              {/* Status Badge */}
              <div className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mr-8",
                config.bgColor, config.color
              )}>
                {config.icon}
                {data.status}
              </div>
            </div>
          </div>

          {/* Pods Status Section - More Compact */}
          <div className="p-2.5 space-y-1">
            {/* Pods Ready with Progress */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Pods Ready</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {resource.numberReady}/{resource.desiredNumberScheduled}
                </span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAge(resource.creationTimestamp)}
                  </span>
                </div>
              </div>
            </div>
            
            <Progress value={readyPercentage} className="h-1.5" />
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right -mt-0.5">
              {readyPercentage}% Ready
            </div>

            {/* Node Distribution Summary - More compact */}
            <div className="flex items-center gap-2 p-1.5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
              <div className="flex items-center gap-1 text-[10px]">
                <MapPin className="h-3 w-3 text-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">Sched:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                  {resource.currentNumberScheduled}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <Activity className="h-3 w-3 text-green-500" />
                <span className="text-gray-600 dark:text-gray-400">Avail:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                  {resource.numberAvailable || 0}
                </span>
              </div>
              {resource.updateStrategy && (
                <div className="flex items-center gap-1 text-[10px] ml-auto">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {resource.updateStrategy}
                  </Badge>
                </div>
              )}
            </div>

            {/* Misscheduled Warning */}
            {resource.numberMisscheduled && resource.numberMisscheduled > 0 && (
              <div className="flex items-center gap-1.5 p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  {resource.numberMisscheduled} pods misscheduled
                </span>
              </div>
            )}

            {/* Update Progress */}
            {resource.updatedNumberScheduled !== undefined && 
             resource.updatedNumberScheduled < resource.desiredNumberScheduled && (
              <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
                <span className="text-[10px] text-blue-700 dark:text-blue-400">
                  Updating: {resource.updatedNumberScheduled}/{resource.desiredNumberScheduled} pods updated
                </span>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-2.5 pb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span className="truncate">Node: docker-desktop</span>
              <span className="truncate">NS: {data.namespace}</span>
            </div>
          </div>

          {/* YAML Button - absolute positioned like in Pod */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2.5 right-2.5 h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handleOpenYaml}
          >
            <FileCode className="h-3.5 w-3.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
          </Button>
        </div>
      </div>

    {/* YAML Window Portal - Render outside React Flow canvas */}
    {showYaml && data.namespace && data.context && (
      <TerminalPortal>
        <YamlWindow
          resourceType="daemonset"
          resourceName={data.label}
          namespace={data.namespace}
          context={data.context}
          onClose={() => setShowYaml(false)}
        />
      </TerminalPortal>
    )}
    </MultiHandleWrapper>
  );
};

export default DaemonSetNodeV2;