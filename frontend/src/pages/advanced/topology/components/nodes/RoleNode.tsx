import React from 'react';
import { Handle, Position } from 'reactflow';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RoleRef } from '../../types';

interface RoleNodeProps {
  data: {
    label: string;
    resource: RoleRef;
    isClusterRole?: boolean;
  };
}

export const RoleNode: React.FC<RoleNodeProps> = ({ data }) => {
  const { resource, isClusterRole } = data;
  const ruleCount = resource.rules?.length || 0;

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${
      isClusterRole 
        ? 'bg-red-50 border-red-300' 
        : 'bg-orange-50 border-orange-300'
    } min-w-[200px]`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${isClusterRole ? 'bg-red-100' : 'bg-orange-100'}`}>
            <Shield className={`h-4 w-4 ${isClusterRole ? 'text-red-600' : 'text-orange-600'}`} />
          </div>
          <span className={`font-medium text-sm ${isClusterRole ? 'text-red-900' : 'text-orange-900'}`}>
            {isClusterRole ? 'ClusterRole' : 'Role'}
          </span>
        </div>
        <div className={`text-xs px-2 py-0.5 rounded-full ${
          isClusterRole ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700'
        }`}>
          {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
        </div>
      </div>
      
      <div className="text-xs text-gray-700 font-medium truncate">
        {data.label}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};