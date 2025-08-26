import React from 'react';
import { Handle, Position } from 'reactflow';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RoleBindingRef } from '../../types';

interface RoleBindingNodeProps {
  data: {
    label: string;
    resource: RoleBindingRef;
    isClusterRoleBinding?: boolean;
  };
}

export const RoleBindingNode: React.FC<RoleBindingNodeProps> = ({ data }) => {
  const { resource, isClusterRoleBinding } = data;
  const subjectCount = resource.subjects?.length || 0;

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${
      isClusterRoleBinding 
        ? 'bg-pink-50 border-pink-300' 
        : 'bg-yellow-50 border-yellow-300'
    } min-w-[200px]`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${isClusterRoleBinding ? 'bg-pink-100' : 'bg-yellow-100'}`}>
            <Link2 className={`h-4 w-4 ${isClusterRoleBinding ? 'text-pink-600' : 'text-yellow-600'}`} />
          </div>
          <span className={`font-medium text-sm ${isClusterRoleBinding ? 'text-pink-900' : 'text-yellow-900'}`}>
            {isClusterRoleBinding ? 'ClusterRoleBinding' : 'RoleBinding'}
          </span>
        </div>
        <div className={`text-xs px-2 py-0.5 rounded-full ${
          isClusterRoleBinding ? 'bg-pink-200 text-pink-700' : 'bg-yellow-200 text-yellow-700'
        }`}>
          {subjectCount}
        </div>
      </div>
      
      <div className="text-xs text-gray-700 font-medium truncate">
        {data.label}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};