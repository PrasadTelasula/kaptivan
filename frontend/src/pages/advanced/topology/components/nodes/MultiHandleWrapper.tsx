import React from 'react';
import { Handle, Position } from 'reactflow';

interface MultiHandleWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that adds multiple invisible handles to any node
 * for connections from all directions
 */
const MultiHandleWrapper: React.FC<MultiHandleWrapperProps> = ({ children }) => {
  return (
    <div className="relative">
      {/* Top handles */}
      <Handle type="target" position={Position.Top} id="target-top" className="!w-0 !h-0 !border-0 opacity-0" style={{ top: 0 }} />
      <Handle type="source" position={Position.Top} id="source-top" className="!w-0 !h-0 !border-0 opacity-0" style={{ top: 0 }} />
      
      {/* Right handles */}
      <Handle type="source" position={Position.Right} id="source-right" className="!w-0 !h-0 !border-0 opacity-0" style={{ right: 0 }} />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-0 !h-0 !border-0 opacity-0" style={{ right: 0 }} />
      
      {/* Bottom handles */}
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-0 !h-0 !border-0 opacity-0" style={{ bottom: 0 }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-0 !h-0 !border-0 opacity-0" style={{ bottom: 0 }} />
      
      {/* Left handles */}
      <Handle type="target" position={Position.Left} id="target-left" className="!w-0 !h-0 !border-0 opacity-0" style={{ left: 0 }} />
      <Handle type="source" position={Position.Left} id="source-left" className="!w-0 !h-0 !border-0 opacity-0" style={{ left: 0 }} />
      
      {/* Default handles for backward compatibility */}
      <Handle type="target" position={Position.Top} id="target" className="!w-0 !h-0 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} id="source" className="!w-0 !h-0 !border-0 opacity-0" />
      
      {children}
    </div>
  );
};

export default MultiHandleWrapper;