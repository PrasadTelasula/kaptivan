import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Key, Lock } from 'lucide-react';

interface SecretNodeData {
  label: string;
  details?: {
    type: string;
    mountedAt?: string[];
  };
}

const SecretNode = memo(({ data }: NodeProps<SecretNodeData>) => {
  return (
    <div className="px-3 py-2 rounded-lg bg-background border-2 border-orange-500 shadow-md min-w-[140px] transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-orange-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <Key className="h-3 w-3 text-orange-500" />
        <span className="font-medium text-xs">Secret</span>
        <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
      </div>
      
      <div className="text-xs truncate mb-1" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {data.details.type}
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

SecretNode.displayName = 'SecretNode';

export default SecretNode;