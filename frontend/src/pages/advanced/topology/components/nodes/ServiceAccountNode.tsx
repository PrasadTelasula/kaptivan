import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Shield } from 'lucide-react';

interface ServiceAccountNodeData {
  label: string;
  details?: {
    automount?: boolean;
    secrets: number;
  };
}

const ServiceAccountNode = memo(({ data }: NodeProps<ServiceAccountNodeData>) => {
  return (
    <div className="px-3 py-2 rounded-lg bg-background border-2 border-violet-500 shadow-md min-w-[140px] transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-violet-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="h-3 w-3 text-violet-500" />
        <span className="font-medium text-xs">ServiceAccount</span>
        <Shield className="h-3 w-3 ml-auto text-muted-foreground" />
      </div>
      
      <div className="text-xs truncate mb-1" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="space-y-1">
          {data.details.automount !== undefined && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {data.details.automount ? 'Auto-mount' : 'Manual'}
            </Badge>
          )}
          {data.details.secrets > 0 && (
            <div className="text-xs text-muted-foreground">
              {data.details.secrets} secret{data.details.secrets > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ServiceAccountNode.displayName = 'ServiceAccountNode';

export default ServiceAccountNode;