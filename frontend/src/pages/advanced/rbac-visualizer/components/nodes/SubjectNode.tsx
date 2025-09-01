import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, Users, Bot } from 'lucide-react';

interface SubjectNodeProps {
  data: {
    label: string;
    type: 'user' | 'group' | 'serviceaccount';
    namespace?: string;
    kind?: string;
    onClick?: () => void;
  };
}

export default function SubjectNode({ data }: SubjectNodeProps) {
  const getIcon = () => {
    switch (data.type) {
      case 'user':
        return <User className="w-5 h-5 text-orange-600" />;
      case 'group':
        return <Users className="w-5 h-5 text-purple-600" />;
      case 'serviceaccount':
        return <Bot className="w-5 h-5 text-pink-600" />;
      default:
        return <User className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStyle = () => {
    switch (data.type) {
      case 'user':
        return 'bg-orange-50 border-orange-400 hover:bg-orange-100';
      case 'group':
        return 'bg-purple-50 border-purple-400 hover:bg-purple-100';
      case 'serviceaccount':
        return 'bg-pink-50 border-pink-400 hover:bg-pink-100';
      default:
        return 'bg-gray-50 border-gray-400 hover:bg-gray-100';
    }
  };

  const getHandleColor = () => {
    switch (data.type) {
      case 'user':
        return '#f59e0b';
      case 'group':
        return '#8b5cf6';
      case 'serviceaccount':
        return '#ec4899';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      className={`px-4 py-2 shadow-lg rounded-full border-2 cursor-pointer transition-all hover:shadow-xl ${getStyle()}`}
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3"
        style={{ background: getHandleColor() }}
      />
      
      <div className="flex items-center gap-2">
        {getIcon()}
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          {data.namespace && (
            <div className="text-xs text-gray-600">{data.namespace}</div>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3"
        style={{ background: getHandleColor() }}
      />
    </div>
  );
}