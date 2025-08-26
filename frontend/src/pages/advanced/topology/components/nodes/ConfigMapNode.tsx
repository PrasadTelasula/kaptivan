import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { FileJson, Settings } from 'lucide-react';

interface ConfigMapNodeData {
  label: string;
  details?: {
    mountedAt?: string[];
    keys: number;
  };
}

const ConfigMapNode = memo(({ data }: NodeProps<ConfigMapNodeData>) => {
  return (
    <div className="px-3 py-2 rounded-lg bg-background border-2 border-cyan-500 shadow-md min-w-[140px] transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-cyan-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <FileJson className="h-3 w-3 text-cyan-500" />
        <span className="font-medium text-xs">ConfigMap</span>
        <Settings className="h-3 w-3 ml-auto text-muted-foreground" />
      </div>
      
      <div className="text-xs truncate mb-1" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {data.details.keys} key{data.details.keys !== 1 ? 's' : ''}
          </Badge>
          {data.details.mountedAt && data.details.mountedAt.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {data.details.mountedAt.length} mount{data.details.mountedAt.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ConfigMapNode.displayName = 'ConfigMapNode';

export default ConfigMapNode;