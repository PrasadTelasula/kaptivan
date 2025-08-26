import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Pause, Play, CheckCircle2, AlertCircle, FileCode, RefreshCw, XCircle, ArrowRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MultiHandleWrapper from './MultiHandleWrapper';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { formatAge } from '../../utils/age-formatter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CronJobNodeProps {
  data: {
    label: string;
    resource: {
      name: string;
      schedule: string;
      suspend?: boolean;
      lastScheduleTime?: string;
      nextScheduleTime?: string;
      active?: any[];
      status: 'Healthy' | 'Warning' | 'Error' | 'Unknown';
      successfulJobsHistoryLimit?: number;
      failedJobsHistoryLimit?: number;
      concurrencyPolicy?: string;
      startingDeadlineSeconds?: number;
    };
    namespace: string;
    context?: string;
  };
  selected?: boolean;
}

const CronJobNode: React.FC<CronJobNodeProps> = ({ data, selected }) => {
  const { resource } = data;
  const [showYaml, setShowYaml] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  // Get status configuration
  const getStatusConfig = () => {
    if (resource.suspend) {
      return {
        icon: <Pause className="h-4 w-4" />,
        text: 'Suspended',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        gradient: 'from-orange-500 to-amber-600'
      };
    } else if (resource.active && resource.active.length > 0) {
      return {
        icon: <Play className="h-4 w-4" />,
        text: 'Active',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
        gradient: 'from-green-500 to-emerald-600'
      };
    } else if (resource.status === 'Error') {
      return {
        icon: <XCircle className="h-4 w-4" />,
        text: 'Error',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        borderColor: 'border-red-200 dark:border-red-800',
        gradient: 'from-red-500 to-rose-600'
      };
    } else {
      return {
        icon: <Clock className="h-4 w-4" />,
        text: 'Scheduled',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        gradient: 'from-blue-500 to-cyan-600'
      };
    }
  };
  
  const config = getStatusConfig();
  
  // Format schedule for display
  const formatSchedule = (schedule: string) => {
    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    if (minute === '0' && hour === '0' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Daily at midnight';
    } else if (minute === '0' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every hour';
    } else if (minute === '*' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every minute';
    } else if (minute === '*/5' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every 5 minutes';
    } else if (minute === '*/10' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every 10 minutes';
    } else if (minute === '0' && hour === '*/2' && day === '*' && month === '*' && dayOfWeek === '*') {
      return 'Every 2 hours';
    }
    
    return schedule;
  };
  
  // Format time as HH:MM
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };
  
  // Format next run time as relative time (like last run)
  const formatNextRunRelative = (nextTime?: string) => {
    if (!nextTime) return null;
    const next = new Date(nextTime);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    
    if (diff < 0) return 'Now';
    if (diff < 60000) return `${Math.round(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  };
  
  // Format last run for display in circle
  const formatLastRunCompact = (lastTime?: string) => {
    if (!lastTime) return 'Never';
    return formatAge(lastTime);
  };
  
  const nextRunRelative = formatNextRunRelative(resource.nextScheduleTime);
  const lastRunCompact = formatLastRunCompact(resource.lastScheduleTime);
  
  return (
    <MultiHandleWrapper>
      <div className={cn(
        "relative group transition-all duration-300",
        selected && "scale-105"
      )}>
        {/* Status-based glow effect */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
          config.gradient
        )} />
        
        <div className={cn(
          "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border shadow-xl transition-all duration-300 hover:shadow-2xl",
          config.borderColor,
          "w-[360px]"
        )}>
          {/* Header */}
          <div className="p-2.5 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                  <Calendar className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CronJob
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[180px]">
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
                {config.text}
              </div>
            </div>
          </div>
          
          {/* Schedule Section */}
          <div className="p-2.5 space-y-2">
            {/* Schedule Display - More Compact */}
            <div className="flex items-center justify-between p-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-gray-900 dark:text-white">
                      {resource.schedule}
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400">
                      ({formatSchedule(resource.schedule)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Active Jobs Count */}
            {resource.active && resource.active.length > 0 && (
              <div className="flex items-center justify-between p-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-[10px] text-gray-600 dark:text-gray-400">Active Jobs</span>
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-green-600 dark:text-green-400 animate-spin" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    {resource.active.length} running
                  </span>
                </div>
              </div>
            )}
            
            {/* Ultra Compact Run Times - Simple Design */}
            <div className="p-1 bg-gray-50 dark:bg-gray-800/50 rounded-md">
              <div className="flex items-center justify-between">
                
                {/* Last Run */}
                <div className="flex flex-col items-center gap-0">
                  <span className="text-[7px] text-gray-500 dark:text-gray-400">Last run</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="w-8 h-8 rounded-full border border-gray-400 dark:border-gray-600 flex items-center justify-center">
                          <span className="text-[9px] font-medium text-gray-700 dark:text-gray-300">
                            {lastRunCompact}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {resource.lastScheduleTime ? (
                          <p>{new Date(resource.lastScheduleTime).toLocaleString()}</p>
                        ) : (
                          <p>Never run</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Line */}
                <div className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-600 mx-1.5" />

                {/* Now */}
                <div className="flex flex-col items-center gap-0">
                  <span className="text-[7px] text-gray-500 dark:text-gray-400">Now</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="w-8 h-8 rounded-full border border-purple-500 dark:border-purple-600 flex items-center justify-center">
                          <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400">
                            {formatTime(currentTime)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current time: {currentTime.toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Line */}
                <div className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-600 mx-1.5" />

                {/* Next Run */}
                <div className="flex flex-col items-center gap-0">
                  <span className="text-[7px] text-gray-500 dark:text-gray-400">Next run</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center",
                          resource.suspend 
                            ? "border-orange-500 dark:border-orange-600"
                            : "border-blue-500 dark:border-blue-600"
                        )}>
                          <span className={cn(
                            "text-[9px] font-medium",
                            resource.suspend 
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-blue-600 dark:text-blue-400"
                          )}>
                            {resource.suspend ? 'Pause' : (nextRunRelative || '-')}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {resource.suspend ? (
                          <p>CronJob is suspended</p>
                        ) : resource.nextScheduleTime ? (
                          <p>Next run: {new Date(resource.nextScheduleTime).toLocaleString()}</p>
                        ) : (
                          <p>No next run scheduled</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
              </div>
            </div>
            
            {/* Configuration */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {resource.concurrencyPolicy && (
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">Concurrency</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium capitalize">
                    {resource.concurrencyPolicy}
                  </span>
                </div>
              )}
              {resource.successfulJobsHistoryLimit !== undefined && (
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">Success History</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {resource.successfulJobsHistoryLimit} jobs
                  </span>
                </div>
              )}
              {resource.failedJobsHistoryLimit !== undefined && (
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">Failed History</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {resource.failedJobsHistoryLimit} jobs
                  </span>
                </div>
              )}
              {resource.startingDeadlineSeconds && (
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">Deadline</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {resource.startingDeadlineSeconds}s
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
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
            resourceType="cronjob"
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

export default CronJobNode;