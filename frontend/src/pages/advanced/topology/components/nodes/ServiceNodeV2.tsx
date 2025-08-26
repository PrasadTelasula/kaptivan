import React, { useState } from 'react';
import { Globe, Network, Wifi, Cloud, FileCode, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { formatAge } from '../../utils/age-formatter';

interface ServiceNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
  };
}

const ServiceNodeV2: React.FC<ServiceNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  const { resource } = data;
  
  const getServiceIcon = () => {
    switch (resource.type) {
      case 'LoadBalancer':
        return <Cloud className="h-3.5 w-3.5 text-white" />;
      case 'NodePort':
        return <Wifi className="h-3.5 w-3.5 text-white" />;
      case 'ExternalName':
        return <Globe className="h-3.5 w-3.5 text-white" />;
      default:
        return <Network className="h-3.5 w-3.5 text-white" />;
    }
  };

  const getTypeColor = () => {
    switch (resource.type) {
      case 'LoadBalancer':
        return 'from-purple-500 to-pink-600';
      case 'NodePort':
        return 'from-green-500 to-emerald-600';
      case 'ExternalName':
        return 'from-orange-500 to-red-600';
      default:
        return 'from-indigo-500 to-purple-600';
    }
  };
  
  return (
    <MultiHandleWrapper>
      <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500" />
      
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl p-3 min-w-[280px] transition-all duration-300 hover:shadow-2xl">
        
        {/* Header - matching Endpoints */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <div className={cn("absolute inset-0 bg-gradient-to-r rounded-lg blur opacity-50 animate-pulse", getTypeColor())} />
            <div className={cn("relative bg-gradient-to-br p-1.5 rounded-lg", getTypeColor())}>
              {getServiceIcon()}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Service
            </div>
            <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[120px]">
              {data.label}
            </div>
          </div>
        </div>
        
        {/* Service Type Badge - like endpoints count section */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg px-2 py-1">
          <span className={cn(
            "inline-flex items-center text-xs font-medium",
            resource.type === 'LoadBalancer' ? 'text-purple-700 dark:text-purple-300' :
            resource.type === 'NodePort' ? 'text-green-700 dark:text-green-300' :
            resource.type === 'ExternalName' ? 'text-orange-700 dark:text-orange-300' :
            'text-indigo-700 dark:text-indigo-300'
          )}>
            {resource.type}
          </span>
        </div>
        
        {/* Bottom section with Cluster IP and Ports */}
        {(resource.clusterIP && resource.clusterIP !== 'None') || (resource.ports && resource.ports.length > 0) ? (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {/* Cluster IP on the left */}
              {resource.clusterIP && resource.clusterIP !== 'None' && (
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Cluster IP
                  </div>
                  <div className="flex items-center gap-2">
                    <Network className="h-2.5 w-2.5 text-indigo-500" />
                    <span className="text-[10px] font-mono text-gray-700 dark:text-gray-300">
                      {resource.clusterIP}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Ports on the right */}
              {resource.ports && resource.ports.length > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Ports
                  </div>
                  <div className="flex items-center gap-1">
                    {resource.ports.slice(0, 1).map((port: any, idx: number) => (
                      <div 
                        key={idx}
                        className="text-[10px] font-mono text-gray-700 dark:text-gray-300"
                      >
                        {port.port}:{port.targetPort}
                      </div>
                    ))}
                    {resource.ports.length > 1 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        +{resource.ports.length - 1}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Age info */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {formatAge(resource.creationTimestamp)}
              </span>
            </div>
          </div>
        ) : null}
        
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
          resourceType="service"
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

export default ServiceNodeV2;