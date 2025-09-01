import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Shield, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RoleNodeProps {
  data: {
    label: string;
    type: 'role' | 'clusterRole';
    rules?: number;
    namespace?: string;
    onClick?: () => void;
  };
}

export default function RoleNode({ data }: RoleNodeProps) {
  const isClusterRole = data.type === 'clusterRole';
  
  return (
    <div
      className={`px-4 py-2 shadow-lg rounded-lg border-2 cursor-pointer transition-all hover:shadow-xl ${
        isClusterRole
          ? 'bg-blue-50 border-blue-400 hover:bg-blue-100'
          : 'bg-green-50 border-green-400 hover:bg-green-100'
      }`}
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3"
        style={{ background: isClusterRole ? '#3b82f6' : '#10b981' }}
      />
      
      <div className="flex items-center gap-2">
        {isClusterRole ? (
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        ) : (
          <Shield className="w-5 h-5 text-green-600" />
        )}
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs text-gray-600">
            {data.namespace || 'cluster-wide'}
          </div>
          {data.rules !== undefined && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {data.rules} rules
            </Badge>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3"
        style={{ background: isClusterRole ? '#3b82f6' : '#10b981' }}
      />
    </div>
  );
}