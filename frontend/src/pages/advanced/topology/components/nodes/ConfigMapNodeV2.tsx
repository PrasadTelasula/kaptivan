import React, { useState } from 'react';

import { FileText, Database, Hash, Settings , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface ConfigMapNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const ConfigMapNodeV2: React.FC<ConfigMapNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource } = data;
  const dataCount = Object.keys(resource.data || {}).length;
  const binaryDataCount = Object.keys(resource.binaryData || {}).length;
  
  return (
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Soft glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-slate-400 via-gray-400 to-zinc-400 rounded-xl opacity-0 group-hover:opacity-20 blur-lg transition duration-500" />
      
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[260px] transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50">
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-gradient-to-br from-slate-500 to-gray-600 p-1.5 rounded-lg shadow-md">
            <Settings className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              ConfigMap
            </div>
            <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[120px]">
              {data.label}
            </div>
          </div>
        </div>
        
        {/* Data Stats */}
        <div className="space-y-1.5">
          {dataCount > 0 && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/20 rounded-lg px-2 py-1">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {dataCount} key{dataCount !== 1 ? 's' : ''}
                </span>
              </div>
              <Hash className="h-3 w-3 text-slate-400 opacity-50" />
            </div>
          )}
          
          {binaryDataCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Database className="h-3 w-3 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {binaryDataCount} binary
              </span>
            </div>
          )}
          
          {/* Key Preview */}
          {dataCount > 0 && (
            <div className="mt-1 space-y-0.5">
              {Object.keys(resource.data || {}).slice(0, 2).map((key) => (
                <div 
                  key={key}
                  className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 truncate"
                  title={key}
                >
                  {key}
                </div>
              ))}
              {dataCount > 2 && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1.5">
                  +{dataCount - 2} more
                </div>
              )}
            </div>
          )}
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
          resourceType="configmap"
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

export default ConfigMapNodeV2;