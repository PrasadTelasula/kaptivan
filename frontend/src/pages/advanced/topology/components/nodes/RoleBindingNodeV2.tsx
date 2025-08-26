import React, { useState } from 'react';
import { Link2, Users, UserCheck, Crown , FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YamlWindow } from '../windows/YamlWindow';
import { TerminalPortal } from '../windows/TerminalPortal';
import { cn } from '@/lib/utils';
import MultiHandleWrapper from './MultiHandleWrapper';

interface RoleBindingNodeProps {
  data: {
    label: string;
    resource: any;
    namespace?: string;
    context?: string;
    isClusterRoleBinding?: boolean;
  };
}

const RoleBindingNodeV2: React.FC<RoleBindingNodeProps> = ({ data }) => {
  const [showYaml, setShowYaml] = useState(false);
  
  const handleOpenYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowYaml(true);
  };
  
  const { resource, isClusterRoleBinding } = data;
  const subjectCount = resource.subjects?.length || 0;
  
  const getSubjectIcon = (kind: string) => {
    switch (kind) {
      case 'User':
        return '👤';
      case 'Group':
        return '👥';
      case 'ServiceAccount':
        return '🔧';
      default:
        return '📦';
    }
  };
  
  return (
    <MultiHandleWrapper>
    <div className="relative group">
      {/* Animated pulse effect */}
      <div className={cn(
        "absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-40 animate-pulse transition duration-500",
        isClusterRoleBinding 
          ? "bg-gradient-to-r from-pink-500 to-rose-600" 
          : "bg-gradient-to-r from-blue-500 to-indigo-600"
      )} />
      
      <div className={cn(
        "relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl p-3 min-w-[320px] transition-all duration-300",
        isClusterRoleBinding 
          ? "border border-pink-200/50 dark:border-pink-800/50" 
          : "border border-blue-200/50 dark:border-blue-800/50"
      )}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg shadow-md",
              isClusterRoleBinding 
                ? "bg-gradient-to-br from-pink-500 to-rose-600" 
                : "bg-gradient-to-br from-blue-500 to-indigo-600"
            )}>
              <Link2 className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isClusterRoleBinding ? 'ClusterRoleBinding' : 'RoleBinding'}
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[160px]">
                {data.label}
              </div>
            </div>
          </div>
        </div>
        
        {/* Role Reference */}
        {resource.roleRef && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2 text-xs",
            isClusterRoleBinding 
              ? "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300" 
              : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
          )}>
            {resource.roleRef.kind === 'ClusterRole' ? (
              <Crown className="h-3 w-3" />
            ) : (
              <UserCheck className="h-3 w-3" />
            )}
            <span className="font-medium truncate max-w-[150px]">
              {resource.roleRef.name}
            </span>
          </div>
        )}
        
        {/* Subjects */}
        {subjectCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span className="uppercase tracking-wider">Subjects</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full font-medium",
                isClusterRoleBinding 
                  ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" 
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              )}>
                {subjectCount}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {resource.subjects?.slice(0, 3).map((subject: any, idx: number) => (
                <div 
                  key={idx}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]"
                  title={subject.name}
                >
                  <span>{getSubjectIcon(subject.kind)}</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[60px]">
                    {subject.name}
                  </span>
                </div>
              ))}
              {subjectCount > 3 && (
                <span className="px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  +{subjectCount - 3}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* YAML button - positioned in top-right corner, visible on hover */}
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
    </div>
    
    {/* YAML Window */}
    {showYaml && data.context && (
      <TerminalPortal>
        <YamlWindow
          resourceType={isClusterRoleBinding ? "clusterrolebinding" : "rolebinding"}
          resourceName={data.resource?.name || data.label}
          namespace={!isClusterRoleBinding ? data.namespace : undefined}
          context={data.context}
          onClose={() => setShowYaml(false)}
        />
      </TerminalPortal>
    )}
    </MultiHandleWrapper>
  );
};

export default RoleBindingNodeV2;