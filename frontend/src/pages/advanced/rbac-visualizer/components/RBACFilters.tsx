import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import type { FilterOptions } from '../types';

interface RBACFiltersProps {
  filters: FilterOptions;
  namespaces: string[];
  resources?: any; // RBAC resources for populating dropdown
  onFiltersChange: (filters: FilterOptions) => void;
  onRefresh: () => void;
  onExport: () => void;
}

export default function RBACFilters({
  filters,
  namespaces,
  resources,
  onFiltersChange,
  onRefresh,
  onExport,
}: RBACFiltersProps) {
  // Get available items based on filter type
  const getFilterItems = () => {
    if (!resources) return [];
    
    const selectedNamespace = filters.namespace;
    
    switch (filters.filterType) {
      case 'serviceAccount':
        // Get service accounts filtered by namespace
        const serviceAccounts = resources.serviceAccounts
          ?.filter((sa: any) => !selectedNamespace || sa.metadata?.namespace === selectedNamespace)
          ?.map((sa: any) => `${sa.metadata.namespace}/${sa.metadata.name}`) || [];
        
        // Also get from bindings
        const saFromBindings = new Set<string>();
        const bindingsForSA = [
          ...(resources.roleBindings || []).filter((b: any) => 
            !selectedNamespace || b.metadata?.namespace === selectedNamespace
          ),
          ...(resources.clusterRoleBindings || [])
        ];
        
        bindingsForSA.forEach(binding => {
          binding.subjects?.forEach((subject: any) => {
            if (subject.kind === 'ServiceAccount') {
              const ns = subject.namespace || binding.metadata?.namespace || 'default';
              // Only add if matches namespace filter
              if (!selectedNamespace || ns === selectedNamespace) {
                saFromBindings.add(`${ns}/${subject.name}`);
              }
            }
          });
        });
        return [...new Set([...serviceAccounts, ...Array.from(saFromBindings)])].sort();
        
      case 'role':
        // Get only namespace-specific roles
        const roles: string[] = [];
        
        if (resources.roles) {
          resources.roles
            .filter((r: any) => !selectedNamespace || r.metadata?.namespace === selectedNamespace)
            .forEach((r: any) => {
              roles.push(`${r.metadata.namespace}/${r.metadata.name}`);
            });
        }
        
        return roles.sort();
        
      case 'clusterRole':
        // Get only cluster roles
        const clusterRoles: string[] = [];
        
        if (resources.clusterRoles) {
          resources.clusterRoles.forEach((r: any) => {
            clusterRoles.push(r.metadata.name);
          });
        }
        
        return clusterRoles.sort();
        
      default:
        return [];
    }
  };
  const handleNamespaceChange = (value: string) => {
    onFiltersChange({
      ...filters,
      namespace: value === 'all' ? undefined : value,
      filterValue: undefined, // Clear selected item when changing namespace
    });
  };

  const handleFilterTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      filterType: value === 'all' ? undefined : value as FilterOptions['filterType'],
      filterValue: undefined, // Clear the selected item when changing filter type
    });
  };

  const handleFilterValueChange = (value: string) => {
    onFiltersChange({
      ...filters,
      filterValue: value === 'all' ? undefined : value,
    });
  };

  const handleSystemRolesToggle = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      showSystemRoles: checked,
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Namespace filter */}
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="namespace">Namespace</Label>
            <Select
              value={filters.namespace || 'all'}
              onValueChange={handleNamespaceChange}
            >
              <SelectTrigger id="namespace">
                <SelectValue placeholder="Select namespace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Namespaces</SelectItem>
                {namespaces.map((ns) => (
                  <SelectItem key={ns} value={ns}>
                    {ns}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter type */}
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="filterType">Filter By</Label>
            <Select
              value={filters.filterType || 'all'}
              onValueChange={handleFilterTypeChange}
            >
              <SelectTrigger id="filterType">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="role">Roles</SelectItem>
                <SelectItem value="clusterRole">ClusterRoles</SelectItem>
                <SelectItem value="serviceAccount">ServiceAccounts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter value dropdown */}
          <div className="flex-1 min-w-[250px]">
            <Label htmlFor="filterValue">Search</Label>
            <Select
              value={filters.filterValue || 'all'}
              onValueChange={handleFilterValueChange}
              disabled={!filters.filterType || filters.filterType === 'all'}
            >
              <SelectTrigger id="filterValue">
                <SelectValue placeholder={
                  !filters.filterType || filters.filterType === 'all' 
                    ? "Select filter type first" 
                    : "Select item..."
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {getFilterItems().map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show system roles toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="systemRoles"
              checked={filters.showSystemRoles || false}
              onCheckedChange={handleSystemRolesToggle}
            />
            <Label htmlFor="systemRoles">Show System Roles</Label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onExport}
              title="Export"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}