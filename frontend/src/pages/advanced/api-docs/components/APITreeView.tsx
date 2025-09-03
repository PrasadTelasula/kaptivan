import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Package, Layers, FileText, Search, Loader2, Server } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TreeNode, APIGroup, APIResource } from '../types';
import { apiDocsService } from '../services/api-docs.service';

interface Cluster {
  name: string;
  context: string;
  connected: boolean;
  error?: string;
}

interface APITreeViewProps {
  context: string;
  clusters?: Cluster[];
  onContextChange?: (context: string) => void;
  onNodeSelect: (node: TreeNode) => void;
  selectedNode?: TreeNode | null;
}

export default function APITreeView({ context, clusters = [], onContextChange, onNodeSelect, selectedNode }: APITreeViewProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<APIResource[]>([]);

  // Load API groups on mount
  useEffect(() => {
    if (context) {
      loadAPIGroups();
    }
  }, [context]);

  const loadAPIGroups = async () => {
    setLoading(true);
    try {
      const groups = await apiDocsService.getAPIGroups(context);
      
      const nodes: TreeNode[] = groups.map(group => ({
        id: `group-${group.name}`,
        label: group.name === 'core' ? 'Core API' : group.name,
        type: 'group',
        data: group,
        children: group.versions.map(version => ({
          id: `version-${group.name}-${version}`,
          label: version,
          type: 'version',
          data: { group: group.name, version },
          children: undefined, // Will be loaded on demand
        })),
      }));
      
      setTreeData(nodes);
    } catch (error) {
      console.error('Failed to load API groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async (groupName: string, version: string): Promise<TreeNode[]> => {
    try {
      const resources = await apiDocsService.getAPIResources(context, groupName, version);
      
      return resources.map(resource => ({
        id: `resource-${groupName}-${version}-${resource.name}`,
        label: resource.name,
        type: 'resource',
        data: resource,
        children: [], // Resources can have fields as children
      }));
    } catch (error) {
      console.error('Failed to load resources:', error);
      return [];
    }
  };

  const handleNodeClick = useCallback(async (node: TreeNode) => {
    const nodeId = node.id;
    const isExpanded = expandedNodes.has(nodeId);
    
    // Toggle expansion
    const newExpanded = new Set(expandedNodes);
    if (isExpanded) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
      
      // Load children on demand for version nodes
      if (node.type === 'version' && !node.children) {
        const { group, version } = node.data;
        const resources = await loadResources(group, version);
        
        // Update tree data with loaded resources
        setTreeData(prevData => {
          const updateNode = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(n => {
              if (n.id === nodeId) {
                return { ...n, children: resources };
              }
              if (n.children) {
                return { ...n, children: updateNode(n.children) };
              }
              return n;
            });
          };
          return updateNode(prevData);
        });
      }
    }
    
    setExpandedNodes(newExpanded);
    onNodeSelect(node);
  }, [expandedNodes, context, onNodeSelect]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await apiDocsService.searchResources(context, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
  }, [context]);

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;
    
    const getNodeIcon = () => {
      switch (node.type) {
        case 'group':
          return <Package className="w-4 h-4" />;
        case 'version':
          return <Layers className="w-4 h-4" />;
        case 'resource':
          return <FileText className="w-4 h-4" />;
        default:
          return null;
      }
    };
    
    const getNodeBadge = () => {
      if (node.type === 'resource' && node.data) {
        const resource = node.data as APIResource;
        if (resource.namespaced) {
          return <Badge variant="outline" className="ml-2 text-xs">Namespaced</Badge>;
        }
      }
      return null;
    };
    
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 hover:bg-accent rounded cursor-pointer",
            isSelected && "bg-accent",
            "transition-colors"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {hasChildren || node.type === 'version' ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          <div className="text-primary">{getNodeIcon()}</div>
          <span className="text-sm font-medium">{node.label}</span>
          {getNodeBadge()}
        </div>
        
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;
    
    return (
      <div className="p-2 border-b">
        <div className="text-xs text-muted-foreground mb-2">
          Search Results ({searchResults.length})
        </div>
        {searchResults.map(resource => (
          <div
            key={`search-${resource.group}-${resource.version}-${resource.name}`}
            className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer"
            onClick={() => {
              const node: TreeNode = {
                id: `resource-${resource.group}-${resource.version}-${resource.name}`,
                label: resource.name,
                type: 'resource',
                data: resource,
              };
              onNodeSelect(node);
            }}
          >
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm">{resource.name}</span>
            <span className="text-xs text-muted-foreground">
              {resource.group}/{resource.version}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const connectedClusters = clusters.filter(c => c.connected);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        {/* Context Selector */}
        {connectedClusters.length > 0 && (
          <Select value={context} onValueChange={onContextChange}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <SelectValue placeholder="Select cluster context" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {connectedClusters.map(cluster => (
                <SelectItem key={cluster.context} value={cluster.context}>
                  <div className="flex items-center gap-2">
                    <span>{cluster.name || cluster.context}</span>
                    {cluster.error && (
                      <Badge variant="destructive" className="text-xs">Error</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search resources... (Press /)"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {searchQuery && renderSearchResults()}
            <div className="p-2">
              {treeData.map(node => renderTreeNode(node))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}