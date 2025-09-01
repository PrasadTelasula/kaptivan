import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Eye, Plus, Trash2, Edit, Star, Shield } from 'lucide-react';
import type { PolicyRule } from '../types';

interface RulePreviewProps {
  rules: PolicyRule[];
  maxVisible?: number;
  showExpanded?: boolean;
}

const DANGEROUS_VERBS = ['*', 'delete', 'deletecollection', 'escalate', 'bind', 'impersonate'];
const WRITE_VERBS = ['create', 'update', 'patch'];
const READ_VERBS = ['get', 'list', 'watch'];

const getVerbInfo = (verb: string) => {
  if (DANGEROUS_VERBS.includes(verb)) {
    return { 
      color: 'destructive' as const, 
      icon: <AlertTriangle className="w-3 h-3" />, 
      priority: 3 
    };
  }
  if (WRITE_VERBS.includes(verb)) {
    return { 
      color: 'default' as const, 
      icon: <Edit className="w-3 h-3" />, 
      priority: 2 
    };
  }
  if (READ_VERBS.includes(verb)) {
    return { 
      color: 'secondary' as const, 
      icon: <Eye className="w-3 h-3" />, 
      priority: 1 
    };
  }
  return { 
    color: 'outline' as const, 
    icon: <Shield className="w-3 h-3" />, 
    priority: 1 
  };
};

const getResourceImportance = (resource: string): number => {
  const highImportance = ['*', 'secrets', 'clusterroles', 'clusterrolebindings', 'roles', 'rolebindings'];
  const mediumImportance = ['pods', 'services', 'deployments', 'configmaps', 'persistentvolumes'];
  
  if (highImportance.includes(resource)) return 3;
  if (mediumImportance.includes(resource)) return 2;
  return 1;
};

const scoreRule = (rule: PolicyRule): number => {
  let score = 0;
  
  // Score based on verbs
  const maxVerbPriority = Math.max(...rule.verbs.map(v => getVerbInfo(v).priority));
  score += maxVerbPriority * 10;
  
  // Score based on resources
  if (rule.resources) {
    const maxResourceImportance = Math.max(...rule.resources.map(getResourceImportance));
    score += maxResourceImportance * 5;
  }
  
  // Bonus for wildcard verbs or resources
  if (rule.verbs.includes('*')) score += 20;
  if (rule.resources?.includes('*')) score += 15;
  
  return score;
};

const RulePreview: React.FC<RulePreviewProps> = ({ 
  rules, 
  maxVisible = 3, 
  showExpanded = false 
}) => {
  // Sort rules by importance (most dangerous first)
  const sortedRules = [...rules].sort((a, b) => scoreRule(b) - scoreRule(a));
  const visibleRules = showExpanded ? sortedRules : sortedRules.slice(0, maxVisible);
  const hiddenCount = rules.length - visibleRules.length;

  if (rules.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No rules defined
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {visibleRules.map((rule, index) => (
          <RuleItem key={index} rule={rule} compact={!showExpanded} />
        ))}
        
        {hiddenCount > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Plus className="w-3 h-3" />
            +{hiddenCount} more rule{hiddenCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

interface RuleItemProps {
  rule: PolicyRule;
  compact: boolean;
}

const RuleItem: React.FC<RuleItemProps> = ({ rule, compact }) => {
  // Get most important verbs to show
  const sortedVerbs = [...rule.verbs].sort((a, b) => 
    getVerbInfo(b).priority - getVerbInfo(a).priority
  );
  
  const visibleVerbs = compact ? sortedVerbs.slice(0, 3) : sortedVerbs;
  const hiddenVerbsCount = rule.verbs.length - visibleVerbs.length;

  // Get most important resources
  const resources = rule.resources || ['(non-resource)'];
  const sortedResources = [...resources].sort((a, b) => 
    getResourceImportance(b) - getResourceImportance(a)
  );
  const visibleResources = compact ? sortedResources.slice(0, 2) : sortedResources;
  const hiddenResourcesCount = resources.length - visibleResources.length;

  const ruleTooltipContent = (
    <div className="space-y-2 max-w-xs">
      <div>
        <div className="font-semibold text-xs mb-1">Verbs:</div>
        <div className="flex flex-wrap gap-1">
          {rule.verbs.map((verb) => {
            const verbInfo = getVerbInfo(verb);
            return (
              <Badge key={verb} variant={verbInfo.color} className="text-xs">
                <span className="flex items-center gap-1">
                  {verbInfo.icon}
                  {verb}
                </span>
              </Badge>
            );
          })}
        </div>
      </div>
      
      {rule.resources && rule.resources.length > 0 && (
        <div>
          <div className="font-semibold text-xs mb-1">Resources:</div>
          <div className="text-xs text-muted-foreground">
            {rule.resources.join(', ')}
          </div>
        </div>
      )}
      
      {rule.apiGroups && rule.apiGroups.length > 0 && (
        <div>
          <div className="font-semibold text-xs mb-1">API Groups:</div>
          <div className="text-xs text-muted-foreground">
            {rule.apiGroups.map(g => g || 'core').join(', ')}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="border rounded p-2 text-xs space-y-1 hover:bg-accent/50 cursor-help">
          {/* Verbs */}
          <div className="flex flex-wrap gap-1 items-center">
            {visibleVerbs.map((verb) => {
              const verbInfo = getVerbInfo(verb);
              return (
                <Badge key={verb} variant={verbInfo.color} className="text-[10px] px-1 py-0">
                  <span className="flex items-center gap-0.5">
                    {verbInfo.icon}
                    {verb}
                  </span>
                </Badge>
              );
            })}
            {hiddenVerbsCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                +{hiddenVerbsCount}
              </span>
            )}
          </div>
          
          {/* Resources */}
          <div className="text-[10px] text-muted-foreground">
            on {visibleResources.join(', ')}
            {hiddenResourcesCount > 0 && ` (+${hiddenResourcesCount} more)`}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {ruleTooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};

export default RulePreview;