import React from 'react';
import { Handle, Position } from 'reactflow';
import { cn } from '@/lib/utils';

interface BaseNodeProps {
  children: React.ReactNode;
  handleColor?: string;
  showHandles?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

const BaseNodeV2: React.FC<BaseNodeProps> = ({ 
  children, 
  handleColor = '#6b7280',
  showHandles = { top: true, bottom: true, left: true, right: true }
}) => {
  return (
    <div className="relative">
      {/* Top Handle */}
      {showHandles.top && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="target-top"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="source-top"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor, top: -5 }}
          />
        </>
      )}
      
      {/* Right Handle */}
      {showHandles.right && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="source-right"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor }}
          />
          <Handle
            type="target"
            position={Position.Right}
            id="target-right"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor, right: -5 }}
          />
        </>
      )}
      
      {/* Bottom Handle */}
      {showHandles.bottom && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor }}
          />
          <Handle
            type="target"
            position={Position.Bottom}
            id="target-bottom"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor, bottom: -5 }}
          />
        </>
      )}
      
      {/* Left Handle */}
      {showHandles.left && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="target-left"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="source-left"
            className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900 opacity-0"
            style={{ background: handleColor, left: -5 }}
          />
        </>
      )}
      
      {children}
    </div>
  );
};

export default BaseNodeV2;