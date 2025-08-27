import React, { memo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Layers } from 'lucide-react';
import {
  Server, Network, Copy, Box, Package, Key, FileJson, UserCheck,
  CheckCircle2, AlertCircle, XCircle, Shield, Briefcase, Calendar
} from 'lucide-react';
import type { TopologyFilters, ResourceStatus } from '../types';

interface TopologySidebarProps {
  filters: TopologyFilters;
  onFiltersChange: (filters: TopologyFilters) => void;
  namespace?: string;
  hiddenFilters?: string[];
  topologyType?: 'deployment' | 'daemonset' | 'job' | 'cronjob';
}

const TopologySidebar = memo(({ filters, onFiltersChange, namespace, hiddenFilters = [], topologyType = 'deployment' }: TopologySidebarProps) => {
  const handleFilterChange = (key: keyof TopologyFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };
  
  // Get status options based on topology type
  const getStatusOptions = () => {
    switch (topologyType) {
      case 'deployment':
        return [
          { value: 'all', label: 'All Status' },
          { value: 'Available', label: 'Available' },
          { value: 'Progressing', label: 'Progressing' },
          { value: 'Failed', label: 'Failed' },
          { value: 'Unknown', label: 'Unknown' }
        ];
      case 'daemonset':
        return [
          { value: 'all', label: 'All Status' },
          { value: 'Available', label: 'Available' },
          { value: 'Unavailable', label: 'Unavailable' },
          { value: 'Updating', label: 'Updating' },
          { value: 'Unknown', label: 'Unknown' }
        ];
      case 'job':
        return [
          { value: 'all', label: 'All Status' },
          { value: 'Succeeded', label: 'Succeeded' },
          { value: 'Running', label: 'Running' },
          { value: 'Failed', label: 'Failed' },
          { value: 'Pending', label: 'Pending' },
          { value: 'Unknown', label: 'Unknown' }
        ];
      case 'cronjob':
        return [
          { value: 'all', label: 'All Status' },
          { value: 'Active', label: 'Active (Jobs Running)' },
          { value: 'Suspended', label: 'Suspended' },
          { value: 'Scheduled', label: 'Scheduled (Idle)' },
          { value: 'Succeeded', label: 'Last Job Succeeded' },
          { value: 'Failed', label: 'Last Job Failed' },
          { value: 'Unknown', label: 'Unknown' }
        ];
      default:
        return [
          { value: 'all', label: 'All Status' },
          { value: 'Healthy', label: 'Healthy' },
          { value: 'Warning', label: 'Warning' },
          { value: 'Error', label: 'Error' },
          { value: 'Unknown', label: 'Unknown' }
        ];
    }
  };
  
  return (
    <div className="space-y-2">
      {/* Namespace and Search on same line */}
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
            placeholder="Search..."
            value={filters.searchTerm}
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
            <Label htmlFor="show-services" className="text-xs font-normal">Services</Label>
            <Switch
              id="show-services"
              checked={filters.showServices}
              onCheckedChange={(checked) => handleFilterChange('showServices', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-endpoints" className="text-xs font-normal">Endpoints</Label>
            <Switch
              id="show-endpoints"
              checked={filters.showEndpoints}
              onCheckedChange={(checked) => handleFilterChange('showEndpoints', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-secrets" className="text-xs font-normal">Secrets</Label>
            <Switch
              id="show-secrets"
              checked={filters.showSecrets}
              onCheckedChange={(checked) => handleFilterChange('showSecrets', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-configmaps" className="text-xs font-normal">ConfigMaps</Label>
            <Switch
              id="show-configmaps"
              checked={filters.showConfigMaps}
              onCheckedChange={(checked) => handleFilterChange('showConfigMaps', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-sa" className="text-xs font-normal">ServiceAccount</Label>
            <Switch
              id="show-sa"
              checked={filters.showServiceAccount}
              onCheckedChange={(checked) => handleFilterChange('showServiceAccount', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-rbac" className="text-xs font-normal">RBAC (Roles)</Label>
            <Switch
              id="show-rbac"
              checked={filters.showRBAC}
              onCheckedChange={(checked) => handleFilterChange('showRBAC', checked)}
              className="scale-75"
            />
          </div>
          
          <div className="flex items-center justify-between py-0.5">
            <Label htmlFor="show-containers" className="text-xs font-normal">Containers</Label>
            <Switch
              id="show-containers"
              checked={filters.showContainers}
              onCheckedChange={(checked) => handleFilterChange('showContainers', checked)}
              className="scale-75"
            />
          </div>
          
          <Separator className="my-1.5" />
          
          <div className="space-y-1">
            <Label htmlFor="status-filter" className="text-xs font-normal">Status Filter</Label>
            <Select
              value={filters.statusFilter}
              onValueChange={(value) => handleFilterChange('statusFilter', value as ResourceStatus)}
            >
              <SelectTrigger id="status-filter" className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getStatusOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="bg-card border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
          <Layers className="h-3.5 w-3.5" />
          Legend
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] space-y-0.5">
            <div className="font-medium text-muted-foreground mb-0.5">Resource Types</div>
            
            {/* Main resource based on topology type */}
            {topologyType === 'deployment' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Server className="h-2.5 w-2.5 text-blue-500" />
                  <span>Deployment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Copy className="h-2.5 w-2.5 text-gray-500" />
                  <span>ReplicaSet</span>
                </div>
              </>
            )}
            
            {topologyType === 'daemonset' && (
              <div className="flex items-center gap-1.5">
                <Shield className="h-2.5 w-2.5 text-blue-500" />
                <span>DaemonSet</span>
              </div>
            )}
            
            {topologyType === 'job' && (
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-2.5 w-2.5 text-blue-500" />
                <span>Job</span>
              </div>
            )}
            
            {topologyType === 'cronjob' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-2.5 w-2.5 text-blue-500" />
                  <span>CronJob</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-2.5 w-2.5 text-indigo-500" />
                  <span>Job</span>
                </div>
              </>
            )}
            
            {/* Common resources */}
            <div className="flex items-center gap-1.5">
              <Box className="h-2.5 w-2.5 text-indigo-500" />
              <span>Pod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="h-2.5 w-2.5 text-purple-500" />
              <span>Container</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Network className="h-2.5 w-2.5 text-green-500" />
              <span>Service</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Key className="h-2.5 w-2.5 text-orange-500" />
              <span>Secret</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileJson className="h-2.5 w-2.5 text-cyan-500" />
              <span>ConfigMap</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-2.5 w-2.5 text-violet-500" />
              <span>ServiceAccount</span>
            </div>
          </div>
          
          <Separator className="my-1" />
          
          <div className="text-[10px] space-y-0.5">
            <div className="font-medium text-muted-foreground mb-0.5">Status Indicators</div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
              <span>Healthy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
              <span>Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-2.5 w-2.5 text-red-500" />
              <span>Error</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TopologySidebar.displayName = 'TopologySidebar';

export default TopologySidebar;