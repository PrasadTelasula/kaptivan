import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Code, FileJson, FileText, Info, Loader2, ChevronRight, Home, Search, ChevronDown, FolderOpen, Folder, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode, ResourceSchema, ExplainOutput, APIResource } from '../types';
import { apiDocsService } from '../services/api-docs.service';

interface APIDocumentationPanelProps {
  context: string;
  selectedNode: TreeNode | null;
}

export default function APIDocumentationPanel({ context, selectedNode }: APIDocumentationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<ResourceSchema | null>(null);
  const [explanation, setExplanation] = useState<ExplainOutput | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // New state for field path browsing
  const [fieldPath, setFieldPath] = useState<string>('');
  const [fieldPathInput, setFieldPathInput] = useState<string>('');
  const [fieldPathHistory, setFieldPathHistory] = useState<string[]>([]);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldTree, setFieldTree] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (selectedNode && selectedNode.type === 'resource') {
      fetchResourceDetails();
    }
  }, [selectedNode, context]);

  // Reset field path when selecting a new resource
  useEffect(() => {
    setFieldPath('');
    setFieldPathInput('');
    setFieldPathHistory([]);
    setExpandedFields(new Set());
    setFieldTree({});
  }, [selectedNode]);

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
    } catch (error) {
      console.error('Failed to fetch resource details:', error);
    } finally {
      setLoading(false);
    }
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
      
      // Store fields in tree structure
      const fields = extractFieldsFromExplanation(explainData.explanation);
      setFieldTree(prev => ({
        ...prev,
        [path || 'root']: fields
      }));
      
      // Add to history if not already present
      if (path && !fieldPathHistory.includes(path)) {
        setFieldPathHistory([...fieldPathHistory, path]);
      }
    } catch (error) {
      console.error('Failed to fetch field explanation:', error);
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleFieldPathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldPathInput.trim()) return;
    await fetchFieldExplanation(fieldPathInput);
  };

  const navigateToField = async (path: string) => {
    setFieldPathInput(path);
    await fetchFieldExplanation(path);
  };

  const extractFieldsFromExplanation = (text: string): string[] => {
    const fields: string[] = [];
    const lines = text.split('\n');
    let inFieldsSection = false;
    
    for (const line of lines) {
      if (line.startsWith('FIELDS:')) {
        inFieldsSection = true;
        continue;
      }
      
      if (inFieldsSection && line.trim()) {
        // Match field definitions like "metadata   <Object>" or "spec <Object>"
        const match = line.match(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s+</);
        if (match) {
          fields.push(match[1]);
        }
      }
    }
    
    return fields;
  };

  const renderOverview = () => {
    if (!selectedNode || selectedNode.type !== 'resource') {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Select a resource to view documentation
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Browse the API tree on the left to explore resources
            </p>
          </div>
        </div>
      );
    }
    
    const resource = selectedNode.data as APIResource;
    
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">{resource.kind}</h3>
          <p className="text-sm text-muted-foreground">
            {resource.group ? `${resource.group}/${resource.version}` : resource.version}
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Properties</h4>
            <div className="flex flex-wrap gap-2">
              {resource.namespaced && (
                <Badge variant="secondary">Namespaced</Badge>
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
        </div>
      </div>
    );
  };

  const renderSchema = () => {
    if (!schema) return null;
    
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Resource Schema</h4>
          <div className="space-y-2">
            {Object.entries(schema.properties || {}).map(([key, value]) => (
              <div key={key} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{key}</span>
                  <Badge variant="outline" className="text-xs">
                    {(value as any).type || 'object'}
                  </Badge>
                </div>
                {(value as any).description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(value as any).description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderExample = () => {
    if (!schema?.example) return null;
    
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Example YAML</h4>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-xs" style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>{schema.example}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderFieldTree = (fields: string[], parentPath: string = '', depth: number = 0) => {
    return fields.map(field => {
      const currentPath = parentPath ? `${parentPath}.${field}` : field;
      const hasChildren = fieldTree[currentPath] && fieldTree[currentPath].length > 0;
      const isExpanded = expandedFields.has(currentPath);
      const isActive = fieldPath === currentPath;
      
      return (
        <div key={currentPath} style={{ marginLeft: `${depth * 12}px` }}>
          <div
            className={cn(
              "flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-accent/50 transition-colors",
              isActive && "bg-accent font-medium"
            )}
            onClick={() => {
              setFieldPathInput(currentPath);
              navigateToField(currentPath);
              if (hasChildren) {
                const newExpanded = new Set(expandedFields);
                if (isExpanded) {
                  newExpanded.delete(currentPath);
                } else {
                  newExpanded.add(currentPath);
                }
                setExpandedFields(newExpanded);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : (
              <div className="w-3" />
            )}
            {hasChildren ? (
              isExpanded ? <FolderOpen className="h-3 w-3 text-blue-500" /> : <Folder className="h-3 w-3 text-blue-500" />
            ) : (
              <FileCode className="h-3 w-3 text-green-500" />
            )}
            <span className="text-sm">{field}</span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground ml-auto">({fieldTree[currentPath].length})</span>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div className="border-l ml-2">
              {renderFieldTree(fieldTree[currentPath], currentPath, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderExplain = () => {
    if (!selectedNode || selectedNode.type !== 'resource') return null;
    
    const resource = selectedNode.data as APIResource;
    const currentPath = fieldPath ? `${resource.name}.${fieldPath}` : resource.name;
    const availableFields = explanation ? extractFieldsFromExplanation(explanation.explanation) : [];
    
    return (
      <div className="h-full flex">
        {/* Left Panel - Field Tree Navigation */}
        <div className="w-80 border-r flex flex-col h-full">
          <div className="p-3 border-b flex-shrink-0">
            <h4 className="text-sm font-medium mb-2">Field Explorer</h4>
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
          </div>
          
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="absolute inset-0 p-2">
            {/* Field Tree */}
            <div className="space-y-1">
              {availableFields.length > 0 ? (
                renderFieldTree(availableFields, fieldPath)
              ) : (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  Loading fields...
                </div>
              )}
            </div>
            
            {/* Recent Paths */}
            {fieldPathHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-medium mb-2">Recent:</p>
                <div className="space-y-1">
                  {fieldPathHistory.slice(-5).map(path => (
                    <Button
                      key={path}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFieldPathInput(path);
                        navigateToField(path);
                      }}
                      className="w-full justify-start h-7 px-2 text-xs"
                    >
                      <FileCode className="h-3 w-3 mr-2 text-muted-foreground" />
                      {path}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            </ScrollArea>
          </div>
        </div>
        
        {/* Right Panel - Explanation */}
        <div className="flex-1 flex flex-col h-full">
          {/* Search Bar */}
          <div className="p-4 pb-2 flex-shrink-0">
            <form onSubmit={handleFieldPathSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter field path (e.g., metadata.labels, spec.containers)"
                  value={fieldPathInput}
                  onChange={(e) => setFieldPathInput(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button type="submit" size="sm" disabled={loadingExplain}>
                {loadingExplain ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Explain'}
              </Button>
            </form>
          </div>
          
          <Separator className="mx-4" />
          
          {/* Explanation Output */}
          <div className="flex-1 min-h-0 flex flex-col p-4 pt-2">
            <h4 className="text-sm font-medium mb-2 flex-shrink-0">
              kubectl explain {currentPath}
            </h4>
            {loadingExplain ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : explanation ? (
              <div className="flex-1 min-h-0 relative">
                <ScrollArea className="absolute inset-0">
                  <pre className="bg-muted p-4 rounded-lg">
                    <code className="text-xs whitespace-pre-wrap break-words" style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>
                      {explanation.explanation}
                    </code>
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-muted-foreground text-center">
                  Select a field from the explorer to view its documentation
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          API Documentation
        </CardTitle>
        <CardDescription>
          Explore Kubernetes API resources and their schemas
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="schema" disabled={!schema} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Schema</TabsTrigger>
            <TabsTrigger value="example" disabled={!schema} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Example</TabsTrigger>
            <TabsTrigger value="explain" disabled={!explanation} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Explain</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="overview" className="mt-0">
              {renderOverview()}
            </TabsContent>
            
            <TabsContent value="schema" className="mt-0">
              {renderSchema()}
            </TabsContent>
            
            <TabsContent value="example" className="mt-0">
              {renderExample()}
            </TabsContent>
            
            <TabsContent value="explain" className="mt-0">
              {renderExplain()}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}