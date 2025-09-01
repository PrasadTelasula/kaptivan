import React, { memo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Filter, 
  Layers,
  Shield,
  ShieldCheck,
  User,
  Users,
  Bot,
  Link,
  Globe,
  Package,
  Key,
  Lock
} from 'lucide-react';

interface RBACSidebarProps {
  filters: {
    showSystemRoles?: boolean;
    showServiceAccounts?: boolean;
    showUsers?: boolean;
    showGroups?: boolean;
    showBindings?: boolean;
    searchTerm?: string;
    namespace?: string;
  };
  onFiltersChange: (filters: any) => void;
  namespace?: string;
}

const RBACSidebar = memo(({ filters, onFiltersChange, namespace }: RBACSidebarProps) => {
  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };
  
  return (
    <div className="space-y-2">
      {/* Namespace and Search */}
      <div className="bg-card border rounded-lg px-3 py-2 space-y-2">
        {namespace && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Namespace</span>
            <Badge variant="secondary" className="text-xs">{namespace}</Badge>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search roles, subjects..."
            value={filters.searchTerm || ''}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="h-6 text-xs flex-1"
          />
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-card border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-system" className="text-xs font-normal">System Roles</Label>
            <Switch
              id="show-system"
              checked={filters.showSystemRoles || false}
              onCheckedChange={(checked) => handleFilterChange('showSystemRoles', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-sa" className="text-xs font-normal">Service Accounts</Label>
            <Switch
              id="show-sa"
              checked={filters.showServiceAccounts !== false}
              onCheckedChange={(checked) => handleFilterChange('showServiceAccounts', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-users" className="text-xs font-normal">Users</Label>
            <Switch
              id="show-users"
              checked={filters.showUsers !== false}
              onCheckedChange={(checked) => handleFilterChange('showUsers', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-groups" className="text-xs font-normal">Groups</Label>
            <Switch
              id="show-groups"
              checked={filters.showGroups !== false}
              onCheckedChange={(checked) => handleFilterChange('showGroups', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-bindings" className="text-xs font-normal">Show Bindings</Label>
            <Switch
              id="show-bindings"
              checked={filters.showBindings !== false}
              onCheckedChange={(checked) => handleFilterChange('showBindings', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-pods" className="text-xs font-normal">Show Pods</Label>
            <Switch
              id="show-pods"
              checked={filters.showPods !== false}
              onCheckedChange={(checked) => handleFilterChange('showPods', checked)}
              className="scale-75"
            />
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="bg-card border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
          <Layers className="h-3.5 w-3.5" />
          Legend
        </div>
        <div className="space-y-2">
          {/* Resource Types */}
          <div>
            <div className="text-xs font-medium mb-1.5">Resource Types</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-xs">ClusterRole</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-xs">Role</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded" />
                <span className="text-xs">ServiceAccount</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-sky-500 rounded" />
                <span className="text-xs">Pod</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded" />
                <span className="text-xs">User/Group</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded" />
                <span className="text-xs">Binding</span>
              </div>
            </div>
          </div>
          
          <Separator className="my-1.5" />
          
          {/* Connection Types */}
          <div>
            <div className="text-xs font-medium mb-1.5">Connections</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500" />
                <span className="text-xs">ClusterRoleBinding</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500" />
                <span className="text-xs">RoleBinding</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

RBACSidebar.displayName = 'RBACSidebar';

export default RBACSidebar;