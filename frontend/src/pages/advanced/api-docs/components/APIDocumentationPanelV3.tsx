import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Toggle } from '@/components/ui/toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Code, FileJson, FileText, Info, Loader2, ChevronRight, Home, Search, ChevronDown, 
  FolderOpen, Folder, FileCode, Copy, Check, Download, ExternalLink, BookOpen,
  Star, StarOff, Hash, Braces, List, Type, AlertCircle, Shield, Eye, EyeOff,
  Terminal, Filter, SplitSquareHorizontal, History, Bookmark, Settings, MoreVertical,
  ArrowRight, Package, Layers, Database, Key, Lock, Unlock, Clock, AlertTriangle,
  Plus, X, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode, ResourceSchema, ExplainOutput, APIResource, ResourceField } from '../types';
import { apiDocsService } from '../services/api-docs.service';
import { useSearchParams } from 'react-router-dom';

// Extended types for enhanced functionality
interface FieldNode {
  name: string;
  path: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: any;
  deprecated?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: string[];
  };
  children?: FieldNode[];
  expanded?: boolean;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  command: string;
  description?: string;
}

interface APIDocumentationPanelProps {
  context: string;
  selectedNode: TreeNode | null;
}

// Helper function to get field type icon
const getFieldTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'string':
      return <Type className="h-3 w-3" />;
    case 'number':
    case 'integer':
      return <Hash className="h-3 w-3" />;
    case 'boolean':
      return <Toggle className="h-3 w-3" />;
    case 'object':
      return <Braces className="h-3 w-3" />;
    case 'array':
      return <List className="h-3 w-3" />;
    case 'map':
      return <Database className="h-3 w-3" />;
    default:
      return <FileCode className="h-3 w-3" />;
  }
};

// Helper function to get field type color
const getFieldTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'string':
      return 'text-green-600 dark:text-green-400';
    case 'number':
    case 'integer':
      return 'text-blue-600 dark:text-blue-400';
    case 'boolean':
      return 'text-purple-600 dark:text-purple-400';
    case 'object':
      return 'text-orange-600 dark:text-orange-400';
    case 'array':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const getVerbVariant = (verb: string): "default" | "secondary" | "destructive" | "outline" => {
  if (['delete', 'deletecollection'].includes(verb)) return 'destructive';
  if (['create', 'update', 'patch'].includes(verb)) return 'default';
  if (['get', 'list', 'watch'].includes(verb)) return 'secondary';
  return 'outline';
};

const getVerbColor = (verb: string): string => {
  if (['delete', 'deletecollection'].includes(verb)) return '';
  if (['create'].includes(verb)) return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (['update', 'patch'].includes(verb)) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  if (['get', 'list', 'watch'].includes(verb)) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  return '';
};

export default function APIDocumentationPanelV3({ context, selectedNode }: APIDocumentationPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<ResourceSchema | null>(null);
  const [explanation, setExplanation] = useState<ExplainOutput | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Enhanced state management
  const [fieldPath, setFieldPath] = useState<string>('');
  const [fieldPathInput, setFieldPathInput] = useState<string>('');
  const [fieldPathHistory, setFieldPathHistory] = useState<string[]>([]);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldTree, setFieldTree] = useState<FieldNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bookmarkedFields, setBookmarkedFields] = useState<Set<string>>(new Set());
  const [recentResources, setRecentResources] = useState<APIResource[]>([]);
  const [showSplitView, setShowSplitView] = useState(false);
  const [showFieldDetails, setShowFieldDetails] = useState(false);
  const [selectedFieldNode, setSelectedFieldNode] = useState<FieldNode | null>(null);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);

  // Fetch resource details when selectedNode changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'resource') {
      fetchResourceDetails();
    }
  }, [selectedNode, context]);

  const fetchResourceDetails = async () => {
    if (!selectedNode || selectedNode.type !== 'resource') return;
    
    setLoading(true);
    try {
      const resource = selectedNode.data as APIResource;
      
      // Fetch schema
      const schemaData = await apiDocsService.getResourceSchema(
        context,
        resource.group || 'core',
        resource.version,
        resource.kind
      );
      setSchema(schemaData);
      
      // Fetch explanation for the base resource
      const explainData = await apiDocsService.getResourceExplain(
        context,
        resource.name,
        ''
      );
      setExplanation(explainData);
      
      // Add to recent resources
      setRecentResources(prev => {
        const filtered = prev.filter(r => r.name !== resource.name);
        const updated = [resource, ...filtered].slice(0, 10);
        localStorage.setItem('api-docs-recent', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch resource details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load state from URL and localStorage
  useEffect(() => {
    const path = searchParams.get('field');
    if (path) {
      setFieldPath(path);
      setFieldPathInput(path);
    }

    // Load bookmarks from localStorage
    const saved = localStorage.getItem('api-docs-bookmarks');
    if (saved) {
      setBookmarkedFields(new Set(JSON.parse(saved)));
    }

    // Load recent resources
    const recent = localStorage.getItem('api-docs-recent');
    if (recent) {
      setRecentResources(JSON.parse(recent));
    }
  }, []);

  // Update URL when field path changes
  useEffect(() => {
    if (fieldPath) {
      searchParams.set('field', fieldPath);
    } else {
      searchParams.delete('field');
    }
    setSearchParams(searchParams);
  }, [fieldPath]);

  // Save bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem('api-docs-bookmarks', JSON.stringify(Array.from(bookmarkedFields)));
  }, [bookmarkedFields]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setAutocompleteOpen(true);
      }
      // Escape to close panels
      if (e.key === 'Escape') {
        setShowFieldDetails(false);
        setAutocompleteOpen(false);
      }
      // Ctrl/Cmd + \ for split view
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setShowSplitView(!showSplitView);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSplitView]);

  const copyToClipboard = async (text: string, fieldId?: string) => {
    await navigator.clipboard.writeText(text);
    if (fieldId) {
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const toggleBookmark = (path: string) => {
    setBookmarkedFields(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const exportDocumentation = () => {
    if (!selectedNode || !schema) return;
    
    const doc = {
      resource: selectedNode.data,
      schema,
      explanation: explanation?.explanation,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode.data.name}-api-docs.json`;
    a.click();
  };

  const parseFieldsToTree = (fields: string[]): FieldNode[] => {
    const tree: FieldNode[] = [];
    
    fields.forEach(field => {
      const match = field.match(/^(\w+)\s+<([^>]+)>(?:\s+(.+))?$/);
      if (match) {
        const [, name, type, description] = match;
        // Only use the field name, not append to existing path
        // The path should be built from the actual field hierarchy
        tree.push({
          name,
          path: name,  // Just use the field name
          type,
          description,
          required: description?.includes('Required') || false,
          deprecated: description?.includes('deprecated') || false,
          children: []
        });
      }
    });
    
    return tree;
  };

  const extractFieldsFromExplanation = (explanation: string): string[] => {
    const lines = explanation.split('\n');
    const fields: string[] = [];
    let inFieldsSection = false;
    
    for (const line of lines) {
      if (line.includes('FIELDS:')) {
        inFieldsSection = true;
        continue;
      }
      
      if (inFieldsSection && line.trim()) {
        if (line.match(/^\s+\w+\s+<[^>]+>/)) {
          fields.push(line.trim());
        } else if (!line.startsWith('  ')) {
          break;
        }
      }
    }
    
    return fields;
  };

  const navigateToField = async (path: string) => {
    setFieldPathInput(path);
    await fetchFieldExplanation(path);
  };

  const fetchFieldExplanation = async (path: string) => {
    if (!selectedNode || selectedNode.type !== 'resource') return;
    
    setLoadingExplain(true);
    try {
      const resource = selectedNode.data as APIResource;
      const explainData = await apiDocsService.getResourceExplain(
        context,
        resource.name,
        path
      );
      setExplanation(explainData);
      setFieldPath(path);
      
      // Parse fields into tree structure
      const fields = extractFieldsFromExplanation(explainData.explanation);
      const tree = parseFieldsToTree(fields);
      setFieldTree(tree);
      
      // Add to history
      if (path && !fieldPathHistory.includes(path)) {
        setFieldPathHistory(prev => [...prev.slice(-9), path]);
      }
    } catch (error) {
      console.error('Failed to fetch field explanation:', error);
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleFieldPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fieldPathInput.trim()) {
      navigateToField(fieldPathInput.trim());
    }
  };

  const getQuickActions = (): QuickAction[] => {
    if (!selectedNode || selectedNode.type !== 'resource') return [];
    
    const resource = selectedNode.data as APIResource;
    const actions: QuickAction[] = [];

    if (resource.verbs.includes('get')) {
      actions.push({
        label: 'Get',
        icon: <Eye className="h-4 w-4" />,
        command: `kubectl get ${resource.name} -n <namespace>`,
        description: 'Get resources'
      });
    }

    if (resource.verbs.includes('list')) {
      actions.push({
        label: 'List',
        icon: <List className="h-4 w-4" />,
        command: `kubectl get ${resource.name} --all-namespaces`,
        description: 'List all resources'
      });
    }

    if (resource.verbs.includes('create')) {
      actions.push({
        label: 'Create',
        icon: <Plus className="h-4 w-4" />,
        command: `kubectl create ${resource.name} <name>`,
        description: 'Create a new resource'
      });
    }

    actions.push({
      label: 'Describe',
      icon: <FileText className="h-4 w-4" />,
      command: `kubectl describe ${resource.name} <name>`,
      description: 'Describe resource'
    });

    actions.push({
      label: 'Explain',
      icon: <Info className="h-4 w-4" />,
      command: `kubectl explain ${resource.name}`,
      description: 'Explain resource fields'
    });

    return actions;
  };

  const renderFieldNode = (node: FieldNode, depth: number = 0, parentPath: string = '') => {
    // Build the correct path based on parent path
    const fullPath = parentPath ? `${parentPath}.${node.name}` : node.name;
    const isExpanded = expandedFields.has(fullPath);
    const isBookmarked = bookmarkedFields.has(fullPath);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={fullPath}>
        <div
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors",
            selectedFieldNode?.path === fullPath && "bg-accent"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/Collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedFields(prev => {
                const next = new Set(prev);
                if (next.has(fullPath)) {
                  next.delete(fullPath);
                } else {
                  next.add(fullPath);
                  // Load children for this field
                  if (!hasChildren) {
                    navigateToField(fullPath);
                  }
                }
                return next;
              });
            }}
            className="p-0.5"
          >
            {hasChildren || node.type === 'object' ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : (
              <div className="w-3" />
            )}
          </button>

          {/* Field Type Icon */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("flex items-center", getFieldTypeColor(node.type))}>
                  {getFieldTypeIcon(node.type)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Type: {node.type}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Field Name */}
          <button
            onClick={() => {
              setSelectedFieldNode({...node, path: fullPath});
              navigateToField(fullPath);
            }}
            className="flex-1 text-left text-sm font-medium hover:underline"
          >
            {node.name}
          </button>

          {/* Badges */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.required && (
              <Badge variant="destructive" className="text-xs px-1 py-0">
                Required
              </Badge>
            )}
            {node.deprecated && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Deprecated
              </Badge>
            )}
            
            {/* Actions */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(fullPath, fullPath);
                    }}
                  >
                    {copiedField === fullPath ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy field path</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark(fullPath);
                    }}
                  >
                    {isBookmarked ? (
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    ) : (
                      <StarOff className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderFieldNode(child, depth + 1, fullPath))}
          </div>
        )}
      </div>
    );
  };

  const renderExplain = () => {
    if (!selectedNode || selectedNode.type !== 'resource') return null;
    
    const resource = selectedNode.data as APIResource;
    const currentPath = fieldPath ? `${resource.name}.${fieldPath}` : resource.name;
    
    return (
      <div className="h-full flex">
        {/* Left Panel - Enhanced Field Explorer */}
        <div className="w-80 border-r flex flex-col h-full">
          <div className="p-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Field Explorer</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Settings className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setExpandedFields(new Set())}>
                    Collapse All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const allPaths = new Set<string>();
                    const addPaths = (nodes: FieldNode[]) => {
                      nodes.forEach(node => {
                        allPaths.add(node.path);
                        if (node.children) addPaths(node.children);
                      });
                    };
                    addPaths(fieldTree);
                    setExpandedFields(allPaths);
                  }}>
                    Expand All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={exportDocumentation}>
                    <Download className="h-3 w-3 mr-2" />
                    Export Documentation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1 text-xs flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToField('')}
                className="h-6 px-1.5 text-xs"
              >
                <Home className="h-3 w-3 mr-1" />
                {resource.name}
              </Button>
              {fieldPath && (
                <>
                  {fieldPath.split('.').map((segment, idx, arr) => {
                    const path = arr.slice(0, idx + 1).join('.');
                    return (
                      <React.Fragment key={idx}>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateToField(path)}
                          className="h-6 px-1.5 text-xs"
                        >
                          {segment}
                        </Button>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>

            {/* Field Search */}
            <div className="mt-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="absolute inset-0 p-2">
              {/* Field Tree */}
              <div className="space-y-1">
                {loadingExplain ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : fieldTree.length > 0 ? (
                  fieldTree
                    .filter(node => 
                      !searchQuery || 
                      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      node.description?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(node => renderFieldNode(node, 0, fieldPath))
                ) : (
                  <div className="text-sm text-muted-foreground p-4 text-center">
                    Loading fields...
                  </div>
                )}
              </div>
              
              {/* Bookmarked Fields */}
              {bookmarkedFields.size > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    <Bookmark className="h-3 w-3 inline mr-1" />
                    Bookmarked Fields
                  </p>
                  <div className="space-y-1">
                    {Array.from(bookmarkedFields).map(path => (
                      <Button
                        key={path}
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToField(path)}
                        className="w-full justify-start h-7 px-2 text-xs"
                      >
                        <FileCode className="h-3 w-3 mr-2 text-muted-foreground" />
                        {path}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recent Paths */}
              {fieldPathHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    <History className="h-3 w-3 inline mr-1" />
                    Recent Fields
                  </p>
                  <div className="space-y-1">
                    {fieldPathHistory.slice(-5).map(path => (
                      <Button
                        key={path}
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToField(path)}
                        className="w-full justify-start h-7 px-2 text-xs"
                      >
                        <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                        {path}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        
        {/* Right Panel - Enhanced Explanation */}
        <div className="flex-1 flex flex-col h-full">
          {/* Search Bar with Autocomplete */}
          <div className="p-4 pb-2 flex-shrink-0">
            <Popover open={autocompleteOpen} onOpenChange={setAutocompleteOpen}>
              <PopoverTrigger asChild>
                <form onSubmit={handleFieldPathSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter field path (e.g., metadata.labels, spec.containers)"
                      value={fieldPathInput}
                      onChange={(e) => {
                        setFieldPathInput(e.target.value);
                        // Generate suggestions based on input
                        if (e.target.value) {
                          const suggestions = [
                            'metadata',
                            'metadata.labels',
                            'metadata.annotations',
                            'metadata.name',
                            'metadata.namespace',
                            'spec',
                            'spec.containers',
                            'spec.volumes',
                            'spec.nodeSelector',
                            'status',
                            'status.conditions',
                            'status.phase'
                          ].filter(s => s.includes(e.target.value));
                          setFieldSuggestions(suggestions);
                        }
                      }}
                      onFocus={() => setAutocompleteOpen(true)}
                      className="pl-8 h-9 text-sm"
                    />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                  <Button type="submit" size="sm" disabled={loadingExplain}>
                    {loadingExplain ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Explain'}
                  </Button>
                </form>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search field paths..." />
                  <CommandList>
                    <CommandEmpty>No suggestions found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                      {fieldSuggestions.map(suggestion => (
                        <CommandItem
                          key={suggestion}
                          onSelect={() => {
                            setFieldPathInput(suggestion);
                            setAutocompleteOpen(false);
                            navigateToField(suggestion);
                          }}
                        >
                          <FileCode className="h-4 w-4 mr-2" />
                          {suggestion}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Quick Actions Bar */}
          <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
            {getQuickActions().map(action => (
              <TooltipProvider key={action.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyToClipboard(action.command)}
                    >
                      {action.icon}
                      <span className="ml-1">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-mono text-xs">{action.command}</p>
                    {action.description && (
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          
          <Separator className="mx-4" />
          
          {/* Explanation Output with Syntax Highlighting */}
          <div className="flex-1 min-h-0 flex flex-col p-4 pt-2">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h4 className="text-sm font-medium">
                kubectl explain {currentPath}
              </h4>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(`kubectl explain ${currentPath}`)}
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy kubectl command</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowSplitView(!showSplitView)}
                      >
                        <SplitSquareHorizontal className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle split view (⌘\)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            {loadingExplain ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : explanation ? (
              <div className="flex-1 min-h-0 relative">
                <ScrollArea className="absolute inset-0">
                  <div className="p-4 space-y-6">
                    {/* Parse and enhance kubectl explain output */}
                    {(() => {
                      const lines = explanation.explanation.split('\n');
                      const parsedData: any = {};
                      let currentSection = '';
                      let buffer: string[] = [];
                      
                      // Parse sections
                      lines.forEach(line => {
                        if (line.match(/^(KIND|VERSION|FIELD|DESCRIPTION|FIELDS):$/)) {
                          if (currentSection && buffer.length > 0) {
                            parsedData[currentSection] = buffer.join('\n').trim();
                          }
                          currentSection = line.replace(':', '');
                          buffer = [];
                        } else if (line.trim()) {
                          buffer.push(line);
                        }
                      });
                      
                      // Don't forget the last section
                      if (currentSection && buffer.length > 0) {
                        parsedData[currentSection] = buffer.join('\n').trim();
                      }
                      
                      return (
                        <>
                          {/* Header Section */}
                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {parsedData.KIND && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Package className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium text-primary">Resource Type</span>
                                  </div>
                                  <p className="text-lg font-semibold">{parsedData.KIND}</p>
                                </div>
                              )}
                              
                              {parsedData.VERSION && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium text-primary">API Version</span>
                                  </div>
                                  <Badge variant="outline" className="font-mono">{parsedData.VERSION}</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Description Section */}
                          {parsedData.DESCRIPTION && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 mb-4">
                                <FileText className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold">Description</h3>
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                  {parsedData.DESCRIPTION}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Fields Section - Intuitive Table Design */}
                          {parsedData.FIELDS && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold">Fields</h4>
                                <div className="text-sm text-muted-foreground">
                                  Click any field to explore its structure
                                </div>
                              </div>
                              
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-1/4">Field Name</TableHead>
                                      <TableHead className="w-1/6">Type</TableHead>
                                      <TableHead className="w-1/12">Required</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parsedData.FIELDS.split('\n')
                                      .filter((line: string) => line.trim())
                                      .map((line: string, idx: number) => {
                                        const fieldMatch = line.match(/^\s*([\w.-]+)\s+<([^>]+)>\s*(.*)$/);
                                        
                                        if (fieldMatch) {
                                          const [, fieldName, fieldType, description] = fieldMatch;
                                          const isRequired = description.toLowerCase().includes('required');
                                          const isDeprecated = description.toLowerCase().includes('deprecated');
                                          const isReadOnly = description.toLowerCase().includes('read-only');
                                          
                                          return (
                                            <TableRow 
                                              key={idx} 
                                              className="cursor-pointer hover:bg-accent/50 group"
                                              onClick={() => navigateToField(fieldName)}
                                            >
                                              <TableCell>
                                                <div className="flex items-center gap-2">
                                                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                                    {fieldName}
                                                  </code>
                                                  {isDeprecated && (
                                                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                                                      Deprecated
                                                    </Badge>
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <Badge variant="secondary" className="text-xs">
                                                  {fieldType}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                {isRequired ? (
                                                  <Badge variant="destructive" className="text-xs">
                                                    Yes
                                                  </Badge>
                                                ) : isReadOnly ? (
                                                  <Badge variant="outline" className="text-xs">
                                                    Read-only
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground text-sm">No</span>
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">
                                                  {description.trim()}
                                                </p>
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      copyToClipboard(fieldName);
                                                    }}
                                                  >
                                                    <Copy className="h-3 w-3" />
                                                  </Button>
                                                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        }
                                        
                                        return null;
                                      })
                                      .filter(Boolean)}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                          
                          {/* Actions Bar */}
                          <div className="flex items-center gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(explanation.explanation)}
                              className="flex items-center gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              Copy All
                            </Button>
                            
                            <details className="group">
                              <summary className="cursor-pointer">
                                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                                  <Terminal className="h-4 w-4" />
                                  Raw Output
                                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                                </Button>
                              </summary>
                              <div className="mt-4 bg-slate-950 text-green-400 p-4 rounded-lg border">
                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                  {explanation.explanation}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-muted-foreground text-center">
                  <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  Select a field from the explorer to view its documentation
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Split View Panel */}
        {showSplitView && (
          <div className="w-96 border-l flex flex-col h-full">
            <div className="p-3 border-b flex items-center justify-between">
              <h4 className="text-sm font-medium">Field Details</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowSplitView(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {selectedFieldNode ? (
                <div className="p-4 space-y-4">
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">Field Path</h5>
                    <p className="font-mono text-sm">{selectedFieldNode.path}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">Type</h5>
                    <div className="flex items-center gap-2">
                      <div className={getFieldTypeColor(selectedFieldNode.type)}>
                        {getFieldTypeIcon(selectedFieldNode.type)}
                      </div>
                      <span className="text-sm">{selectedFieldNode.type}</span>
                    </div>
                  </div>
                  {selectedFieldNode.description && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Description</h5>
                      <p className="text-sm">{selectedFieldNode.description}</p>
                    </div>
                  )}
                  {selectedFieldNode.required && (
                    <div>
                      <Badge variant="destructive">Required Field</Badge>
                    </div>
                  )}
                  {selectedFieldNode.deprecated && (
                    <div>
                      <Badge variant="secondary">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Deprecated
                      </Badge>
                    </div>
                  )}
                  {selectedFieldNode.default !== undefined && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Default Value</h5>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {JSON.stringify(selectedFieldNode.default)}
                      </code>
                    </div>
                  )}
                  {selectedFieldNode.validation && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Validation</h5>
                      <div className="space-y-1 text-sm">
                        {selectedFieldNode.validation.pattern && (
                          <div>Pattern: <code className="bg-muted px-1 rounded">{selectedFieldNode.validation.pattern}</code></div>
                        )}
                        {selectedFieldNode.validation.min !== undefined && (
                          <div>Min: {selectedFieldNode.validation.min}</div>
                        )}
                        {selectedFieldNode.validation.max !== undefined && (
                          <div>Max: {selectedFieldNode.validation.max}</div>
                        )}
                        {selectedFieldNode.validation.enum && (
                          <div>
                            Allowed values:
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedFieldNode.validation.enum.map(v => (
                                <Badge key={v} variant="outline" className="text-xs">
                                  {v}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Select a field to view details
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  const renderOverview = () => {
    if (!selectedNode || selectedNode.type !== 'resource') return null;
    
    const resource = selectedNode.data as APIResource;
    
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold">{resource.kind}</h3>
            <Badge variant="secondary">{resource.group || 'core'}/{resource.version}</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(resource.name)}
                  >
                    {copiedField === resource.name ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy resource name</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Properties</h4>
              <div className="flex flex-wrap gap-2">
                {resource.namespaced && (
                  <Badge variant="outline">
                    <Database className="h-3 w-3 mr-1" />
                    Namespaced
                  </Badge>
                )}
                {resource.shortNames?.length > 0 && (
                  <Badge variant="outline">
                    Short: {resource.shortNames.join(', ')}
                  </Badge>
                )}
                {resource.categories?.length > 0 && (
                  <Badge variant="outline">
                    Categories: {resource.categories.join(', ')}
                  </Badge>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Supported Verbs</h4>
              <div className="flex flex-wrap gap-2">
                {resource.verbs?.map(verb => (
                  <Badge
                    key={verb}
                    variant={getVerbVariant(verb)}
                    className={cn(getVerbColor(verb))}
                  >
                    {verb}
                  </Badge>
                ))}
              </div>
            </div>
            
            {schema?.description && (
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{schema.description}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {getQuickActions().map(action => (
                  <TooltipProvider key={action.label}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          className="justify-start"
                          onClick={() => copyToClipboard(action.command)}
                        >
                          {action.icon}
                          <span className="ml-2">{action.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono text-xs">{action.command}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSchema = () => {
    if (!schema) return null;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Resource Schema</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={exportDocumentation}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Schema
          </Button>
        </div>
        <div className="space-y-2">
          {Object.entries(schema.properties || {}).map(([key, value]) => {
            const fieldType = (value as any).type || 'object';
            const fieldDescription = (value as any).description;
            const isRequired = schema.required?.includes(key);
            
            return (
              <Collapsible key={key}>
                <CollapsibleTrigger className="w-full">
                  <div className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={getFieldTypeColor(fieldType)}>
                          {getFieldTypeIcon(fieldType)}
                        </div>
                        <span className="font-medium text-sm">{key}</span>
                        {isRequired && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            Required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {fieldType}
                        </Badge>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3">
                    {fieldDescription && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {fieldDescription}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setFieldPathInput(key);
                        setActiveTab('explain');
                        navigateToField(key);
                      }}
                    >
                      <Info className="h-3 w-3 mr-1" />
                      Explore Field
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    );
  };

  const renderExample = () => {
    if (!schema?.example) return null;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Example YAML</h4>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(schema.example)}
                  >
                    {copiedField === 'example' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2">Copy</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy example YAML</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([schema.example], { type: 'text/yaml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedNode?.data?.name || 'resource'}-example.yaml`;
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download example YAML</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="relative">
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-xs" style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>
              {schema.example.split('\n').map((line, idx) => {
                // Basic YAML syntax highlighting
                const isComment = line.trim().startsWith('#');
                const isKey = line.match(/^\s*[\w-]+:/);
                const isArrayItem = line.trim().startsWith('-');
                
                return (
                  <div key={idx} className={cn(
                    isComment && "text-gray-500 dark:text-gray-400 italic",
                    isKey && "text-blue-600 dark:text-blue-400",
                    isArrayItem && "text-green-600 dark:text-green-400"
                  )}>
                    {line || ' '}
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schema" disabled={!schema}>Schema</TabsTrigger>
          <TabsTrigger value="example" disabled={!schema}>Example</TabsTrigger>
          <TabsTrigger value="explain" disabled={!explanation}>Explain</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden">
            <TabsContent value="overview" className="h-full overflow-auto p-4">
              {renderOverview()}
            </TabsContent>
            
            <TabsContent value="schema" className="h-full overflow-auto p-4">
              {renderSchema()}
            </TabsContent>
            
            <TabsContent value="example" className="h-full overflow-auto p-4">
              {renderExample()}
            </TabsContent>
            
            <TabsContent value="explain" className="h-full">
              {renderExplain()}
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}