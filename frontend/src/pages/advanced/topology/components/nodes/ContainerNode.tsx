import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { statusToColor } from '../../utils/status-helpers';
import type { K8sStatus } from '../../types';

interface ContainerNodeData {
  label: string;
  status?: K8sStatus;
  details?: {
    image: string;
    ready: boolean;
    state?: string;
    restartCount?: number;
  };
}

const ContainerNode = memo(({ data }: NodeProps<ContainerNodeData>) => {
  const status = data.status || 'Unknown';
  const statusColor = statusToColor(status);
  
  const StatusIcon = {
    Healthy: CheckCircle,
    Warning: AlertCircle,
    Error: XCircle,
    Unknown: AlertCircle
  }[status];
  
  return (
    <div
      className="px-2 py-1.5 rounded-md bg-background border shadow-sm min-w-[120px] transition-all hover:shadow-md"
      style={{ borderColor: statusColor }}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-500" />
      
      <div className="flex items-center gap-1 mb-1">
        <Package className="h-3 w-3 text-purple-500" />
        <span className="text-xs">Container</span>
        <StatusIcon className="h-3 w-3 ml-auto" style={{ color: statusColor }} />
      </div>
      
      <div className="text-xs font-medium truncate" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="mt-1 space-y-0.5">
          <div className="text-xs text-muted-foreground truncate" title={data.details.image}>
            {data.details.image}
          </div>
          {data.details.restartCount !== undefined && data.details.restartCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              {data.details.restartCount} restarts
            </Badge>
          )}
        </div>
      )}
    </div>
  );
});

ContainerNode.displayName = 'ContainerNode';

export default ContainerNode;