import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  ShieldCheck,
  User,
  Users,
  Bot,
  ArrowRight,
  Search,
  Filter,
  Key,
  Lock,
  Unlock,
  Package,
  Globe,
  ChevronRight,
  ChevronDown,
  Layers,
  Link2
} from 'lucide-react';
import type { RBACResources, RBACRole, RBACRoleBinding } from '../types';

interface SimpleRBACGraphProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
  filters?: any;
}

interface GroupedData {
  subjects: {
    users: Set<string>;
    groups: Set<string>;
    serviceAccounts: Array<{ name: string; namespace: string }>;
  };
  roles: {
    clusterRoles: Array<{ name: string; rules: number }>;
    namespaceRoles: Map<string, Array<{ name: string; rules: number }>>;
  };
  connections: Array<{
    subject: string;
    subjectType: 'User' | 'Group' | 'ServiceAccount';
    role: string;
    roleType: 'ClusterRole' | 'Role';
    binding: string;
    namespace?: string;
  }>;
}

export default function SimpleRBACGraph({ resources, onNodeClick, filters }: SimpleRBACGraphProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState<'all' | 'users' | 'groups' | 'serviceaccounts'>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  // Process and group the RBAC data
  const groupedData = useMemo((): GroupedData | null => {
    if (!resources) return null;

    const data: GroupedData = {
      subjects: {
        users: new Set(),
        groups: new Set(),
        serviceAccounts: []
      },
      roles: {
        clusterRoles: [],
        namespaceRoles: new Map()
      },
      connections: []
    };

    // Process ClusterRoles
    resources.clusterRoles.forEach(role => {
      if (!filters?.showSystemRoles && role.metadata.name.startsWith('system:')) return;
      data.roles.clusterRoles.push({
        name: role.metadata.name,
        rules: role.rules.length
      });
    });

    // Process Namespace Roles
    resources.roles.forEach(role => {
      const ns = role.metadata.namespace || 'default';
      if (!data.roles.namespaceRoles.has(ns)) {
        data.roles.namespaceRoles.set(ns, []);
      }
      data.roles.namespaceRoles.get(ns)!.push({
        name: role.metadata.name,
        rules: role.rules.length
      });
    });

    // Process Bindings and collect subjects
    [...resources.clusterRoleBindings, ...resources.roleBindings].forEach(binding => {
      const isClusterBinding = !binding.metadata.namespace;
      
      binding.subjects?.forEach(subject => {
        // Collect subjects
        if (subject.kind === 'User') {
          data.subjects.users.add(subject.name);
        } else if (subject.kind === 'Group') {
          data.subjects.groups.add(subject.name);
        } else if (subject.kind === 'ServiceAccount') {
          data.subjects.serviceAccounts.push({
            name: subject.name,
            namespace: subject.namespace || 'default'
          });
        }

        // Create connection
        data.connections.push({
          subject: subject.name,
          subjectType: subject.kind as 'User' | 'Group' | 'ServiceAccount',
          role: binding.roleRef.name,
          roleType: binding.roleRef.kind as 'ClusterRole' | 'Role',
          binding: binding.metadata.name,
          namespace: binding.metadata.namespace
        });
      });
    });

    return data;
  }, [resources, filters]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getSubjectIcon = (type: string) => {
    switch (type) {
      case 'User':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'Group':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'ServiceAccount':
        return <Bot className="w-4 h-4 text-purple-500" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleIcon = (type: string) => {
    return type === 'ClusterRole' 
      ? <Globe className="w-4 h-4 text-orange-500" />
      : <Package className="w-4 h-4 text-indigo-500" />;
  };

  if (!groupedData) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-lg text-muted-foreground">No RBAC data available</p>
        </CardContent>
      </Card>
    );
  }

  // Filter connections based on search and subject type
  const filteredConnections = groupedData.connections.filter(conn => {
    const matchesSearch = !searchQuery || 
      conn.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedSubjectType === 'all' ||
      (selectedSubjectType === 'users' && conn.subjectType === 'User') ||
      (selectedSubjectType === 'groups' && conn.subjectType === 'Group') ||
      (selectedSubjectType === 'serviceaccounts' && conn.subjectType === 'ServiceAccount');
    
    return matchesSearch && matchesType;
  });

  // Group connections by subject for display
  const connectionsBySubject = filteredConnections.reduce((acc, conn) => {
    const key = `${conn.subjectType}:${conn.subject}`;
    if (!acc[key]) {
      acc[key] = {
        subject: conn.subject,
        subjectType: conn.subjectType,
        roles: []
      };
    }
    acc[key].roles.push({
      name: conn.role,
      type: conn.roleType,
      binding: conn.binding,
      namespace: conn.namespace
    });
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <Card className="flex-shrink-0 mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">RBAC Permissions Graph</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search subjects or roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-[250px]"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={selectedSubjectType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubjectType('all')}
                >
                  All
                </Button>
                <Button
                  variant={selectedSubjectType === 'users' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubjectType('users')}
                >
                  <User className="w-3 h-3 mr-1" />
                  Users
                </Button>
                <Button
                  variant={selectedSubjectType === 'groups' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubjectType('groups')}
                >
                  <Users className="w-3 h-3 mr-1" />
                  Groups
                </Button>
                <Button
                  variant={selectedSubjectType === 'serviceaccounts' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubjectType('serviceaccounts')}
                >
                  <Bot className="w-3 h-3 mr-1" />
                  Service Accounts
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview Section */}
      <Card className="flex-shrink-0 mb-4">
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleSection('overview')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {expandedSections.has('overview') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Layers className="w-4 h-4" />
              <h3 className="font-semibold">RBAC Overview</h3>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                <User className="w-3 h-3 mr-1" />
                {groupedData.subjects.users.size} Users
              </Badge>
              <Badge variant="outline">
                <Users className="w-3 h-3 mr-1" />
                {groupedData.subjects.groups.size} Groups
              </Badge>
              <Badge variant="outline">
                <Bot className="w-3 h-3 mr-1" />
                {groupedData.subjects.serviceAccounts.length} Service Accounts
              </Badge>
              <Badge variant="secondary">
                <Shield className="w-3 h-3 mr-1" />
                {groupedData.roles.clusterRoles.length + Array.from(groupedData.roles.namespaceRoles.values()).flat().length} Roles
              </Badge>
            </div>
          </div>
        </CardHeader>
        {expandedSections.has('overview') && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4">
              {/* Subjects Column */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Subjects</h4>
                <div className="space-y-2">
                  {groupedData.subjects.users.size > 0 && (
                    <div className="p-2 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Users ({groupedData.subjects.users.size})</span>
                      </div>
                      <div className="pl-6 space-y-1">
                        {Array.from(groupedData.subjects.users).slice(0, 3).map(user => (
                          <div key={user} className="text-xs text-muted-foreground">{user}</div>
                        ))}
                        {groupedData.subjects.users.size > 3 && (
                          <div className="text-xs text-muted-foreground">+{groupedData.subjects.users.size - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}
                  {groupedData.subjects.groups.size > 0 && (
                    <div className="p-2 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Groups ({groupedData.subjects.groups.size})</span>
                      </div>
                      <div className="pl-6 space-y-1">
                        {Array.from(groupedData.subjects.groups).slice(0, 3).map(group => (
                          <div key={group} className="text-xs text-muted-foreground">{group}</div>
                        ))}
                        {groupedData.subjects.groups.size > 3 && (
                          <div className="text-xs text-muted-foreground">+{groupedData.subjects.groups.size - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}
                  {groupedData.subjects.serviceAccounts.length > 0 && (
                    <div className="p-2 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Service Accounts ({groupedData.subjects.serviceAccounts.length})</span>
                      </div>
                      <div className="pl-6 space-y-1">
                        {groupedData.subjects.serviceAccounts.slice(0, 3).map(sa => (
                          <div key={`${sa.namespace}:${sa.name}`} className="text-xs text-muted-foreground">
                            {sa.name} <span className="text-muted-foreground/70">({sa.namespace})</span>
                          </div>
                        ))}
                        {groupedData.subjects.serviceAccounts.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{groupedData.subjects.serviceAccounts.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Link2 className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Bindings</span>
                </div>
              </div>

              {/* Roles Column */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Roles & Permissions</h4>
                <div className="space-y-2">
                  {groupedData.roles.clusterRoles.length > 0 && (
                    <div className="p-2 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">Cluster Roles ({groupedData.roles.clusterRoles.length})</span>
                      </div>
                      <div className="pl-6 space-y-1">
                        {groupedData.roles.clusterRoles.slice(0, 3).map(role => (
                          <div key={role.name} className="text-xs text-muted-foreground">
                            {role.name} <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{role.rules} rules</Badge>
                          </div>
                        ))}
                        {groupedData.roles.clusterRoles.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{groupedData.roles.clusterRoles.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}
                  {groupedData.roles.namespaceRoles.size > 0 && (
                    <div className="p-2 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium">Namespace Roles</span>
                      </div>
                      <div className="pl-6 space-y-1">
                        {Array.from(groupedData.roles.namespaceRoles.entries()).slice(0, 3).map(([ns, roles]) => (
                          <div key={ns} className="text-xs text-muted-foreground">
                            <span className="font-medium">{ns}:</span> {roles.length} roles
                          </div>
                        ))}
                        {groupedData.roles.namespaceRoles.size > 3 && (
                          <div className="text-xs text-muted-foreground">+{groupedData.roles.namespaceRoles.size - 3} more namespaces</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Permissions Flow */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 pb-4">
          {Object.values(connectionsBySubject).map((conn: any) => (
            <Card key={`${conn.subjectType}:${conn.subject}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Subject */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    {getSubjectIcon(conn.subjectType)}
                    <div>
                      <div className="font-medium text-sm">{conn.subject}</div>
                      <div className="text-xs text-muted-foreground">{conn.subjectType}</div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Roles */}
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2">
                      {conn.roles.map((role: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 p-2 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => onNodeClick?.({
                            type: role.type.toLowerCase(),
                            label: role.name,
                            data: { namespace: role.namespace }
                          })}
                        >
                          {getRoleIcon(role.type)}
                          <div>
                            <div className="text-sm font-medium">{role.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {role.type} {role.namespace && `• ${role.namespace}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {Object.keys(connectionsBySubject).length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No connections found matching your filters</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}