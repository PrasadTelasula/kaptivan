import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Copy, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { statusToColor, statusToBorderColor } from '../../utils/status-helpers';
import type { K8sStatus } from '../../types';

interface ReplicaSetNodeData {
  label: string;
  status?: K8sStatus;
  namespace?: string;
  details?: {
    desired: number;
    ready: number;
    available?: number;
  };
}

const ReplicaSetNode = memo(({ data }: NodeProps<ReplicaSetNodeData>) => {
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
      className="px-3 py-2 rounded-lg bg-background border-2 shadow-md min-w-[160px] transition-all hover:shadow-lg"
      style={{ borderColor }}
    >
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
      <Handle type="target" position={Position.Left} className="!bg-gray-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <Copy className="h-3 w-3 text-gray-500" />
        <span className="font-medium text-xs">ReplicaSet</span>
        <StatusIcon className="h-3 w-3 ml-auto" style={{ color: statusColor }} />
      </div>
      
      <div className="text-xs truncate mb-1" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <Badge variant="secondary" className="text-xs px-1 py-0">
          {data.details.ready}/{data.details.desired} pods
        </Badge>
      )}
    </div>
  );
});

ReplicaSetNode.displayName = 'ReplicaSetNode';

export default ReplicaSetNode;