import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Network, Globe, Cloud, Share2 } from 'lucide-react';

interface ServiceNodeData {
  label: string;
  namespace?: string;
  details?: {
    type: string;
    clusterIP?: string;
    ports: Array<{
      port: number;
      targetPort: number | string;
      protocol: string;
    }>;
  };
}

const ServiceNode = memo(({ data }: NodeProps<ServiceNodeData>) => {
  const TypeIcon = {
    ClusterIP: Network,
    NodePort: Share2,
    LoadBalancer: Cloud,
    ExternalName: Globe
  }[data.details?.type || 'ClusterIP'] || Network;
  
  const typeColor = {
    ClusterIP: 'text-green-500',
    NodePort: 'text-blue-500',
    LoadBalancer: 'text-purple-500',
    ExternalName: 'text-orange-500'
  }[data.details?.type || 'ClusterIP'];
  
  return (
    <div className="px-4 py-3 rounded-lg bg-background border-2 border-green-500 shadow-lg min-w-[180px] transition-all hover:shadow-xl">
      <Handle type="source" position={Position.Right} className="!bg-green-500" />
      <Handle type="target" position={Position.Left} className="!bg-green-500" />
      
      <div className="flex items-center gap-2 mb-2">
        <TypeIcon className={`h-4 w-4 ${typeColor}`} />
        <span className="font-semibold text-sm">Service</span>
      </div>
      
      <div className="text-xs font-medium mb-2 truncate" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {data.details.type}
          </Badge>
          {data.details.ports.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {data.details.ports[0].port}:{data.details.ports[0].targetPort}
              {data.details.ports.length > 1 && ` +${data.details.ports.length - 1}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';

export default ServiceNode;