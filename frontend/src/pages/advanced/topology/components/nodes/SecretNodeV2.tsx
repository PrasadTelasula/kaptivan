import React, { useState } from 'react';

import { Lock, KeyRound, Shield, Eye, EyeOff , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface SecretNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const SecretNodeV2: React.FC<SecretNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  const [showKeys, setShowKeys] = React.useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource } = data;
  const dataCount = Object.keys(resource.data || {}).length;
  
  const getSecretTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'Opaque': 'Generic',
      'kubernetes.io/service-account-token': 'SA Token',
      'kubernetes.io/dockercfg': 'Docker Config',
      'kubernetes.io/dockerconfigjson': 'Docker JSON',
      'kubernetes.io/basic-auth': 'Basic Auth',
      'kubernetes.io/ssh-auth': 'SSH Auth',
      'kubernetes.io/tls': 'TLS Cert',
    };
    return typeMap[type] || type.split('/').pop() || 'Secret';
  };
  
  const getSecretTypeColor = (type: string) => {
    if (type.includes('tls')) return 'from-red-500 to-orange-600';
    if (type.includes('docker')) return 'from-blue-500 to-cyan-600';
    if (type.includes('token')) return 'from-yellow-500 to-amber-600';
    return 'from-gray-500 to-slate-600';
  };
  
  return (
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Security aura effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 rounded-xl opacity-0 group-hover:opacity-25 blur-lg transition duration-500 animate-pulse" />
      
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[260px] transition-all duration-300 border border-red-200/50 dark:border-red-900/50">
        
        {/* Header with lock icon */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg blur opacity-50 animate-pulse" />
              <div className={cn(
                "relative bg-gradient-to-br p-1.5 rounded-lg shadow-lg",
                getSecretTypeColor(resource.type || 'Opaque')
              )}>
                <Lock className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Secret
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[110px]">
                {data.label}
              </div>
            </div>
          </div>
          
          {/* Eye toggle */}
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {showKeys ? (
              <EyeOff className="h-3 w-3 text-gray-500" />
            ) : (
              <Eye className="h-3 w-3 text-gray-500" />
            )}
          </button>
        </div>
        
        {/* Secret Type Badge */}
        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium mb-2",
          "bg-gradient-to-r text-white shadow-sm",
          getSecretTypeColor(resource.type || 'Opaque')
        )}>
          <Shield className="h-3 w-3" />
          {getSecretTypeLabel(resource.type || 'Opaque')}
        </div>
        
        {/* Data Keys */}
        {dataCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Keys</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {dataCount}
              </span>
            </div>
            
            {showKeys && (
              <div className="space-y-0.5">
                {Object.keys(resource.data || {}).slice(0, 3).map((key) => (
                  <div 
                    key={key}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 rounded"
                  >
                    <KeyRound className="h-2.5 w-2.5 text-red-500" />
                    <span className="text-red-700 dark:text-red-400 truncate">
                      {key}
                    </span>
                  </div>
                ))}
                {dataCount > 3 && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1.5">
                    +{dataCount - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Security indicator */}
        <div className="flex justify-center gap-0.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="w-1 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
              style={{ 
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                animationDelay: `${i * 300}ms` 
              }}
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
          resourceType="secret"
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

export default SecretNodeV2;