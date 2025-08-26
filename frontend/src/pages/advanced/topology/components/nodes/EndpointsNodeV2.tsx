import React, { useState } from 'react';

import { GitBranch, Server, Link , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface EndpointsNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const EndpointsNodeV2: React.FC<EndpointsNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource } = data;
  const addressCount = resource.addresses?.length || 0;
  
  return (
    <MultiHandleWrapper>
      <div className="relative group">
        {/* Animated gradient border */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 blur-sm transition duration-500 animate-gradient-xy" />
        
        <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[280px] transition-all duration-300">
          
          {/* Header with animated icon */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg blur opacity-50 animate-pulse" />
              <div className="relative bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 rounded-lg">
                <GitBranch className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Endpoints
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[120px]">
                {data.label}
              </div>
            </div>
          </div>
          
          {/* Address count with animated dots */}
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg px-2 py-1">
            <div className="flex items-center gap-1.5">
              <Server className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {addressCount} endpoint{addressCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-0.5">
              {[...Array(Math.min(3, addressCount))].map((_, i) => (
                <div 
                  key={i}
                  className="w-1.5 h-1.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
          
          {/* IP Addresses */}
          {resource.addresses && resource.addresses.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                IP Addresses
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link className="h-2.5 w-2.5 text-violet-500" />
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-700 dark:text-gray-300">
                  {resource.addresses.slice(0, 3).map((addr: any, idx: number) => (
                    <span key={idx}>
                      {addr.ip || addr}
                      {idx < Math.min(resource.addresses.length - 1, 2) && ','}
                    </span>
                  ))}
                  {resource.addresses.length > 3 && (
                    <span className="text-gray-500 dark:text-gray-400">
                      +{resource.addresses.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
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
            resourceType="endpoints"
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

export default EndpointsNodeV2;