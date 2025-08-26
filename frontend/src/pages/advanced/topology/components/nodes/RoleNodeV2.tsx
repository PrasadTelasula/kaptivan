import React, { useState } from 'react';

import { Shield, Lock, Key, Crown , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface RoleNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
    isClusterRole?: boolean;
  };
}

const RoleNodeV2: React.FC<RoleNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource, isClusterRole } = data;
  const ruleCount = resource.rules?.length || 0;
  
  // Extract unique verbs
  const verbs = new Set<string>();
  resource.rules?.forEach((rule: any) => {
    rule.verbs?.forEach((verb: string) => verbs.add(verb));
  });
  
  const getVerbColor = (verb: string) => {
    const colorMap: Record<string, string> = {
      'get': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'list': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      'watch': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      'create': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'update': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'patch': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'delete': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return colorMap[verb] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  };
  
  return (
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Gradient glow */}
      <div className={cn(
        "absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
        isClusterRole 
          ? "bg-gradient-to-r from-amber-500 to-orange-600" 
          : "bg-gradient-to-r from-emerald-500 to-teal-600"
      )} />
      
      <div className={cn(
        "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[300px] transition-all duration-300",
        isClusterRole 
          ? "border border-amber-200/50 dark:border-amber-800/50" 
          : "border border-emerald-200/50 dark:border-emerald-800/50"
      )}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              isClusterRole 
                ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                : "bg-gradient-to-br from-emerald-500 to-teal-600"
            )}>
              {isClusterRole ? (
                <Crown className="h-3.5 w-3.5 text-white" />
              ) : (
                <Shield className="h-3.5 w-3.5 text-white" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isClusterRole ? 'ClusterRole' : 'Role'}
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[130px]">
                {data.label}
              </div>
            </div>
          </div>
          
          {/* Rule count */}
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
            isClusterRole 
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}>
            <Key className="h-3 w-3" />
            {ruleCount}
          </div>
        </div>
        
        {/* Permissions pills */}
        {verbs.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from(verbs).slice(0, 4).map(verb => (
              <span 
                key={verb}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  getVerbColor(verb)
                )}
              >
                {verb}
              </span>
            ))}
            {verbs.size > 4 && (
              <span className="px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                +{verbs.size - 4}
              </span>
            )}
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
          resourceType={isClusterRole ? "clusterrole" : "role"}
          resourceName={data.resource?.name || data.label}
          namespace={!isClusterRole ? data.namespace : undefined}
          context={data.context}
          onClose={() => setShowYaml(false)}
        />
      </TerminalPortal>
    )}
    </MultiHandleWrapper>
  );
};

export default RoleNodeV2;