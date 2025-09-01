import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RBACRole, RBACRoleBinding, PolicyRule, RBACSubject } from '../types';
import { Shield, Users, Bot, User, Clock, Tag } from 'lucide-react';

interface RBACDetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  type: 'role' | 'binding' | 'subject';
  data: any;
}

export default function RBACDetailPanel({
  open,
  onClose,
  title,
  type,
  data,
}: RBACDetailPanelProps) {
  const renderRoleDetails = (role: RBACRole) => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="text-sm font-medium">{role.metadata.name}</span>
            </div>
            {role.metadata.namespace && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Namespace:</span>
                <Badge variant="outline">{role.metadata.namespace}</Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="text-sm flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(role.metadata.creationTimestamp).toLocaleDateString()}
              </span>
            </div>
            {role.metadata.labels && Object.keys(role.metadata.labels).length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Labels:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(role.metadata.labels).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules ({role.rules.length})</CardTitle>
          <CardDescription>Permissions granted by this role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {role.rules.map((rule: PolicyRule, index: number) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  <span className="text-sm font-medium">Verbs:</span>
                  {rule.verbs.map((verb) => (
                    <Badge key={verb} variant={getVerbVariant(verb)}>
                      {verb}
                    </Badge>
                  ))}
                </div>
                {rule.resources && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm font-medium">Resources:</span>
                    {rule.resources.map((resource) => (
                      <Badge key={resource} variant="outline">
                        {resource}
                      </Badge>
                    ))}
                  </div>
                )}
                {rule.apiGroups && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm font-medium">API Groups:</span>
                    {rule.apiGroups.map((group) => (
                      <Badge key={group} variant="secondary">
                        {group || 'core'}
                      </Badge>
                    ))}
                  </div>
                )}
                {rule.resourceNames && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm font-medium">Resource Names:</span>
                    {rule.resourceNames.map((name) => (
                      <span key={name} className="text-sm text-muted-foreground">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBindingDetails = (binding: RBACRoleBinding) => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Binding Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="text-sm font-medium">{binding.metadata.name}</span>
            </div>
            {binding.metadata.namespace && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Namespace:</span>
                <Badge variant="outline">{binding.metadata.namespace}</Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="default">
                {binding.roleRef.kind}: {binding.roleRef.name}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Subjects ({binding.subjects.length})
          </CardTitle>
          <CardDescription>Entities bound to this role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {binding.subjects.map((subject: RBACSubject, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {getSubjectIcon(subject.kind)}
                  <div>
                    <div className="font-medium text-sm">{subject.name}</div>
                    <div className="text-xs text-muted-foreground">{subject.kind}</div>
                  </div>
                </div>
                {subject.namespace && (
                  <Badge variant="outline">{subject.namespace}</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const getSubjectIcon = (kind: string) => {
    switch (kind) {
      case 'User':
        return <User className="w-4 h-4 text-orange-500" />;
      case 'Group':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'ServiceAccount':
        return <Bot className="w-4 h-4 text-pink-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getVerbVariant = (verb: string) => {
    if (['get', 'list', 'watch'].includes(verb)) return 'secondary';
    if (['create', 'update', 'patch'].includes(verb)) return 'default';
    if (verb === 'delete') return 'destructive';
    return 'outline';
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Detailed information about the selected {type}
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {type === 'role' && data && renderRoleDetails(data)}
          {type === 'binding' && data && renderBindingDetails(data)}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}