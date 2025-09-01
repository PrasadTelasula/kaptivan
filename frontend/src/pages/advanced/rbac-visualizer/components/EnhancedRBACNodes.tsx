import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  ShieldCheck, 
  Shield, 
  User, 
  Users, 
  Bot,
  CheckCircle2,
  AlertTriangle,
  Link,
  ChevronDown,
  ChevronUp,
  Crown,
  Lock,
  Eye,
  FileCode,
  Clock,
  Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../../topology/components/windows/YamlWindow';
import { TerminalPortal } from '../../topology/components/windows/TerminalPortal';
import RulePreview from './RulePreview';
import type { RBACRole, PolicyRule } from '../types';

// Enhanced ClusterRole Node with glassmorphism and expandable rules
export const EnhancedClusterRoleNode = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  
  const role: RBACRole = data.role;
  const isSystemRole = role?.metadata?.name?.startsWith('system:');
  const isAdminRole = ['cluster-admin', 'admin', 'edit'].includes(role?.metadata?.name || '');
  const isDangerous = role?.rules?.some(rule => 
    rule.verbs?.includes('*') || rule.resources?.includes('*') || 
    rule.verbs?.includes('delete') || rule.verbs?.includes('escalate')
  );

  const getGradient = () => {
    if (isAdminRole) return 'from-red-500 to-red-600';
    if (isDangerous) return 'from-orange-500 to-amber-600';
    if (isSystemRole) return 'from-gray-500 to-gray-600';
    return 'from-blue-500 to-cyan-600';
  };

  const getIcon = () => {
    if (isAdminRole) return <Crown className="h-5 w-5 text-white" />;
    if (isDangerous) return <AlertTriangle className="h-5 w-5 text-white" />;
    if (isSystemRole) return <Lock className="h-5 w-5 text-white" />;
    return <ShieldCheck className="h-5 w-5 text-white" />;
  };

  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };

  return (
    <div className="relative group">
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "!w-4 !h-4 !border-2",
          isAdminRole ? "!bg-red-500 !border-red-600" :
          isDangerous ? "!bg-orange-500 !border-orange-600" :
          isSystemRole ? "!bg-gray-500 !border-gray-600" : 
          "!bg-blue-500 !border-blue-600"
        )}
      />
      
      {/* Glow effect on hover */}
      <div className={cn(
        "absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500",
        isAdminRole ? "bg-gradient-to-r from-red-600 to-red-600" :
        isDangerous ? "bg-gradient-to-r from-orange-600 to-amber-600" :
        isSystemRole ? "bg-gradient-to-r from-gray-600 to-gray-600" :
        "bg-gradient-to-r from-blue-600 to-cyan-600"
      )} />
      
      {/* Main node container with glassmorphism */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl transition-all duration-300 hover:shadow-3xl min-w-[320px] max-w-[400px]">
        
        {/* Header with gradient */}
        <div className={cn(
          "px-4 py-3 rounded-t-2xl bg-gradient-to-r",
          getGradient()
        )}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Animated icon container */}
              <div className="relative">
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-20 blur animate-pulse",
                  "bg-gradient-to-r", getGradient()
                )} />
                <div className={cn(
                  "relative p-2.5 rounded-xl shadow-lg",
                  "bg-gradient-to-br", getGradient()
                )}>
                  {getIcon()}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-white/90 uppercase tracking-wider">
                  ClusterRole
                </div>
                {isAdminRole && <div className="text-xs text-white/80">High Privilege</div>}
                {isDangerous && !isAdminRole && <div className="text-xs text-white/80">Elevated Access</div>}
                {isSystemRole && !isAdminRole && !isDangerous && <div className="text-xs text-white/80">System Role</div>}
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
              <CheckCircle2 className="h-3 w-3 text-white" />
              <span className="text-xs font-medium text-white">Active</span>
            </div>
          </div>
          
          <div className="font-semibold text-white text-sm truncate">
            {data.label}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Metrics section */}
          <div className="space-y-2">
            {/* Rules progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Permissions</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {role?.rules?.length || 0} rules
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isAdminRole ? "bg-gradient-to-r from-red-500 to-red-600" :
                    isDangerous ? "bg-gradient-to-r from-orange-500 to-amber-600" :
                    "bg-gradient-to-r from-blue-500 to-cyan-500"
                  )}
                  style={{ width: `${Math.min((role?.rules?.length || 0) * 10, 100)}%` }}
                />
              </div>
            </div>
            
            {/* Bindings and other metrics */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.bindings || 0} bindings
                </span>
              </div>
              {data.aggregationRule && (
                <Badge variant="outline" className="text-xs">
                  Aggregated
                </Badge>
              )}
            </div>
          </div>

          {/* Expandable Rules Section */}
          {role?.rules && role.rules.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Permission Details</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(!expanded)}
                  className="h-6 px-2"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span className="ml-1 text-xs">{expanded ? 'Less' : 'More'}</span>
                </Button>
              </div>
              
              <div className={cn(
                "transition-all duration-300 overflow-hidden",
                expanded ? "max-h-[300px]" : "max-h-[100px]"
              )}>
                <div className="space-y-2 overflow-y-auto pr-2">
                  <RulePreview 
                    rules={role.rules} 
                    maxVisible={expanded ? undefined : 2}
                    showExpanded={expanded}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* YAML button - visible on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleOpenYaml}
                >
                  <FileCode className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View YAML</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.namespace && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="clusterrole"
            resourceName={role?.metadata?.name || data.label}
            namespace={data.namespace}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Enhanced Role Node (namespace-scoped) with glassmorphism
export const EnhancedRoleNode = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  
  const role: RBACRole = data.role;
  const isDangerous = role?.rules?.some(rule => 
    rule.verbs?.includes('*') || rule.resources?.includes('*') || 
    rule.verbs?.includes('delete')
  );
  const isReadOnly = role?.rules?.every(rule => 
    rule.verbs?.every(verb => ['get', 'list', 'watch'].includes(verb))
  );

  const getGradient = () => {
    if (isDangerous) return 'from-orange-500 to-amber-600';
    if (isReadOnly) return 'from-emerald-500 to-emerald-600';
    return 'from-green-500 to-green-600';
  };

  const getIcon = () => {
    if (isDangerous) return <AlertTriangle className="h-5 w-5 text-white" />;
    if (isReadOnly) return <Eye className="h-5 w-5 text-white" />;
    return <Shield className="h-5 w-5 text-white" />;
  };

  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };

  return (
    <div className="relative group">
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "!w-4 !h-4 !border-2",
          isDangerous ? "!bg-orange-500 !border-orange-600" :
          isReadOnly ? "!bg-emerald-500 !border-emerald-600" :
          "!bg-green-500 !border-green-600"
        )}
      />
      
      {/* Glow effect on hover */}
      <div className={cn(
        "absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500",
        "bg-gradient-to-r",
        isDangerous ? "from-orange-600 to-amber-600" :
        isReadOnly ? "from-emerald-600 to-emerald-600" :
        "from-green-600 to-green-600"
      )} />
      
      {/* Main node container with glassmorphism */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl transition-all duration-300 hover:shadow-3xl min-w-[300px] max-w-[380px]">
        
        {/* Header with gradient */}
        <div className={cn(
          "px-4 py-3 rounded-t-2xl bg-gradient-to-r",
          getGradient()
        )}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Animated icon container */}
              <div className="relative">
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-20 blur animate-pulse",
                  "bg-gradient-to-r", getGradient()
                )} />
                <div className={cn(
                  "relative p-2.5 rounded-xl shadow-lg",
                  "bg-gradient-to-br", getGradient()
                )}>
                  {getIcon()}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-white/90 uppercase tracking-wider">
                  Role
                </div>
                {isDangerous && <div className="text-xs text-white/80">Elevated Access</div>}
                {isReadOnly && <div className="text-xs text-white/80">Read Only</div>}
              </div>
            </div>
            
            {/* Namespace badge */}
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {data.namespace || 'default'}
            </Badge>
          </div>
          
          <div className="font-semibold text-white text-sm truncate">
            {data.label}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Metrics section */}
          <div className="space-y-2">
            {/* Rules progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Permissions</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {role?.rules?.length || 0} rules
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isDangerous ? "bg-gradient-to-r from-orange-500 to-amber-500" :
                    isReadOnly ? "bg-gradient-to-r from-emerald-500 to-emerald-600" :
                    "bg-gradient-to-r from-green-500 to-green-600"
                  )}
                  style={{ width: `${Math.min((role?.rules?.length || 0) * 10, 100)}%` }}
                />
              </div>
            </div>
            
            {/* Bindings */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Link className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.bindings || 0} bindings
                </span>
              </div>
            </div>
          </div>

          {/* Expandable Rules Section */}
          {role?.rules && role.rules.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Permission Details</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(!expanded)}
                  className="h-6 px-2"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span className="ml-1 text-xs">{expanded ? 'Less' : 'More'}</span>
                </Button>
              </div>
              
              <div className={cn(
                "transition-all duration-300 overflow-hidden",
                expanded ? "max-h-[250px]" : "max-h-[80px]"
              )}>
                <div className="space-y-2 overflow-y-auto pr-2">
                  <RulePreview 
                    rules={role.rules} 
                    maxVisible={expanded ? undefined : 2}
                    showExpanded={expanded}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* YAML button - visible on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleOpenYaml}
                >
                  <FileCode className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View YAML</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.namespace && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="role"
            resourceName={role?.metadata?.name || data.label}
            namespace={data.namespace}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Enhanced ServiceAccount Node with glassmorphism
export const EnhancedServiceAccountNode = ({ data }: { data: any }) => {
  const [showYaml, setShowYaml] = useState(false);

  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };

  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-4 !h-4 !bg-purple-500 !border-2 !border-purple-600" 
      />
      
      {/* Glow effect on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500" />
      
      {/* Main node container with glassmorphism */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl transition-all duration-300 hover:shadow-3xl min-w-[260px]">
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 rounded-t-2xl">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Animated icon container */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl opacity-20 blur animate-pulse" />
                <div className="relative bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-white/90 uppercase tracking-wider">
                  Service Account
                </div>
                <div className="text-xs text-white/80">Kubernetes Identity</div>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white">Active</span>
            </div>
          </div>
          
          <div className="font-semibold text-white text-sm truncate">
            {data.label}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Namespace */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Namespace</span>
            <Badge variant="secondary" className="text-xs">
              {data.namespace || 'default'}
            </Badge>
          </div>
          
          {/* Secrets if available */}
          {data.secrets && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Secrets</span>
              <Badge variant="outline" className="text-xs">
                {data.secrets} mounted
              </Badge>
            </div>
          )}
          
          {/* Bindings count */}
          {data.bindings !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t">
              <div className="flex items-center gap-2">
                <Link className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.bindings} role bindings
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* YAML button - visible on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleOpenYaml}
                >
                  <FileCode className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View YAML</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.namespace && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="serviceaccount"
            resourceName={data.label}
            namespace={data.namespace}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Enhanced Subject Node (User/Group) with glassmorphism
export const EnhancedSubjectNode = ({ data }: { data: any }) => {
  const isGroup = data.kind === 'Group';
  
  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className={cn(
          "!w-4 !h-4 !border-2",
          isGroup ? "!bg-indigo-500 !border-indigo-600" : "!bg-orange-500 !border-orange-600"
        )}
      />
      
      {/* Glow effect on hover */}
      <div className={cn(
        "absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500",
        isGroup ? "bg-gradient-to-r from-indigo-600 to-indigo-600" : "bg-gradient-to-r from-orange-600 to-orange-600"
      )} />
      
      {/* Main node container with glassmorphism */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl transition-all duration-300 hover:shadow-3xl min-w-[240px]">
        <div className={cn(
          "px-4 py-3 rounded-2xl bg-gradient-to-r",
          isGroup ? "from-indigo-500 to-indigo-600" : "from-orange-500 to-orange-600"
        )}>
          <div className="flex items-center gap-3">
            {/* Icon with animation */}
            <div className="relative">
              <div className={cn(
                "absolute inset-0 rounded-xl opacity-20 blur animate-pulse",
                isGroup ? "bg-indigo-500" : "bg-orange-500"
              )} />
              <div className={cn(
                "relative p-2 rounded-xl shadow-lg",
                isGroup ? "bg-gradient-to-br from-indigo-500 to-indigo-600" : "bg-gradient-to-br from-orange-500 to-orange-600"
              )}>
                {isGroup ? (
                  <Users className="h-4 w-4 text-white" />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/90 uppercase tracking-wider">
                {data.kind}
              </div>
              <div className="font-semibold text-white text-sm truncate">
                {data.label}
              </div>
              {data.namespace && (
                <div className="text-xs text-white/70">
                  {data.namespace}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Binding Node with glassmorphism
export const EnhancedBindingNode = ({ data }: { data: any }) => {
  const isClusterBinding = data.type === 'ClusterRoleBinding';
  
  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-gray-500 !border-gray-600"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-gray-500 !border-gray-600"
      />
      
      {/* Subtle glow on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-gray-400 to-gray-500 rounded-lg opacity-0 group-hover:opacity-10 blur transition duration-300" />
      
      {/* Main node container */}
      <div className={cn(
        "relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-all min-w-[180px]",
        "border",
        isClusterBinding ? "border-blue-300/50" : "border-green-300/50"
      )}>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1 rounded",
              isClusterBinding ? "bg-blue-100 dark:bg-blue-900/30" : "bg-green-100 dark:bg-green-900/30"
            )}>
              <Link className={cn(
                "w-3 h-3",
                isClusterBinding ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{data.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {data.type}
                {data.namespace && ` • ${data.namespace}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const enhancedNodeTypes = {
  clusterRole: EnhancedClusterRoleNode,
  role: EnhancedRoleNode,
  serviceAccount: EnhancedServiceAccountNode,
  subject: EnhancedSubjectNode,
  binding: EnhancedBindingNode,
};