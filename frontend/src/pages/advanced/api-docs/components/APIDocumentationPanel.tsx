import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Code, FileJson, FileText, Info, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (selectedNode && selectedNode.type === 'resource') {
      loadResourceDocumentation();
    }
  }, [selectedNode, context]);

  const loadResourceDocumentation = async () => {
    if (!selectedNode || selectedNode.type !== 'resource') return;
    
    setLoading(true);
    try {
      const resource = selectedNode.data as APIResource;
      
      // Load schema
      const [schemaData, explainData] = await Promise.all([
        apiDocsService.getResourceSchema(context, resource.group, resource.version, resource.kind),
        apiDocsService.getResourceExplain(context, resource.name),
      ]);
      
      setSchema(schemaData);
      setExplanation(explainData);
    } catch (error) {
      console.error('Failed to load documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => {
    if (!selectedNode || selectedNode.type !== 'resource') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Info className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">Select a resource to view documentation</p>
          <p className="text-sm mt-2">Browse the API tree on the left to explore resources</p>
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
          <h4 className="text-sm font-medium mb-2">Properties</h4>
          <div className="space-y-2">
            {Object.entries(schema.properties || {}).map(([key, value]: [string, any]) => (
              <div key={key} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-medium">{key}</span>
                  <Badge variant="outline" className="text-xs">
                    {value.type || 'object'}
                  </Badge>
                </div>
                {value.description && (
                  <p className="text-xs text-muted-foreground mt-1">{value.description}</p>
                )}
                {schema.required?.includes(key) && (
                  <Badge variant="destructive" className="text-xs mt-2">Required</Badge>
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

  const renderExplain = () => {
    if (!explanation) return null;
    
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">kubectl explain output</h4>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-xs whitespace-pre" style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>{explanation.explanation}</code>
          </pre>
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          API Documentation
        </CardTitle>
        <CardDescription>
          Explore Kubernetes API resources and their schemas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="schema" disabled={!schema} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Schema</TabsTrigger>
            <TabsTrigger value="example" disabled={!schema} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Example</TabsTrigger>
            <TabsTrigger value="explain" disabled={!explanation} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Explain</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[calc(100vh-280px)] mt-4">
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