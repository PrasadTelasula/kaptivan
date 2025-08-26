import React, { useState } from 'react';
import { Layers3, Activity, CheckCircle, AlertCircle, FileCode, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { formatAge } from '../../utils/age-formatter';

interface DeploymentNodeProps {
  data: {
    label: string;
    status?: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const DeploymentNodeV2: React.FC<DeploymentNodeProps> = ({ data }) => {
  const { resource } = data;
  const isHealthy = resource.available === resource.replicas;
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  return (
    <MultiHandleWrapper>
      <div className="relative group">
      
      {/* Glow effect on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500" />
      
      {/* Main node container with glassmorphism */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl p-4 min-w-[280px] transition-all duration-300 hover:shadow-3xl">
        
        {/* Header with icon and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Animated icon container */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl opacity-20 blur animate-pulse" />
              <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 p-2.5 rounded-xl shadow-lg">
                <Layers3 className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Deployment
              </div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                {data.label}
              </div>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            isHealthy 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          )}>
            {isHealthy ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {isHealthy ? 'Healthy' : 'Updating'}
          </div>
        </div>
        
        {/* Metrics section */}
        <div className="space-y-2">
          {/* Replicas bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Replicas</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {resource.available}/{resource.replicas}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${(resource.available / resource.replicas) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Strategy and Age badges */}
          <div className="flex items-center justify-between pt-1">
            {resource.strategy && (
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {resource.strategy}
                </span>
              </div>
            )}
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
    </div>
    
    {/* YAML Window */}
    {showYaml && data.namespace && data.context && (
      <TerminalPortal>
        <YamlWindow
          resourceType="deployment"
          resourceName={data.resource?.name || data.label}
          namespace={data.namespace}
          context={data.context}
          onClose={() => setShowYaml(false)}
        />
      </TerminalPortal>
    )}
    </MultiHandleWrapper>
  );
};

export default DeploymentNodeV2;