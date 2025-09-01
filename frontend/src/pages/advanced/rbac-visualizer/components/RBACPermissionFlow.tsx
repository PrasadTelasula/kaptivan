import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { 
  Shield, 
  User,
  Users,
  Bot,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Database,
  Server,
  Settings,
  FileText,
  Key,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Layers,
  GitBranch,
  Package
} from 'lucide-react';
import type { RBACResources, RBACRole, RBACRoleBinding } from '../types';

interface RBACPermissionFlowProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
}

interface PermissionFlow {
  subject: {
    name: string;
    kind: 'User' | 'Group' | 'ServiceAccount';
    namespace?: string;
  };
  bindings: {
    name: string;
    namespace?: string;
    type: 'RoleBinding' | 'ClusterRoleBinding';
  }[];
  roles: {
    name: string;
    namespace?: string;
    type: 'Role' | 'ClusterRole';
    rules: any[];
  }[];
  aggregatedPermissions: {
    resource: string;
    verbs: string[];
    namespaces: string[];
  }[];
}

interface ResourcePermission {
  resource: string;
  apiGroup: string;
  namespaces: string[];
  subjects: {
    name: string;
    kind: string;
    verbs: string[];
    via: string; // role name
  }[];
}

export default function RBACPermissionFlow({ resources, onNodeClick }: RBACPermissionFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'subject-to-resource' | 'resource-to-subject'>('subject-to-resource');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Build permission flows from subjects to resources
  const subjectFlows = useMemo((): PermissionFlow[] => {
    if (!resources) return [];

    const flows: PermissionFlow[] = [];
    const processedSubjects = new Set<string>();

    // Process all bindings to build flows
    [...resources.clusterRoleBindings, ...resources.roleBindings].forEach(binding => {
      binding.subjects?.forEach(subject => {
        const subjectKey = `${subject.kind}:${subject.name}:${subject.namespace || 'cluster'}`;
        
        if (!processedSubjects.has(subjectKey)) {
          processedSubjects.add(subjectKey);
          
          // Find all bindings for this subject
          const subjectBindings = [
            ...resources.clusterRoleBindings.filter(b => 
              b.subjects?.some(s => s.kind === subject.kind && s.name === subject.name)
            ),
            ...resources.roleBindings.filter(b => 
              b.subjects?.some(s => s.kind === subject.kind && s.name === subject.name)
            )
          ];

          // Get all roles through bindings
          const subjectRoles: any[] = [];
          const aggregatedPerms = new Map<string, { verbs: Set<string>, namespaces: Set<string> }>();

          subjectBindings.forEach(binding => {
            // Find the role
            let role;
            if (binding.roleRef.kind === 'ClusterRole') {
              role = resources.clusterRoles.find(r => r.metadata.name === binding.roleRef.name);
            } else {
              role = resources.roles.find(r => 
                r.metadata.name === binding.roleRef.name && 
                r.metadata.namespace === binding.metadata.namespace
              );
            }

            if (role) {
              subjectRoles.push({
                name: role.metadata.name,
                namespace: role.metadata.namespace,
                type: binding.roleRef.kind,
                rules: role.rules
              });

              // Aggregate permissions
              role.rules.forEach(rule => {
                rule.resources?.forEach(resource => {
                  const key = `${rule.apiGroups?.join(',') || 'core'}:${resource}`;
                  if (!aggregatedPerms.has(key)) {
                    aggregatedPerms.set(key, { verbs: new Set(), namespaces: new Set() });
                  }
                  const perm = aggregatedPerms.get(key)!;
                  rule.verbs.forEach(verb => perm.verbs.add(verb));
                  if (binding.metadata.namespace) {
                    perm.namespaces.add(binding.metadata.namespace);
                  } else {
                    perm.namespaces.add('*');
                  }
                });
              });
            }
          });

          flows.push({
            subject: {
              name: subject.name,
              kind: subject.kind as any,
              namespace: subject.namespace
            },
            bindings: subjectBindings.map(b => ({
              name: b.metadata.name,
              namespace: b.metadata.namespace,
              type: b.metadata.namespace ? 'RoleBinding' : 'ClusterRoleBinding'
            })),
            roles: subjectRoles,
            aggregatedPermissions: Array.from(aggregatedPerms.entries()).map(([key, value]) => ({
              resource: key.split(':')[1],
              verbs: Array.from(value.verbs),
              namespaces: Array.from(value.namespaces)
            }))
          });
        }
      });
    });

    return flows;
  }, [resources]);

  // Build resource-centric view
  const resourcePermissions = useMemo((): ResourcePermission[] => {
    if (!resources) return [];

    const resourceMap = new Map<string, ResourcePermission>();

    // Process all roles to find what resources they grant access to
    [...resources.clusterRoles, ...resources.roles].forEach(role => {
      role.rules.forEach(rule => {
        rule.resources?.forEach(resource => {
          const apiGroup = rule.apiGroups?.join(',') || 'core';
          const key = `${apiGroup}:${resource}`;
          
          if (!resourceMap.has(key)) {
            resourceMap.set(key, {
              resource,
              apiGroup,
              namespaces: [],
              subjects: []
            });
          }

          const resourcePerm = resourceMap.get(key)!;

          // Find all subjects that have this role
          const roleBindings = role.metadata.namespace
            ? resources.roleBindings.filter(b => b.roleRef.name === role.metadata.name)
            : resources.clusterRoleBindings.filter(b => b.roleRef.name === role.metadata.name);

          roleBindings.forEach(binding => {
            binding.subjects?.forEach(subject => {
              const existingSubject = resourcePerm.subjects.find(s => 
                s.name === subject.name && s.kind === subject.kind
              );

              if (existingSubject) {
                rule.verbs.forEach(verb => {
                  if (!existingSubject.verbs.includes(verb)) {
                    existingSubject.verbs.push(verb);
                  }
                });
              } else {
                resourcePerm.subjects.push({
                  name: subject.name,
                  kind: subject.kind,
                  verbs: [...rule.verbs],
                  via: role.metadata.name
                });
              }

              if (binding.metadata.namespace && !resourcePerm.namespaces.includes(binding.metadata.namespace)) {
                resourcePerm.namespaces.push(binding.metadata.namespace);
              }
            });
          });
        });
      });
    });

    return Array.from(resourceMap.values()).sort((a, b) => 
      b.subjects.length - a.subjects.length
    );
  }, [resources]);

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSections(newExpanded);
  };

  const getResourceIcon = (resource: string) => {
    if (resource.includes('pod')) return <Package className="w-4 h-4" />;
    if (resource.includes('service')) return <Server className="w-4 h-4" />;
    if (resource.includes('deployment')) return <Layers className="w-4 h-4" />;
    if (resource.includes('secret') || resource.includes('configmap')) return <Key className="w-4 h-4" />;
    if (resource.includes('namespace')) return <GitBranch className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  const getSubjectIcon = (kind: string) => {
    switch (kind) {
      case 'ServiceAccount': return <Bot className="w-4 h-4 text-purple-500" />;
      case 'Group': return <Users className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-green-500" />;
    }
  };

  const getVerbBadgeColor = (verb: string) => {
    if (verb === '*' || verb === 'delete' || verb === 'deletecollection') return 'destructive';
    if (verb === 'create' || verb === 'update' || verb === 'patch') return 'default';
    return 'secondary';
  };

  const filteredSubjectFlows = subjectFlows.filter(flow =>
    flow.subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flow.aggregatedPermissions.some(p => p.resource.includes(searchQuery.toLowerCase()))
  );

  const filteredResourcePerms = resourcePermissions.filter(rp =>
    rp.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rp.subjects.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No RBAC data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Controls */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects, resources, or permissions..."
            className="pl-10"
          />
        </div>
        <SegmentedControl
          value={viewMode}
          onValueChange={(v) => setViewMode(v as any)}
          options={[
            { value: 'subject-to-resource', label: 'Subject → Resource', icon: <ArrowRight className="w-4 h-4" /> },
            { value: 'resource-to-subject', label: 'Resource → Subject', icon: <ArrowRight className="w-4 h-4 rotate-180" /> }
          ]}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {viewMode === 'subject-to-resource' ? (
          <div className="space-y-4">
            {filteredSubjectFlows.map((flow, idx) => {
              const key = `${flow.subject.kind}-${flow.subject.name}`;
              const isExpanded = expandedSections.has(key);
              
              return (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleSection(key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {getSubjectIcon(flow.subject.kind)}
                        <div>
                          <p className="font-semibold">{flow.subject.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{flow.subject.kind}</span>
                            {flow.subject.namespace && (
                              <>
                                <span>•</span>
                                <span>Namespace: {flow.subject.namespace}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{flow.bindings.length} bindings</Badge>
                        <Badge variant="secondary">{flow.roles.length} roles</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Permission Flow Diagram */}
                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            {getSubjectIcon(flow.subject.kind)}
                            <span className="text-sm font-medium">{flow.subject.name}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1">
                            {flow.bindings.slice(0, 3).map((binding, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {binding.name}
                              </Badge>
                            ))}
                            {flow.bindings.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{flow.bindings.length - 3}
                              </Badge>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1">
                            {flow.roles.slice(0, 3).map((role, i) => (
                              <Badge key={i} className="text-xs">
                                {role.name}
                              </Badge>
                            ))}
                            {flow.roles.length > 3 && (
                              <Badge className="text-xs">
                                +{flow.roles.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Aggregated Permissions */}
                        <div>
                          <p className="text-sm font-medium mb-2">Aggregated Permissions</p>
                          <div className="space-y-2">
                            {flow.aggregatedPermissions.slice(0, 10).map((perm, i) => (
                              <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  {getResourceIcon(perm.resource)}
                                  <span className="text-sm font-medium">{perm.resource}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-wrap gap-1">
                                    {perm.verbs.map((verb, vi) => (
                                      <Badge key={vi} variant={getVerbBadgeColor(verb)} className="text-xs">
                                        {verb}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span>in</span>
                                    {perm.namespaces.includes('*') ? (
                                      <Badge variant="outline" className="text-xs">all namespaces</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        {perm.namespaces.length} namespace{perm.namespaces.length > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {flow.aggregatedPermissions.length > 10 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{flow.aggregatedPermissions.length - 10} more permissions
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResourcePerms.map((rp, idx) => {
              const key = `resource-${rp.apiGroup}-${rp.resource}`;
              const isExpanded = expandedSections.has(key);
              
              return (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleSection(key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {getResourceIcon(rp.resource)}
                        <div>
                          <p className="font-semibold">{rp.resource}</p>
                          <p className="text-xs text-muted-foreground">API Group: {rp.apiGroup}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rp.subjects.length} subjects</Badge>
                        {rp.namespaces.length > 0 && (
                          <Badge variant="secondary">{rp.namespaces.length} namespaces</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <p className="text-sm font-medium">Who has access:</p>
                        <div className="space-y-2">
                          {rp.subjects.map((subject, i) => (
                            <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                              <div className="flex items-center gap-2">
                                {getSubjectIcon(subject.kind)}
                                <div>
                                  <p className="text-sm font-medium">{subject.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {subject.kind} via {subject.via}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {subject.verbs.map((verb, vi) => (
                                  <Badge key={vi} variant={getVerbBadgeColor(verb)} className="text-xs">
                                    {verb}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}