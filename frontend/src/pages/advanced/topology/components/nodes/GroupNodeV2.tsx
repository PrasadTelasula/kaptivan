import React, { useState, useCallback } from 'react';
import { Package, Lock, ChevronDown, ChevronUp, FileCode, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { MountInfoWindow } from '../windows/MountInfoWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { formatAge } from '../../utils/age-formatter';
import type { TopologyNodeProps } from '../../types';

interface MountInfoWindowData {
  id: string;
  name: string;
  mountInfo: string[];
}

const GroupNodeV2: React.FC<TopologyNodeProps> = ({ data, id }) => {
  const { groupType, details, resource } = data;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [mountInfoWindows, setMountInfoWindows] = useState<MountInfoWindowData[]>([]);
  
  const getTypeConfig = () => {
    if (groupType === 'secret') {
      return {
        label: 'SECRETS',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        borderColor: 'border-purple-200 dark:border-purple-800',
        gradient: 'from-purple-500 to-pink-600'
      };
    }
    return {
      label: 'CONFIGMAPS',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      gradient: 'from-blue-500 to-cyan-600'
    };
  };

  const config = getTypeConfig();
  const Icon = groupType === 'secret' ? Lock : Package;

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    
    const event = new CustomEvent('groupNodeToggle', {
      detail: { 
        nodeId: id, 
        groupType, 
        expanded: !isExpanded,
        items: resource?.items || []
      }
    });
    window.dispatchEvent(event);
  }, [isExpanded, id, groupType, resource]);

  const handleViewYaml = useCallback((itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedResource(itemName);
    setShowYaml(true);
  }, []);

  // Helper to get item name
  const getItemName = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item?.name) return item.name;
    return 'unknown';
  };

  // Helper to format age
  const formatItemAge = (item: any): string => {
    try {
      // Check for creationTimestamp first (from backend)
      if (item?.resource?.creationTimestamp) {
        return formatAge(item.resource.creationTimestamp);
      }
      if (item?.creationTimestamp) {
        return formatAge(item.creationTimestamp);
      }
      // Fallback to createdAt
      if (item?.resource?.createdAt) {
        return formatAge(item.resource.createdAt);
      }
      if (item?.createdAt) {
        return formatAge(item.createdAt);
      }
    } catch (e) {
      console.error('Error formatting age:', e);
    }
    return 'Unknown';
  };

  // Helper to get mount information
  const getMountInfo = (item: any): string[] => {
    // Check for mountedAt in resource object first, then in item directly
    const mountedAt = item?.resource?.mountedAt || item?.mountedAt;
    if (!mountedAt || !Array.isArray(mountedAt) || mountedAt.length === 0) {
      return [];
    }
    return mountedAt;
  };


  return (
    <MultiHandleWrapper>
      <div className="relative group">
        {/* Status-based glow */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
          config.gradient
        )} />
        
        <div className={cn(
          "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border shadow-xl transition-all duration-300 hover:shadow-2xl",
          config.borderColor,
          isExpanded ? "w-[450px]" : "w-[400px]"
        )}>
          
          {/* Header */}
          <div className="p-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {config.label}
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white text-xs">
                    {data.label}
                  </div>
                </div>
              </div>
              <div className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              )}>
                Active ({details?.itemCount || 0})
              </div>
            </div>
          </div>
          
          {/* Items Section */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span className="font-medium">
                Resources ({isExpanded ? resource?.items?.length || 0 : details?.itemCount || 0} / {details?.itemCount || 0})
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleExpand}
                className="h-5 w-5 hover:bg-gray-100 dark:hover:bg-gray-800"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </div>
            
            {/* Item List Container */}
            {!isExpanded ? (
              // Preview mode - show first 3 items
              <div className="space-y-1">
                {details?.items && details.items.slice(0, 3).map((item: any, index: number) => {
                    const itemName = getItemName(item);
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center justify-between p-1.5 rounded-lg transition-all",
                          "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                            {itemName}
                          </span>
                          <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500 text-green-600 flex-shrink-0">
                            Ready
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          <span>{formatItemAge(item)}</span>
                        </div>
                      </div>
                    );
                  })}
                {details?.hasMore && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center pt-1">
                    +{(details.itemCount || 0) - 3} more resources
                  </div>
                )}
              </div>
            ) : (
              // Expanded mode - show all items with scrolling
              <div className="relative">
                <div 
                  className="nodrag nowheel overflow-y-auto space-y-1 pr-2 custom-scrollbar" 
                  style={{ 
                    maxHeight: '350px', 
                    minHeight: '100px',
                    pointerEvents: 'auto'
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}>
                  {resource?.items && resource.items.map((item: any, index: number) => {
                    const itemName = getItemName(item);
                    const itemAge = formatItemAge(item);
                    const itemType = item?.resource?.type || (groupType === 'secret' ? 'Opaque' : 'Data');
                    const mountInfo = getMountInfo(item);
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-2 rounded-lg transition-all group/item",
                          "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800",
                          "border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs font-medium text-gray-900 dark:text-white truncate" title={itemName}>
                                {itemName}
                              </span>
                              <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500 text-green-600 flex-shrink-0">
                                Ready
                              </Badge>
                            </div>
                          <div className="flex items-center gap-1">
                            {/* Mount Info Icon - Always show, even if not mounted */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Generate unique ID for this window
                                const windowId = `${itemName}-${Date.now()}`;
                                // Check if a window for this resource is already open
                                const existingWindow = mountInfoWindows.find(w => w.name === itemName);
                                if (!existingWindow) {
                                  setMountInfoWindows(prev => [...prev, { id: windowId, name: itemName, mountInfo }]);
                                }
                              }}
                              title={mountInfo.length > 0 ? `Mounted in ${mountInfo.length} location(s)` : "Not mounted"}
                            >
                              <Info className={cn(
                                "h-3 w-3 transition-colors",
                                mountInfo.length > 0 
                                  ? "text-gray-400 hover:text-amber-500" 
                                  : "text-gray-300 hover:text-gray-500"
                              )} />
                            </Button>
                            {/* YAML View Icon */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-transparent"
                              onClick={(e) => handleViewYaml(itemName, e)}
                            >
                              <FileCode className="h-3 w-3 text-gray-400 hover:text-blue-500 transition-colors" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Item metadata */}
                        <div className="mt-1 ml-5 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>Age: {itemAge}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>#</span>
                            <span>Type: {itemType}</span>
                          </div>
                          {mountInfo.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span>📍</span>
                              <span>Mounted: {mountInfo.length} location{mountInfo.length > 1 ? 's' : ''}</span>
                            </div>
                          )}
                          </div>
                          {/* Show keys used if available */}
                          {item?.resource?.keysUsed && item.resource.keysUsed.length > 0 && (
                            <div className="mt-1 ml-5 text-[10px] text-amber-600 dark:text-amber-400">
                              🔑 Keys referenced: {item.resource.keysUsed.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span>Namespace:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {data.namespace || 'default'}
                </span>
              </div>
              {isExpanded && (
                <div className="flex items-center gap-1">
                  <span>Click any item to view YAML</span>
                  <FileCode className="h-2.5 w-2.5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && selectedResource && data.namespace && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType={groupType}
            resourceName={selectedResource}
            namespace={data.namespace}
            context={data.context}
            onClose={() => {
              setShowYaml(false);
              setSelectedResource(null);
            }}
          />
        </TerminalPortal>
      )}
      
      {/* Mount Info Windows - Multiple can be open */}
      {mountInfoWindows.map((mountWindow, index) => (
        <TerminalPortal key={mountWindow.id}>
          <MountInfoWindow
            resourceName={mountWindow.name}
            resourceType={groupType}
            mountInfo={mountWindow.mountInfo}
            initialPosition={{
              x: window.innerWidth / 2 - 200 + (index * 30),
              y: window.innerHeight / 2 - 200 + (index * 30)
            }}
            onClose={() => {
              setMountInfoWindows(prev => prev.filter(w => w.id !== mountWindow.id));
            }}
          />
        </TerminalPortal>
      ))}
    </MultiHandleWrapper>
  );
};

export default GroupNodeV2;