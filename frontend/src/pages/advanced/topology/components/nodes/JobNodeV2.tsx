import React, { useState } from 'react';
import { Briefcase, CheckCircle2, XCircle, Clock, FileCode, PlayCircle, PauseCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import MultiHandleWrapper from './MultiHandleWrapper';
import { formatAge } from '../../utils/age-formatter';
import { Button } from '@/components/ui/button';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';

interface JobNodeProps {
  data: {
    label: string;
    status: 'Completed' | 'Failed' | 'Active' | 'Unknown';
    resource: {
      completions?: number;
      parallelism?: number;
      active: number;
      succeeded: number;
      failed: number;
      startTime?: string;
      completionTime?: string;
      backoffLimit?: number;
    };
    namespace: string;
    context?: string;
  };
  selected?: boolean;
}

const JobNodeV2: React.FC<JobNodeProps> = ({ data, selected }) => {
  const { resource } = data;
  const [showYaml, setShowYaml] = useState(false);
  
  // Calculate completion percentage
  const totalDesired = resource.completions || 1;
  const totalCompleted = resource.succeeded + resource.failed;
  const completionPercentage = totalDesired > 0 
    ? Math.round((totalCompleted / totalDesired) * 100)
    : 0;
  
  // Calculate success rate
  const successRate = totalCompleted > 0
    ? Math.round((resource.succeeded / totalCompleted) * 100)
    : 0;
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const getStatusConfig = () => {
    switch (data.status) {
      case 'Completed':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-200 dark:border-green-800',
          gradient: 'from-green-500 to-emerald-600'
        };
      case 'Failed':
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-200 dark:border-red-800',
          gradient: 'from-red-500 to-rose-600'
        };
      case 'Active':
        return {
          icon: <PlayCircle className="h-4 w-4" />,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          gradient: 'from-blue-500 to-cyan-600'
        };
      default:
        return {
          icon: <PauseCircle className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          gradient: 'from-gray-500 to-gray-600'
        };
    }
  };

  const config = getStatusConfig();

  // Calculate duration
  const getDuration = () => {
    if (resource.startTime) {
      const endTime = resource.completionTime || new Date().toISOString();
      const start = new Date(resource.startTime).getTime();
      const end = new Date(endTime).getTime();
      const durationMs = end - start;
      
      if (durationMs < 60000) {
        return `${Math.round(durationMs / 1000)}s`;
      } else if (durationMs < 3600000) {
        return `${Math.round(durationMs / 60000)}m`;
      } else {
        return `${Math.round(durationMs / 3600000)}h`;
      }
    }
    return null;
  };

  const duration = getDuration();

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
                  <Briefcase className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job
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

          {/* Job Progress Section */}
          <div className="p-2.5 space-y-1">
            {/* Completion Progress */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Completion</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {totalCompleted}/{totalDesired}
                </span>
                {duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {duration}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <Progress value={completionPercentage} className="h-1.5" />
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right -mt-0.5">
              {completionPercentage}% Complete
            </div>

            {/* Pod Status Summary */}
            <div className="flex items-center gap-2 p-1.5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
              {resource.active > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <PlayCircle className="h-3 w-3 text-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Active:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {resource.active}
                  </span>
                </div>
              )}
              {resource.succeeded > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-gray-600 dark:text-gray-400">Success:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {resource.succeeded}
                  </span>
                </div>
              )}
              {resource.failed > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {resource.failed}
                  </span>
                </div>
              )}
            </div>

            {/* Job Configuration */}
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              {resource.parallelism && (
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  <span>Parallelism: {resource.parallelism}</span>
                </div>
              )}
              {resource.backoffLimit !== undefined && (
                <div className="flex items-center gap-1">
                  <span>Backoff: {resource.backoffLimit}</span>
                </div>
              )}
            </div>

            {/* Success Rate if completed */}
            {totalCompleted > 0 && (
              <div className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <span className="text-[10px] text-gray-600 dark:text-gray-400">Success Rate</span>
                <div className="flex items-center gap-2">
                  <Progress value={successRate} className="w-16 h-1" />
                  <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                    {successRate}%
                  </span>
                </div>
              </div>
            )}

            {/* Start Time */}
            {resource.startTime && (
              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>Started</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatAge(resource.startTime)}
                </span>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-2.5 pb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span className="truncate">NS: {data.namespace}</span>
            </div>
          </div>

          {/* YAML Button - absolute positioned */}
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

    {/* YAML Window Portal */}
    {showYaml && data.namespace && data.context && (
      <TerminalPortal>
        <YamlWindow
          resourceType="job"
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

export default JobNodeV2;