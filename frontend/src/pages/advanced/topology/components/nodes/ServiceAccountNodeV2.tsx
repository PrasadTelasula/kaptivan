import React, { useState } from 'react';

import { UserCog, Key, Lock, Fingerprint , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface ServiceAccountNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const ServiceAccountNodeV2: React.FC<ServiceAccountNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource } = data;
  const secretCount = resource.secrets?.length || 0;
  const hasImagePullSecrets = resource.imagePullSecrets?.length > 0;
  
  return (
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Holographic effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500 animate-gradient-xy" />
      
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[280px] transition-all duration-300 border border-cyan-200/50 dark:border-cyan-800/50">
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg blur opacity-50 animate-pulse" />
            <div className="relative bg-gradient-to-br from-cyan-500 to-teal-600 p-1.5 rounded-lg shadow-lg">
              <UserCog className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Service Account
            </div>
            <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[130px]">
              {data.label}
            </div>
          </div>
        </div>
        
        {/* Security Features */}
        <div className="space-y-1.5">
          {/* Secrets */}
          {secretCount > 0 && (
            <div className="flex items-center justify-between bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-lg px-2 py-1">
              <div className="flex items-center gap-1.5">
                <Key className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
                  {secretCount} secret{secretCount !== 1 ? 's' : ''}
                </span>
              </div>
              <Lock className="h-3 w-3 text-cyan-500 dark:text-cyan-400 opacity-50" />
            </div>
          )}
          
          {/* Image Pull Secrets */}
          {hasImagePullSecrets && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <Fingerprint className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              <span className="text-xs text-teal-700 dark:text-teal-300">
                Image Pull
              </span>
            </div>
          )}
          
          {/* Namespace */}
          {resource.namespace && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 px-2">
              NS: <span className="font-medium text-gray-700 dark:text-gray-300">
                {resource.namespace}
              </span>
            </div>
          )}
        </div>
        
        {/* Animated security dots */}
        <div className="flex justify-center gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="w-1 h-1 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
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
          resourceType="serviceaccount"
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

export default ServiceAccountNodeV2;