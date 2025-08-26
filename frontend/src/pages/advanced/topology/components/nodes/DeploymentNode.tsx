import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Server, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { statusToColor, statusToBorderColor } from '../../utils/status-helpers';
import type { K8sStatus } from '../../types';

interface DeploymentNodeData {
  label: string;
  status?: K8sStatus;
  namespace?: string;
  details?: {
    replicas: number;
    available: number;
    ready?: number;
    strategy?: string;
  };
}

const DeploymentNode = memo(({ data }: NodeProps<DeploymentNodeData>) => {
  const status = data.status || 'Unknown';
  const borderColor = statusToBorderColor(status);
  const statusColor = statusToColor(status);
  
  const StatusIcon = {
    Healthy: CheckCircle2,
    Warning: AlertCircle,
    Error: XCircle,
    Unknown: AlertCircle
  }[status];
  
  return (
    <div
      className="px-4 py-3 rounded-lg bg-background border-2 shadow-lg min-w-[180px] transition-all hover:shadow-xl"
      style={{ borderColor }}
    >
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />
      
      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-sm">Deployment</span>
        <StatusIcon className="h-4 w-4 ml-auto" style={{ color: statusColor }} />
      </div>
      
      <div className="text-xs font-medium mb-2 truncate" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {data.details.available}/{data.details.replicas} ready
          </Badge>
          {data.details.strategy && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              {data.details.strategy}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
});

DeploymentNode.displayName = 'DeploymentNode';

export default DeploymentNode;