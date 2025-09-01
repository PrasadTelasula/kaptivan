import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  ShieldCheck, 
  Key, 
  User, 
  Users, 
  Bot, 
  ChevronDown,
  ChevronRight,
  Search,
  Lock,
  Unlock,
  Eye,
  Edit,
  Trash,
  Settings,
  Database,
  Network,
  Server
} from 'lucide-react';
import type { RBACResources, RBACRole, RBACRoleBinding } from '../types';

interface RBACCardViewProps {
  resources: RBACResources | null;
  onRoleClick?: (role: RBACRole) => void;
  onBindingClick?: (binding: RBACRoleBinding) => void;
}

export default function RBACCardView({ resources, onRoleClick, onBindingClick }: RBACCardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'clusterRoles' | 'roles' | 'serviceAccounts'>('all');

  // Helper function to get icon for role type
  const getRoleIcon = (isClusterRole: boolean) => {
    return isClusterRole ? (
      <ShieldCheck className="w-5 h-5 text-blue-500" />
    ) : (
      <Shield className="w-5 h-5 text-green-500" />
    );
  };

  // Helper function to get subject icon
  const getSubjectIcon = (kind: string) => {
    switch (kind) {
      case 'User':
        return <User className="w-4 h-4" />;
      case 'Group':
        return <Users className="w-4 h-4" />;
      case 'ServiceAccount':
        return <Bot className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  // Helper to get verb badge color
  const getVerbBadgeVariant = (verb: string): "default" | "secondary" | "destructive" | "outline" => {
    if (['get', 'list', 'watch'].includes(verb)) return 'secondary';
    if (['create', 'update', 'patch'].includes(verb)) return 'default';
    if (verb === 'delete' || verb === 'deletecollection') return 'destructive';
    return 'outline';
  };

  // Helper to get resource icon
  const getResourceIcon = (resource: string) => {
    if (resource.includes('pod')) return <Server className="w-3 h-3" />;
    if (resource.includes('service')) return <Network className="w-3 h-3" />;
    if (resource.includes('deployment')) return <Database className="w-3 h-3" />;
    if (resource.includes('secret')) return <Lock className="w-3 h-3" />;
    if (resource.includes('configmap')) return <Settings className="w-3 h-3" />;
    return <Key className="w-3 h-3" />;
  };

  // Toggle card expansion
  const toggleCard = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  // Filter roles based on search
  const filteredRoles = useMemo(() => {
    if (!resources) return { clusterRoles: [], roles: [] };
    
    const query = searchQuery.toLowerCase();
    
    return {
      clusterRoles: resources.clusterRoles.filter(role => 
        role.metadata.name.toLowerCase().includes(query)
      ),
      roles: resources.roles.filter(role => 
        role.metadata.name.toLowerCase().includes(query)
      )
    };
  }, [resources, searchQuery]);

  // Get bindings for a role
  const getBindingsForRole = (roleName: string, isClusterRole: boolean) => {
    if (!resources) return [];
    
    const bindings = [];
    
    if (isClusterRole) {
      // Check ClusterRoleBindings
      resources.clusterRoleBindings.forEach(binding => {
        if (binding.roleRef.name === roleName && binding.roleRef.kind === 'ClusterRole') {
          bindings.push(binding);
        }
      });
    }
    
    // Check RoleBindings
    resources.roleBindings.forEach(binding => {
      if (binding.roleRef.name === roleName) {
        bindings.push(binding);
      }
    });
    
    return bindings;
  };

  // Render role card
  const renderRoleCard = (role: RBACRole, isClusterRole: boolean) => {
    const cardId = `${isClusterRole ? 'cr' : 'r'}-${role.metadata.uid}`;
    const isExpanded = expandedCards.has(cardId);
    const bindings = getBindingsForRole(role.metadata.name, isClusterRole);
    
    return (
      <Card 
        key={cardId} 
        className="hover:shadow-lg transition-all duration-200 border-l-4"
        style={{
          borderLeftColor: isClusterRole ? '#3b82f6' : '#10b981'
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getRoleIcon(isClusterRole)}
              <div>
                <CardTitle className="text-lg font-semibold">
                  {role.metadata.name}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {isClusterRole ? 'Cluster-wide' : role.metadata.namespace}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {role.rules.length} rules
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {bindings.length} bindings
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Subjects bound to this role */}
          {bindings.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2 text-muted-foreground">Bound Subjects</p>
              <div className="flex flex-wrap gap-2">
                {bindings.slice(0, 5).map((binding, idx) => (
                  binding.subjects?.map((subject, sidx) => (
                    <div
                      key={`${idx}-${sidx}`}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-full"
                    >
                      {getSubjectIcon(subject.kind)}
                      <span className="text-xs font-medium">{subject.name}</span>
                    </div>
                  ))
                ))}
                {bindings.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{bindings.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Expandable permissions section */}
          <Collapsible open={isExpanded} onOpenChange={() => toggleCard(cardId)}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors cursor-pointer">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              View Permissions
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2 max-h-64 overflow-auto">
                {role.rules.map((rule, idx) => (
                  <div key={idx} className="p-3 bg-secondary/50 rounded-lg space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs font-medium text-muted-foreground">Verbs:</span>
                      {rule.verbs.map((verb) => (
                        <Badge key={verb} variant={getVerbBadgeVariant(verb)} className="text-xs">
                          {verb}
                        </Badge>
                      ))}
                    </div>
                    {rule.resources && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs font-medium text-muted-foreground">Resources:</span>
                        {rule.resources.map((resource) => (
                          <div key={resource} className="flex items-center gap-1 px-2 py-0.5 bg-background rounded">
                            {getResourceIcon(resource)}
                            <span className="text-xs">{resource}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rule.apiGroups && rule.apiGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs font-medium text-muted-foreground">API Groups:</span>
                        {rule.apiGroups.map((group) => (
                          <Badge key={group} variant="outline" className="text-xs">
                            {group || 'core'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  if (!resources) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8">
          <CardContent className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No RBAC Resources Found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Select a cluster to view RBAC configuration
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search roles, bindings, subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clusterRoles">
              <ShieldCheck className="w-4 h-4 mr-1" />
              ClusterRoles
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="w-4 h-4 mr-1" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="serviceAccounts">
              <Bot className="w-4 h-4 mr-1" />
              ServiceAccounts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Resource Cards Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* ClusterRoles */}
          {(selectedCategory === 'all' || selectedCategory === 'clusterRoles') && 
            filteredRoles.clusterRoles.map(role => renderRoleCard(role, true))
          }
          
          {/* Roles */}
          {(selectedCategory === 'all' || selectedCategory === 'roles') && 
            filteredRoles.roles.map(role => renderRoleCard(role, false))
          }
          
          {/* ServiceAccounts */}
          {selectedCategory === 'serviceAccounts' && resources.serviceAccounts.map(sa => (
            <Card key={sa.metadata.uid} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-purple-500" />
                  <div>
                    <CardTitle className="text-lg">{sa.metadata.name}</CardTitle>
                    <CardDescription>{sa.metadata.namespace}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}