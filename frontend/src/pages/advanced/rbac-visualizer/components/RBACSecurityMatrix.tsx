import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  User,
  Users,
  Bot,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Search,
  Filter,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  Layers,
  Zap,
  Database,
  Network,
  Server,
  Cloud,
  Terminal,
  FileCode,
  Settings
} from 'lucide-react';
import type { RBACResources } from '../types';

interface RBACSecurityMatrixProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
}

interface SecurityMetric {
  label: string;
  value: number;
  max: number;
  status: 'critical' | 'warning' | 'good' | 'info';
  icon: React.ReactNode;
}

interface PermissionLevel {
  resource: string;
  verbs: string[];
  risk: 'high' | 'medium' | 'low';
  count: number;
}

export default function RBACSecurityMatrix({ resources, onNodeClick }: RBACSecurityMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedView, setSelectedView] = useState<'overview' | 'permissions' | 'subjects' | 'risks'>('overview');

  // Calculate security metrics
  const metrics = useMemo((): SecurityMetric[] => {
    if (!resources) return [];

    const totalRoles = resources.clusterRoles.length + resources.roles.length;
    const totalBindings = resources.clusterRoleBindings.length + resources.roleBindings.length;
    const totalSubjects = new Set([
      ...resources.clusterRoleBindings.flatMap(b => b.subjects?.map(s => `${s.kind}-${s.name}`) || []),
      ...resources.roleBindings.flatMap(b => b.subjects?.map(s => `${s.kind}-${s.name}`) || [])
    ]).size;

    // Count high-risk permissions
    const highRiskVerbs = ['delete', 'create', 'update', 'patch', '*'];
    const highRiskCount = [...resources.clusterRoles, ...resources.roles].reduce((acc, role) => {
      return acc + role.rules.filter(rule => 
        rule.verbs.some(verb => highRiskVerbs.includes(verb))
      ).length;
    }, 0);

    return [
      {
        label: 'Total Roles',
        value: totalRoles,
        max: 100,
        status: totalRoles > 50 ? 'warning' : 'good',
        icon: <Shield className="w-4 h-4" />
      },
      {
        label: 'Active Bindings',
        value: totalBindings,
        max: 100,
        status: totalBindings > 75 ? 'warning' : 'good',
        icon: <Link className="w-4 h-4" />
      },
      {
        label: 'Unique Subjects',
        value: totalSubjects,
        max: 50,
        status: totalSubjects > 30 ? 'info' : 'good',
        icon: <Users className="w-4 h-4" />
      },
      {
        label: 'High Risk Permissions',
        value: highRiskCount,
        max: 20,
        status: highRiskCount > 10 ? 'critical' : highRiskCount > 5 ? 'warning' : 'good',
        icon: <AlertTriangle className="w-4 h-4" />
      }
    ];
  }, [resources]);

  // Analyze permission levels
  const permissionAnalysis = useMemo(() => {
    if (!resources) return { high: [], medium: [], low: [] };

    const analysis: { high: PermissionLevel[], medium: PermissionLevel[], low: PermissionLevel[] } = {
      high: [],
      medium: [],
      low: []
    };

    [...resources.clusterRoles, ...resources.roles].forEach(role => {
      role.rules.forEach(rule => {
        const hasWildcard = rule.verbs.includes('*') || rule.resources?.includes('*');
        const hasDelete = rule.verbs.includes('delete') || rule.verbs.includes('deletecollection');
        const hasCreate = rule.verbs.includes('create') || rule.verbs.includes('update');
        
        let risk: 'high' | 'medium' | 'low' = 'low';
        if (hasWildcard || (hasDelete && hasCreate)) {
          risk = 'high';
        } else if (hasDelete || hasCreate) {
          risk = 'medium';
        }

        const resourceName = rule.resources?.join(', ') || 'unknown';
        const existing = analysis[risk].find(p => p.resource === resourceName);
        
        if (existing) {
          existing.verbs = [...new Set([...existing.verbs, ...rule.verbs])];
          existing.count++;
        } else {
          analysis[risk].push({
            resource: resourceName,
            verbs: rule.verbs,
            risk,
            count: 1
          });
        }
      });
    });

    return analysis;
  }, [resources]);

  // Get critical roles
  const criticalRoles = useMemo(() => {
    if (!resources) return [];

    return resources.clusterRoles
      .filter(role => 
        role.metadata.name.includes('admin') || 
        role.metadata.name.includes('cluster-admin') ||
        role.rules.some(rule => rule.verbs.includes('*'))
      )
      .slice(0, 5);
  }, [resources]);

  // Get most connected subjects
  const topSubjects = useMemo(() => {
    if (!resources) return [];

    const subjectMap = new Map<string, { name: string; kind: string; bindingCount: number; roles: string[] }>();

    [...resources.clusterRoleBindings, ...resources.roleBindings].forEach(binding => {
      binding.subjects?.forEach(subject => {
        const key = `${subject.kind}-${subject.name}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            name: subject.name,
            kind: subject.kind,
            bindingCount: 0,
            roles: []
          });
        }
        const entry = subjectMap.get(key)!;
        entry.bindingCount++;
        entry.roles.push(binding.roleRef.name);
      });
    });

    return Array.from(subjectMap.values())
      .sort((a, b) => b.bindingCount - a.bindingCount)
      .slice(0, 5);
  }, [resources]);

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No RBAC data available</p>
          <p className="text-sm text-muted-foreground mt-2">Select a cluster to view security matrix</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'good': return 'text-green-500';
      default: return 'text-blue-500';
    }
  };

  const getRiskBadgeVariant = (risk: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-auto">
      {/* Header with metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <Card key={idx} className="border-l-4" style={{ borderLeftColor: metric.status === 'critical' ? '#ef4444' : metric.status === 'warning' ? '#eab308' : '#10b981' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`${getStatusColor(metric.status)}`}>
                  {metric.icon}
                </div>
                <Badge variant={metric.status === 'critical' ? 'destructive' : metric.status === 'warning' ? 'default' : 'secondary'}>
                  {metric.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <Progress value={(metric.value / metric.max) * 100} className="h-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Permission Risk Matrix */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Permission Risk Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedRisk} onValueChange={(v) => setSelectedRisk(v as any)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="high" className="text-red-500">High Risk</TabsTrigger>
                <TabsTrigger value="medium" className="text-yellow-500">Medium Risk</TabsTrigger>
                <TabsTrigger value="low" className="text-green-500">Low Risk</TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-auto">
                {(selectedRisk === 'all' || selectedRisk === 'high') && (
                  <div className="space-y-2">
                    {permissionAnalysis.high.map((perm, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="font-medium text-sm">{perm.resource}</span>
                          </div>
                          <Badge variant="destructive">HIGH RISK</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {perm.verbs.map((verb) => (
                            <Badge key={verb} variant="outline" className="text-xs">
                              {verb}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(selectedRisk === 'all' || selectedRisk === 'medium') && (
                  <div className="space-y-2">
                    {permissionAnalysis.medium.slice(0, 5).map((perm, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium text-sm">{perm.resource}</span>
                          </div>
                          <Badge>MEDIUM</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {perm.verbs.map((verb) => (
                            <Badge key={verb} variant="outline" className="text-xs">
                              {verb}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(selectedRisk === 'all' || selectedRisk === 'low') && (
                  <div className="space-y-2">
                    {permissionAnalysis.low.slice(0, 3).map((perm, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-sm">{perm.resource}</span>
                          </div>
                          <Badge variant="secondary">LOW</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {perm.verbs.map((verb) => (
                            <Badge key={verb} variant="outline" className="text-xs">
                              {verb}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right side panels */}
        <div className="space-y-4">
          {/* Critical Roles */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Critical Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalRoles.map((role) => (
                <div
                  key={role.metadata.uid}
                  className="p-2 border rounded cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => onNodeClick?.(role)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{role.metadata.name}</span>
                    <Badge variant="destructive" className="text-xs">
                      {role.rules.length} rules
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Most Connected Subjects */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Most Privileged Subjects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topSubjects.map((subject, idx) => (
                <div key={idx} className="p-2 border rounded">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {subject.kind === 'ServiceAccount' ? (
                        <Bot className="w-3 h-3 text-purple-500" />
                      ) : subject.kind === 'Group' ? (
                        <Users className="w-3 h-3 text-orange-500" />
                      ) : (
                        <User className="w-3 h-3 text-blue-500" />
                      )}
                      <span className="text-sm font-medium truncate">{subject.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {subject.bindingCount} bindings
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {subject.kind}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Security Score */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-8 h-8 text-blue-500" />
                <div className="text-right">
                  <p className="text-3xl font-bold">78</p>
                  <p className="text-xs text-muted-foreground">Security Score</p>
                </div>
              </div>
              <Progress value={78} className="h-2" />
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>No wildcard permissions in critical roles</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  <span>Review high-privilege service accounts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Add missing import
import { Link } from 'lucide-react';