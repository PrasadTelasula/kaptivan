import React, { useState, useRef, useEffect } from 'react';
import { Package, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MountInfoWindowProps {
  resourceName: string;
  resourceType: 'secret' | 'configmap';
  mountInfo: string[];
  initialPosition?: { x: number; y: number };
  onClose: () => void;
}

interface MountData {
  path: string;
  type: 'volume' | 'env' | 'envFrom' | 'defined';
}

export const MountInfoWindow: React.FC<MountInfoWindowProps> = ({
  resourceName,
  resourceType,
  mountInfo,
  initialPosition,
  onClose
}) => {
  const [position, setPosition] = useState(
    initialPosition || { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 200 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Helper to format mount path
  const formatMountPath = (path: string): { container?: string; mountPath: string; type: 'volume' | 'env' | 'envFrom' | 'defined'; keyName?: string } => {
    const parts = path.split(':');
    
    if (parts.length >= 2) {
      const container = parts[0];
      const mountType = parts[1];
      
      if (container === 'defined-as-volume') {
        return { container: undefined, mountPath: `Defined as volume "${mountType}" but not mounted`, type: 'defined' };
      } else if (mountType === 'env' && parts.length >= 3) {
        // Check if this includes key information (container:env:ENV_NAME:key:KEY_NAME)
        if (parts.length >= 5 && parts[3] === 'key') {
          return { 
            container, 
            mountPath: `${parts[2]} (from key: ${parts[4]})`, 
            type: 'env',
            keyName: parts[4]
          };
        }
        return { container, mountPath: parts[2], type: 'env' };
      } else if (mountType === 'envFrom') {
        return { container, mountPath: 'All keys as environment variables', type: 'envFrom' };
      } else {
        return { container, mountPath: parts[1], type: 'volume' };
      }
    }
    
    return { mountPath: path, type: 'volume' };
  };

  // Group mounts by container
  const groupMountsByContainer = (mountInfo: string[]): Map<string, MountData[]> => {
    const grouped = new Map<string, MountData[]>();
    
    mountInfo.forEach(path => {
      const parsed = formatMountPath(path);
      
      // Handle special case for volumes defined but not mounted
      if (parsed.type === 'defined') {
        const key = 'Volume Definitions (Not Mounted)';
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push({
          path: parsed.mountPath,
          type: parsed.type
        });
      } else {
        const container = parsed.container || 'unknown';
        if (!grouped.has(container)) {
          grouped.set(container, []);
        }
        grouped.get(container)!.push({
          path: parsed.mountPath,
          type: parsed.type
        });
      }
    });
    
    return grouped;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const groupedMounts = groupMountsByContainer(mountInfo);

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed z-[9999] bg-gray-900 rounded-lg shadow-2xl border border-gray-700",
        "w-96",
        isDragging && "cursor-move"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="window-header flex items-center justify-between p-3 border-b border-gray-700 cursor-move">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-semibold text-white">
            Mount Information: {resourceName}
          </h4>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-gray-800"
          onClick={onClose}
        >
          <X className="h-3 w-3 text-gray-400" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {groupedMounts.size === 0 ? (
          <div className="text-center py-8">
            <Info className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-300">This {resourceType} is not mounted in any containers</p>
            <p className="text-xs text-gray-400 mt-2">
              It may be referenced in other ways or used by operators
            </p>
          </div>
        ) : (
          Array.from(groupedMounts).map(([containerName, mounts]) => (
          <div key={containerName} className="border border-gray-700 rounded-md p-2 bg-gray-800/50">
            <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Package className="h-3 w-3" />
              <span>Container: {containerName}</span>
            </div>
            <div className="space-y-1 ml-5">
              {mounts.map((mount, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "h-4 px-1 text-[10px] flex-shrink-0",
                      mount.type === 'env' && "border-blue-500 text-blue-600",
                      mount.type === 'envFrom' && "border-purple-500 text-purple-600",
                      mount.type === 'volume' && "border-green-500 text-green-600",
                      mount.type === 'defined' && "border-amber-500 text-amber-600"
                    )}
                  >
                    {mount.type === 'env' ? 'ENV' : mount.type === 'envFrom' ? 'ENV*' : mount.type === 'defined' ? 'DEF' : 'VOL'}
                  </Badge>
                  <div className="text-xs text-white font-mono break-all">
                    {mount.path}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <div className="text-[10px] text-gray-400 space-y-1">
          {groupedMounts.size > 0 ? (
            <div>
              Used in {groupedMounts.size} container{groupedMounts.size > 1 ? 's' : ''} • {mountInfo.length} total reference{mountInfo.length > 1 ? 's' : ''}
            </div>
          ) : (
            <div>
              Not mounted in any containers
            </div>
          )}
          {groupedMounts.size > 0 && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="font-medium">Legend:</span>
              <Badge variant="outline" className="h-3 px-1 text-[9px] border-green-500 text-green-600">VOL</Badge>
              <span className="text-[9px]">Volume</span>
              <Badge variant="outline" className="h-3 px-1 text-[9px] border-blue-500 text-blue-600">ENV</Badge>
              <span className="text-[9px]">Env Var</span>
              <Badge variant="outline" className="h-3 px-1 text-[9px] border-purple-500 text-purple-600">ENV*</Badge>
              <span className="text-[9px]">All Env</span>
              <Badge variant="outline" className="h-3 px-1 text-[9px] border-amber-500 text-amber-600">DEF</Badge>
              <span className="text-[9px]">Defined</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};