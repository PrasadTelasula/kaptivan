import React from 'react';
import { Handle, Position } from 'reactflow';
import { 
  ShieldCheck, 
  Shield, 
  User, 
  Users, 
  Bot,
  CheckCircle2,
  AlertCircle,
  Link,
  Key,
  Lock,
  Unlock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ClusterRole Node - Similar to Deployment card
export const ClusterRoleNode = ({ data }: { data: any }) => (
  <div className="relative">
    <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    <div className="bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-lg shadow-xl hover:shadow-2xl transition-all min-w-[280px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-semibold text-sm">CLUSTERROLE</span>
          </div>
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="text-lg font-bold mt-1">{data.label}</div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Rules</span>
          <Badge variant="secondary">{data.rules || 0} rules</Badge>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Bindings</span>
          <Badge variant="outline">{data.bindings || 0} bindings</Badge>
        </div>
        
        {data.aggregationRule && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">Aggregation Rule</div>
            <div className="text-xs font-mono mt-1">{data.aggregationRule}</div>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Role Node - Similar to ReplicaSet card
export const RoleNode = ({ data }: { data: any }) => (
  <div className="relative">
    <Handle type="source" position={Position.Right} className="!bg-green-500" />
    <div className="bg-white dark:bg-gray-900 border-2 border-green-500 rounded-lg shadow-xl hover:shadow-2xl transition-all min-w-[280px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-semibold text-sm">ROLE</span>
          </div>
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="text-lg font-bold mt-1">{data.label}</div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Namespace</span>
          <Badge variant="secondary">{data.namespace || 'default'}</Badge>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Rules</span>
          <Badge variant="secondary">{data.rules || 0} rules</Badge>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Bindings</span>
          <Badge variant="outline">{data.bindings || 0} bindings</Badge>
        </div>
      </div>
    </div>
  </div>
);

// ServiceAccount Node - Similar to Pod card
export const ServiceAccountNode = ({ data }: { data: any }) => (
  <div className="relative">
    <Handle type="target" position={Position.Left} className="!bg-purple-500" />
    <div className="bg-white dark:bg-gray-900 border-2 border-purple-500 rounded-lg shadow-xl hover:shadow-2xl transition-all min-w-[260px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span className="font-semibold text-sm">SERVICE ACCOUNT</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs">Active</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{data.label}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Namespace</span>
          <Badge variant="secondary" className="text-xs">
            {data.namespace || 'default'}
          </Badge>
        </div>
        
        {data.secrets && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Secrets</span>
            <Badge variant="outline" className="text-xs">
              {data.secrets} secrets
            </Badge>
          </div>
        )}
      </div>
    </div>
  </div>
);

// User/Group Node - Similar to Service card
export const SubjectNode = ({ data }: { data: any }) => (
  <div className="relative">
    <Handle type="target" position={Position.Left} className="!bg-orange-500" />
    <div className="bg-white dark:bg-gray-900 border-2 border-orange-500 rounded-lg shadow-xl hover:shadow-2xl transition-all min-w-[240px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.kind === 'Group' ? (
              <Users className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
            <span className="font-semibold text-sm uppercase">{data.kind}</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="text-sm font-semibold">{data.label}</div>
        
        {data.apiGroup && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">API Group</span>
            <span className="text-xs font-mono">{data.apiGroup}</span>
          </div>
        )}
        
        {data.namespace && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Namespace</span>
            <Badge variant="secondary" className="text-xs">
              {data.namespace}
            </Badge>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Binding Node - Smaller connection node
export const BindingNode = ({ data }: { data: any }) => (
  <div className="relative">
    <Handle type="target" position={Position.Left} className="!bg-gray-500" />
    <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    <div className="bg-white dark:bg-gray-800 border border-gray-400 rounded-md shadow-md px-3 py-2 min-w-[180px]">
      <div className="flex items-center gap-2">
        <Link className="w-4 h-4 text-gray-500" />
        <div>
          <div className="text-xs font-semibold truncate">{data.label}</div>
          <div className="text-xs text-muted-foreground">{data.type}</div>
        </div>
      </div>
    </div>
  </div>
);

export const nodeTypes = {
  clusterRole: ClusterRoleNode,
  role: RoleNode,
  serviceAccount: ServiceAccountNode,
  subject: SubjectNode,
  binding: BindingNode,
};