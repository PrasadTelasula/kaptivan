import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { X, Maximize2, Minimize2, FileText, Minus, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { apiUrls } from '@/utils/api-urls';
import { useTheme } from '@/components/theme-provider';

interface YamlWindowProps {
  resourceName: string;
  resourceType: string;
  namespace: string;
  context: string;
  onClose: () => void;
}

export const YamlWindow: React.FC<YamlWindowProps> = ({
  resourceName,
  resourceType,
  namespace,
  context,
  onClose
}) => {
  const { theme } = useTheme();
  const [yamlContent, setYamlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDecoded, setShowDecoded] = useState(false);
  const [decodedYaml, setDecodedYaml] = useState<string>('');
  const [fontSize, setFontSize] = useState(13);
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  
  // Determine the effective theme (resolve 'system' to actual theme)
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  
  const effectiveTheme = getEffectiveTheme();
  const monacoTheme = effectiveTheme === 'dark' ? 'vs-dark' : 'vs';
  
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({ 
    x: window.innerWidth / 2 - 400, 
    y: window.innerHeight / 2 - 300 
  });

  useEffect(() => {
    fetchYaml();
  }, [resourceName, resourceType, namespace, context]);

  const fetchYaml = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Map lowercase resource types to proper Kubernetes kinds
      const kindMapping: Record<string, { kind: string; apiVersion: string }> = {
        'deployment': { kind: 'Deployment', apiVersion: 'apps/v1' },
        'daemonset': { kind: 'DaemonSet', apiVersion: 'apps/v1' },
        'job': { kind: 'Job', apiVersion: 'batch/v1' },
        'cronjob': { kind: 'CronJob', apiVersion: 'batch/v1' },
        'service': { kind: 'Service', apiVersion: 'v1' },
        'pod': { kind: 'Pod', apiVersion: 'v1' },
        'replicaset': { kind: 'ReplicaSet', apiVersion: 'apps/v1' },
        'configmap': { kind: 'ConfigMap', apiVersion: 'v1' },
        'secret': { kind: 'Secret', apiVersion: 'v1' },
        'serviceaccount': { kind: 'ServiceAccount', apiVersion: 'v1' },
        'endpoints': { kind: 'Endpoints', apiVersion: 'v1' },
        'role': { kind: 'Role', apiVersion: 'rbac.authorization.k8s.io/v1' },
        'rolebinding': { kind: 'RoleBinding', apiVersion: 'rbac.authorization.k8s.io/v1' },
        'clusterrole': { kind: 'ClusterRole', apiVersion: 'rbac.authorization.k8s.io/v1' },
        'clusterrolebinding': { kind: 'ClusterRoleBinding', apiVersion: 'rbac.authorization.k8s.io/v1' }
      };

      const resourceMapping = kindMapping[resourceType.toLowerCase()] || 
        { kind: resourceType, apiVersion: 'v1' };

      // Use centralized API URL builder
      const endpoint = apiUrls.manifests.get(context, resourceName, {
        kind: resourceMapping.kind,
        apiVersion: resourceMapping.apiVersion,
        namespace: namespace
      });
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch YAML: ${response.statusText}`);
      }
      
      // Get the response as text (YAML)
      const yamlContent = await response.text();
      
      setYamlContent(yamlContent);
      
      // If it's a Secret, prepare decoded version
      if (resourceType === 'Secret') {
        prepareDecodedSecret(yamlContent);
      }
    } catch (err) {
      console.error('Error fetching YAML:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch YAML');
    } finally {
      setIsLoading(false);
    }
  };

  const prepareDecodedSecret = (yaml: string) => {
    try {
      // Parse YAML to find and decode base64 data
      const lines = yaml.split('\n');
      const decodedLines = lines.map(line => {
        // Look for lines with base64 encoded values in the data section
        if (line.includes(':') && !line.includes('apiVersion') && !line.includes('kind') && 
            !line.includes('metadata') && !line.includes('type') && !line.includes('namespace')) {
          const match = line.match(/^(\s*)([^:]+):\s*(.+)$/);
          if (match) {
            const [, indent, key, value] = match;
            try {
              // Try to decode the value
              const decoded = atob(value.trim());
              // Check if decoded value is printable
              if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
                return `${indent}${key}: ${decoded}`;
              }
            } catch {
              // If decoding fails, keep original
            }
          }
        }
        return line;
      });
      setDecodedYaml(decodedLines.join('\n'));
    } catch (err) {
      console.error('Error decoding secret:', err);
      setDecodedYaml(yaml);
    }
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 600 });
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
    } else {
      setSize({ width: window.innerWidth - 20, height: window.innerHeight - 20 });
      setPosition({ x: 10, y: 10 });
    }
    setIsMaximized(!isMaximized);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 24);
    setFontSize(newSize);
    if (editorInstance) {
      editorInstance.updateOptions({ fontSize: newSize });
    }
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 10);
    setFontSize(newSize);
    if (editorInstance) {
      editorInstance.updateOptions({ fontSize: newSize });
    }
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 left-4 bg-card border rounded-lg p-2 shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors"
        style={{ zIndex: 99999 }}
        onClick={toggleMinimize}
      >
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm text-card-foreground">YAML: {resourceName}</span>
      </div>
    );
  }

  const handleEditorDidMount: OnMount = (editor) => {
    // Store the editor instance
    setEditorInstance(editor);
    
    // Configure editor
    editor.updateOptions({
      readOnly: true,
      domReadOnly: true,
      contextmenu: false,
      minimap: {
        enabled: true,
        renderCharacters: false,
        maxColumn: 80,
        showSlider: 'always'
      },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      lineNumbers: 'on',
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      renderWhitespace: 'boundary',
      guides: {
        indentation: true,
        bracketPairs: true
      },
      bracketPairColorization: {
        enabled: true
      },
      stickyScroll: {
        enabled: true
      },
      wordWrap: 'off',
      fontSize: fontSize,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, monospace',
      renderLineHighlight: 'all',
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      occurrencesHighlight: 'multiFile',
      selectionHighlight: true,
      suggestOnTriggerCharacters: false,
      quickSuggestions: false,
      suggest: {
        showWords: false,
        showSnippets: false
      },
      hover: {
        enabled: true,
        delay: 300
      },
      links: true,
      colorDecorators: true,
      formatOnPaste: false,
      formatOnType: false,
      autoIndent: 'none'
    });
  };

  const displayContent = resourceType === 'Secret' && showDecoded ? decodedYaml : yamlContent;

  return (
    <Rnd
        size={{ width: size.width, height: size.height }}
        position={{ x: position.x, y: position.y }}
        onDragStop={(e, d) => {
          e?.stopPropagation?.();
          setPosition({ x: d.x, y: d.y });
        }}
        onDrag={(e) => {
          e?.stopPropagation?.();
        }}
        onMouseDown={(e: any) => {
          e?.stopPropagation?.();
        }}
        onResize={(e) => {
          e?.stopPropagation?.();
        }}
        onResizeStart={(e: any) => {
          e?.stopPropagation?.();
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          e?.stopPropagation?.();
          setSize({
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height)
          });
          setPosition(position);
        }}
        minWidth={400}
        minHeight={300}
        bounds="window"
        dragHandleClassName="yaml-window-header"
        className="fixed"
        style={{ zIndex: 99999, pointerEvents: 'all', isolation: 'isolate' }}
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        }}
        disableDragging={false}
      >
      <div
        className={cn(
          "h-full bg-card border rounded-lg shadow-2xl flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="yaml-window-header bg-muted border-b px-4 py-2 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {resourceType}: {resourceName}
            </span>
            {resourceType === 'Secret' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDecoded(!showDecoded);
                }}
                title={showDecoded ? "Show encoded" : "Show decoded"}
              >
                {showDecoded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Font size controls */}
            <div className="flex items-center gap-0.5 mr-2 border-r pr-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  decreaseFontSize();
                }}
                title="Decrease font size"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground min-w-[20px] text-center">{fontSize}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  increaseFontSize();
                }}
                title="Increase font size"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Window controls */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimize();
              }}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximize();
              }}
            >
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading YAML...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-destructive">
                <p className="text-sm">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={fetchYaml}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full w-full relative">
              <Editor
                height="100%"
                width="100%"
                language="yaml"
                value={displayContent || '# No content available'}
                onMount={handleEditorDidMount}
                theme={monacoTheme}
                loading={<div className="flex items-center justify-center h-full">Loading editor...</div>}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  contextmenu: false,
                  minimap: {
                    enabled: true,
                    renderCharacters: false
                  },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'all'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </Rnd>
  );
};