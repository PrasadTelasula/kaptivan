import React, { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Layers } from 'lucide-react';
import {
  Server, Network, Copy, Box, Package, Key, FileJson, UserCheck,
  CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import type { TopologyFilters, K8sStatus } from '../types';

interface TopologySidebarProps {
  filters: TopologyFilters;
  onFiltersChange: (filters: TopologyFilters) => void;
  namespace?: string;
  hiddenFilters?: string[];
}

const TopologySidebar = memo(({ filters, onFiltersChange, namespace, hiddenFilters = [] }: TopologySidebarProps) => {
  const handleFilterChange = (key: keyof TopologyFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Namespace Info */}
      {namespace && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Namespace</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <Badge variant="secondary">{namespace}</Badge>
          </CardContent>
        </Card>
      )}
      
      {/* Search */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <Input
            placeholder="Search resources..."
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="h-8"
          />
        </CardContent>
      </Card>
      
      {/* Filters */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription className="text-xs">
            Toggle resource visibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-services" className="text-sm">Services</Label>
            <Switch
              id="show-services"
              checked={filters.showServices}
              onCheckedChange={(checked) => handleFilterChange('showServices', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-endpoints" className="text-sm">Endpoints</Label>
            <Switch
              id="show-endpoints"
              checked={filters.showEndpoints}
              onCheckedChange={(checked) => handleFilterChange('showEndpoints', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-secrets" className="text-sm">Secrets</Label>
            <Switch
              id="show-secrets"
              checked={filters.showSecrets}
              onCheckedChange={(checked) => handleFilterChange('showSecrets', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-configmaps" className="text-sm">ConfigMaps</Label>
            <Switch
              id="show-configmaps"
              checked={filters.showConfigMaps}
              onCheckedChange={(checked) => handleFilterChange('showConfigMaps', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-sa" className="text-sm">ServiceAccount</Label>
            <Switch
              id="show-sa"
              checked={filters.showServiceAccount}
              onCheckedChange={(checked) => handleFilterChange('showServiceAccount', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-rbac" className="text-sm">RBAC (Roles)</Label>
            <Switch
              id="show-rbac"
              checked={filters.showRBAC}
              onCheckedChange={(checked) => handleFilterChange('showRBAC', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="show-containers" className="text-sm">Containers</Label>
            <Switch
              id="show-containers"
              checked={filters.showContainers}
              onCheckedChange={(checked) => handleFilterChange('showContainers', checked)}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="status-filter" className="text-sm">Status Filter</Label>
            <Select
              value={filters.statusFilter}
              onValueChange={(value) => handleFilterChange('statusFilter', value as 'all' | K8sStatus)}
            >
              <SelectTrigger id="status-filter" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Healthy">Healthy</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Error">Error</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Legend */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Legend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs space-y-1">
            <div className="font-semibold mb-1">Resource Types</div>
            <div className="flex items-center gap-2">
              <Server className="h-3 w-3 text-blue-500" />
              <span>Deployment</span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="h-3 w-3 text-green-500" />
              <span>Service</span>
            </div>
            <div className="flex items-center gap-2">
              <Copy className="h-3 w-3 text-gray-500" />
              <span>ReplicaSet</span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="h-3 w-3 text-indigo-500" />
              <span>Pod</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-3 w-3 text-purple-500" />
              <span>Container</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-3 w-3 text-orange-500" />
              <span>Secret</span>
            </div>
            <div className="flex items-center gap-2">
              <FileJson className="h-3 w-3 text-cyan-500" />
              <span>ConfigMap</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-3 w-3 text-violet-500" />
              <span>ServiceAccount</span>
            </div>
          </div>
          
          <Separator />
          
          <div className="text-xs space-y-1">
            <div className="font-semibold mb-1">Status Indicators</div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span>Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Error</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

TopologySidebar.displayName = 'TopologySidebar';

export default TopologySidebar;