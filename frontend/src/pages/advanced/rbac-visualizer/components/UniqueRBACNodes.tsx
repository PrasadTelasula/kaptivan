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
  Sparkles,
  Zap,
  Key,
  UserCheck,
  ShieldAlert,
  ShieldOff,
  Activity,
  Fingerprint,
  Gauge,
  TrendingUp,
  AlertOctagon,
  LockKeyhole,
  Package,
  Box,
  Clock,
  Circle,
  Container,
  Info,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  HoverCard, 
  HoverCardContent, 
  HoverCardTrigger 
} from '@/components/ui/hover-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../../topology/components/windows/YamlWindow';
import { TerminalPortal } from '../../topology/components/windows/TerminalPortal';
import RulePreview from './RulePreview';
import type { RBACRole, PolicyRule } from '../types';

// Unique ClusterRole Node with modern card design
export const UniqueClusterRoleNode = ({ data }: { data: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  
  const role: RBACRole = data.role;
  const isSystemRole = role?.metadata?.name?.startsWith('system:');
  const isAdminRole = ['cluster-admin', 'admin', 'edit'].includes(role?.metadata?.name || '');
  const isDangerous = role?.rules?.some(rule => 
    rule.verbs?.includes('*') || rule.resources?.includes('*') || 
    rule.verbs?.includes('delete') || rule.verbs?.includes('escalate')
  );

  // Calculate risk score (0-100)
  const calculateRiskScore = () => {
    let score = 0;
    if (!role?.rules) return 0;
    
    role.rules.forEach(rule => {
      if (rule.verbs?.includes('*')) score += 30;
      if (rule.resources?.includes('*')) score += 25;
      if (rule.verbs?.includes('delete')) score += 15;
      if (rule.verbs?.includes('escalate')) score += 20;
      if (rule.verbs?.includes('bind')) score += 10;
    });
    
    return Math.min(score, 100);
  };

  const riskScore = calculateRiskScore();

  const getRiskColor = () => {
    if (riskScore > 70) return 'text-red-500';
    if (riskScore > 40) return 'text-orange-500';
    return 'text-green-500';
  };

  const getRiskBadge = () => {
    if (riskScore > 70) return { label: 'Critical', variant: 'destructive' as const };
    if (riskScore > 40) return { label: 'High', variant: 'default' as const };
    return { label: 'Low', variant: 'secondary' as const };
  };

  return (
    <div className="relative group">
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "!w-3 !h-3 !border-2 transition-all",
          isAdminRole ? "!bg-red-500 !border-red-600" :
          isDangerous ? "!bg-orange-500 !border-orange-600" :
          "!bg-blue-500 !border-blue-600"
        )}
      />
      
      {/* Modern card design with subtle animations */}
      <div className="relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 min-w-[360px] overflow-hidden">
        
        {/* Decorative gradient accent */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1",
          "bg-gradient-to-r",
          isAdminRole ? "from-red-500 via-red-400 to-pink-500" :
          isDangerous ? "from-orange-500 via-amber-400 to-yellow-500" :
          isSystemRole ? "from-gray-500 via-gray-400 to-slate-500" :
          "from-blue-500 via-cyan-400 to-teal-500"
        )} />
        
        {/* Header with avatar and badges */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className={cn(
                "h-10 w-10 ring-2 ring-offset-2",
                isAdminRole ? "ring-red-200 dark:ring-red-800" :
                isDangerous ? "ring-orange-200 dark:ring-orange-800" :
                "ring-blue-200 dark:ring-blue-800"
              )}>
                <AvatarFallback className={cn(
                  "bg-gradient-to-br text-white",
                  isAdminRole ? "from-red-500 to-red-600" :
                  isDangerous ? "from-orange-500 to-amber-600" :
                  isSystemRole ? "from-gray-500 to-gray-600" :
                  "from-blue-500 to-cyan-600"
                )}>
                  {isAdminRole ? <Crown className="h-5 w-5" /> :
                   isDangerous ? <ShieldAlert className="h-5 w-5" /> :
                   isSystemRole ? <Lock className="h-5 w-5" /> :
                   <ShieldCheck className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate max-w-[200px]">
                    {data.label}
                  </h3>
                  {isSystemRole && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      <Fingerprint className="w-3 h-3 mr-1" />
                      System
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    ClusterRole
                  </Badge>
                  <Badge variant={getRiskBadge().variant} className="text-xs px-1.5 py-0">
                    {getRiskBadge().label} Risk
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYaml(true);
                    }}
                  >
                    <FileCode className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View YAML</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <Zap className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">{role?.rules?.length || 0}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Rules</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <Link className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">{data.bindings || 0}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Bindings</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <Gauge className={cn("h-3 w-3", getRiskColor())} />
                <span className={cn("text-xs font-medium", getRiskColor())}>{riskScore}%</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Risk</div>
            </div>
          </div>

          {/* Risk Score Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Security Risk Assessment</span>
              <TrendingUp className={cn("h-3 w-3", getRiskColor())} />
            </div>
            <Progress 
              value={riskScore} 
              className={cn(
                "h-1.5",
                riskScore > 70 ? "[&>div]:bg-red-500" :
                riskScore > 40 ? "[&>div]:bg-orange-500" :
                "[&>div]:bg-green-500"
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Expandable Rules Section */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full rounded-none justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Permission Details</span>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2">
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {role?.rules && role.rules.length > 0 ? (
                  <RulePreview 
                    rules={role.rules} 
                    showExpanded={true}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No rules defined
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="clusterrole"
            resourceName={role?.metadata?.name || data.label}
            namespace=""
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Unique Role Node with compact modern design
export const UniqueRoleNode = ({ data }: { data: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  
  const role: RBACRole = data.role;
  const isDangerous = role?.rules?.some(rule => 
    rule.verbs?.includes('*') || rule.resources?.includes('*') || 
    rule.verbs?.includes('delete')
  );
  const isReadOnly = role?.rules?.every(rule => 
    rule.verbs?.every(verb => ['get', 'list', 'watch'].includes(verb))
  );

  return (
    <div className="relative group">
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "!w-3 !h-3 !border-2 transition-all",
          isDangerous ? "!bg-orange-500 !border-orange-600" :
          isReadOnly ? "!bg-emerald-500 !border-emerald-600" :
          "!bg-green-500 !border-green-600"
        )}
      />
      
      <div className="relative bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 min-w-[320px] overflow-hidden">
        
        {/* Accent bar */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-0.5",
          "bg-gradient-to-r",
          isDangerous ? "from-orange-500 to-amber-500" :
          isReadOnly ? "from-emerald-500 to-green-500" :
          "from-green-500 to-teal-500"
        )} />
        
        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br",
                isDangerous ? "from-orange-100 to-amber-100 dark:from-orange-950 dark:to-amber-950" :
                isReadOnly ? "from-emerald-100 to-green-100 dark:from-emerald-950 dark:to-green-950" :
                "from-green-100 to-teal-100 dark:from-green-950 dark:to-teal-950"
              )}>
                {isDangerous ? <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" /> :
                 isReadOnly ? <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> :
                 <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />}
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-sm truncate">{data.label}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {data.namespace || 'default'}
                  </Badge>
                  {isDangerous && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      Elevated
                    </Badge>
                  )}
                  {isReadOnly && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Read-Only
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* YAML button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYaml(true);
                    }}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View YAML</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Key className="h-3 w-3" />
              <span>{role?.rules?.length || 0} rules</span>
            </div>
            <div className="flex items-center gap-1">
              <Link className="h-3 w-3" />
              <span>{data.bindings || 0} bindings</span>
            </div>
          </div>

          {/* Expandable Rules */}
          {role?.rules && role.rules.length > 0 && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full mt-3 h-7"
                >
                  <span className="text-xs">View Permissions</span>
                  {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 max-h-[150px] overflow-y-auto">
                  <RulePreview 
                    rules={role.rules} 
                    showExpanded={true}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="role"
            resourceName={role?.metadata?.name || data.label}
            namespace={data.namespace || 'default'}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Unique ServiceAccount Node with circular design
export const UniqueServiceAccountNode = ({ data }: { data: any }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-purple-600" 
      />
      
      <div className="relative">
        {/* Animated ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-20 blur-lg animate-pulse" />
        
        {/* Main container */}
        <div className="relative bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 p-4 min-w-[260px]">
          <div className="flex items-center gap-3">
            {/* Circular avatar */}
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-950">
                <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="font-medium text-sm truncate">{data.label}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Service Account
                </Badge>
              </div>
            </div>
            
            {/* YAML button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYaml(true);
                    }}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View YAML</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Metadata */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {data.namespace || 'default'}
            </span>
            {data.secrets && (
              <Badge variant="outline" className="text-xs">
                {data.secrets} secrets
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* YAML Window */}
      {showYaml && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="serviceaccount"
            resourceName={data.label}
            namespace={data.namespace || 'default'}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Unique Subject Node with pill design
export const UniqueSubjectNode = ({ data }: { data: any }) => {
  const isGroup = data.kind === 'Group';
  
  return (
    <div className="relative">
      <Handle 
        type="target" 
        position={Position.Left} 
        className={cn(
          "!w-3 !h-3 !border-2",
          isGroup ? "!bg-indigo-500 !border-indigo-600" : "!bg-orange-500 !border-orange-600"
        )}
      />
      
      <div className={cn(
        "relative bg-gradient-to-r rounded-full px-4 py-2 min-w-[200px]",
        "border shadow-sm hover:shadow-md transition-all duration-300",
        isGroup ? 
          "from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border-indigo-200 dark:border-indigo-800" : 
          "from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-orange-200 dark:border-orange-800"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center",
            isGroup ? "bg-indigo-500" : "bg-orange-500"
          )}>
            {isGroup ? (
              <Users className="h-4 w-4 text-white" />
            ) : (
              <User className="h-4 w-4 text-white" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{data.label}</div>
            <div className="text-xs text-muted-foreground">
              {data.kind}
              {data.namespace && ` • ${data.namespace}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Unique Binding Node with minimal design and YAML viewer
export const UniqueBindingNode = ({ data }: { data: any }) => {
  const [showYaml, setShowYaml] = useState(false);
  const isClusterBinding = data.type === 'ClusterRoleBinding';
  
  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-2 !h-2 !bg-gray-400"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-2 !h-2 !bg-gray-400"
      />
      
      <div className={cn(
        "bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm rounded-lg px-3 py-1.5 min-w-[140px]",
        "border shadow-sm relative",
        isClusterBinding ? "border-blue-200 dark:border-blue-900" : "border-green-200 dark:border-green-900"
      )}>
        <div className="flex items-center gap-2">
          <Link className={cn(
            "w-3 h-3",
            isClusterBinding ? "text-blue-500" : "text-green-500"
          )} />
          <div className="text-xs flex-1">
            <div className="font-medium truncate">{data.label}</div>
            <div className="text-muted-foreground text-[10px]">
              {data.type}
            </div>
          </div>
          
          {/* YAML button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowYaml(true);
                  }}
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
      {showYaml && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType={isClusterBinding ? "clusterrolebinding" : "rolebinding"}
            resourceName={data.label}
            namespace={isClusterBinding ? "" : (data.namespace || "")}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

// Unique Pod Node - matches PodNodeV2 design from deployment topology
export const UniquePodNode = ({ data }: { data: any }) => {
  const [showYaml, setShowYaml] = useState(false);
  const [expandedContainer, setExpandedContainer] = useState<number | null>(null);
  
  const resource = data.resource || {};
  const phase = resource.phase || data.status || 'Unknown';
  
  const toggleContainerInfo = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedContainer(expandedContainer === index ? null : index);
  };
  
  const getPhaseConfig = () => {
    switch (phase) {
      case 'Running':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-200 dark:border-green-800',
          gradient: 'from-green-500 to-emerald-600'
        };
      case 'Pending':
        return {
          icon: <Clock className="h-4 w-4" />,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
          gradient: 'from-amber-500 to-orange-600'
        };
      case 'Failed':
      case 'CrashLoopBackOff':
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-200 dark:border-red-800',
          gradient: 'from-red-500 to-rose-600'
        };
      case 'Terminating':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          gradient: 'from-gray-500 to-gray-600'
        };
      default:
        return {
          icon: <Circle className="h-4 w-4" />,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          gradient: 'from-blue-500 to-cyan-600'
        };
    }
  };

  const config = getPhaseConfig();
  const containers = resource.containers || [];
  const containerCount = containers.length;
  const readyContainers = containers.filter((c: any) => c.ready).length;
  
  return (
    <div className="relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-sky-600" 
      />
      
      {/* Status-based glow */}
      <div className={cn(
        "absolute -inset-1 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-30 blur-lg transition duration-500",
        config.gradient
      )} />
      
      <div className={cn(
        "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl border shadow-xl transition-all duration-300 hover:shadow-2xl",
        config.borderColor,
        expandedContainer !== null ? "min-w-[480px]" : "min-w-[440px]"
      )}>
        
        {/* Header */}
        <div className="p-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                <Box className={cn("h-4 w-4", config.color)} />
              </div>
              <div>
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pod
                </div>
                <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[200px]">
                  {data.label}
                </div>
              </div>
            </div>
            {/* Phase Badge - with margin to prevent overlap with YAML button */}
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mr-8",
              config.bgColor, config.color
            )}>
              {config.icon}
              {phase}
            </div>
          </div>
        </div>
        
        {/* Service Account Info */}
        {data.serviceAccount && (
          <div className="px-3 pt-2">
            <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
              <UserCheck className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-[10px] text-gray-600 dark:text-gray-400">Service Account:</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{data.serviceAccount}</span>
            </div>
          </div>
        )}
        
        {/* Containers Section */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="font-medium">Containers ({readyContainers}/{containerCount})</span>
            <div className="flex items-center gap-2">
              {resource.startTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {data.age || 'N/A'}
                  </span>
                </div>
              )}
              {containerCount > 0 && (
                readyContainers === containerCount ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )
              )}
            </div>
          </div>
          
          {/* Container List */}
          {containers.length > 0 ? (
            <div className="space-y-1.5">
              {containers.map((container: any, index: number) => (
                <div key={index} className="relative">
                  <div 
                    className={cn(
                      "flex items-center justify-between p-1.5 rounded-lg transition-all cursor-pointer",
                      "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800",
                      expandedContainer === index && "bg-gray-100 dark:bg-gray-800"
                    )}
                    onClick={(e) => toggleContainerInfo(index, e)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Container className="h-3 w-3 text-gray-400" />
                      <span className="text-xs font-medium truncate max-w-[140px]">{container.name}</span>
                      {container.ready ? (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500 text-green-600">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-500 text-amber-600">
                          Not Ready
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {container.restartCount > 0 && (
                        <div className="flex items-center gap-0.5">
                          <RefreshCw className="h-2.5 w-2.5 text-amber-500" />
                          <span className="text-[10px] text-amber-600 font-medium">{container.restartCount}</span>
                        </div>
                      )}
                      <Info className={cn(
                        "h-3 w-3 transition-transform",
                        expandedContainer === index ? "rotate-180 text-blue-500" : "text-gray-400"
                      )} />
                    </div>
                  </div>
                  
                  {/* Expanded Container Info */}
                  {expandedContainer === index && (
                    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] space-y-1">
                      {/* Image */}
                      <div className="flex items-start gap-1">
                        <span className="text-gray-500 dark:text-gray-400">Image:</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300 break-all flex-1">
                          {container.image || 'N/A'}
                        </span>
                      </div>
                      
                      {/* State */}
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-gray-500">State:</span>
                        <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">
                          {container.state || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-center text-muted-foreground py-2">
              No container information available
            </div>
          )}
        </div>
        
        {/* Node and IP info */}
        {(resource.nodeName || resource.podIP) && (
          <div className="px-3 pb-3 -mt-1">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
              {resource.nodeName && (
                <>
                  <span>Node:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">
                    {resource.nodeName}
                  </span>
                </>
              )}
              {resource.podIP && (
                <>
                  <span className="border-l border-gray-300 dark:border-gray-600 pl-2">Pod IP:</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {resource.podIP}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* YAML button - positioned in top-right corner, visible on hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowYaml(true);
                  }}
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
      {showYaml && data.context && (
        <TerminalPortal>
          <YamlWindow
            resourceType="pod"
            resourceName={data.label}
            namespace={data.namespace || 'default'}
            context={data.context}
            onClose={() => setShowYaml(false)}
          />
        </TerminalPortal>
      )}
    </div>
  );
};

export const uniqueNodeTypes = {
  clusterRole: UniqueClusterRoleNode,
  role: UniqueRoleNode,
  serviceAccount: UniqueServiceAccountNode,
  subject: UniqueSubjectNode,
  binding: UniqueBindingNode,
  pod: UniquePodNode,
};