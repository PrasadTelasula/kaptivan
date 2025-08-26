import React from 'react';
import { Handle, Position } from 'reactflow';
import { Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EndpointsRef } from '../../types';

interface EndpointsNodeProps {
  data: {
    label: string;
    resource: EndpointsRef;
  };
}

export const EndpointsNode: React.FC<EndpointsNodeProps> = ({ data }) => {
  const { resource } = data;
  const addressCount = resource.addresses?.length || 0;

  return (
    <div className="px-4 py-3 rounded-lg border-2 bg-purple-50 border-purple-300 min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-purple-100">
            <Network className="h-4 w-4 text-purple-600" />
          </div>
          <span className="font-medium text-sm text-purple-900">
            Endpoints
          </span>
        </div>
        <div className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-700">
          {addressCount} {addressCount === 1 ? 'IP' : 'IPs'}
        </div>
      </div>
      
      <div className="text-xs text-gray-700 font-medium truncate">
        {data.label}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};