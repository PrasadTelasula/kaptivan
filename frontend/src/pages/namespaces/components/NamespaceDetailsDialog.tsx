import { useState, useEffect } from "react"
import { Copy, Check, Code2, Tags, FileText, Info, Calendar, Server, Layers, Hash } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Editor from '@monaco-editor/react'
import type { Namespace } from "../types"
import { namespacesApi } from "../services/api"
import { cn } from "@/lib/utils"

interface NamespaceDetailsDialogProps {
  namespace: Namespace | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NamespaceDetailsDialog({ 
  namespace, 
  open, 
  onOpenChange 
}: NamespaceDetailsDialogProps) {
  const [yamlContent, setYamlContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("labels")

  useEffect(() => {
    if (open && namespace) {
      fetchNamespaceYaml()
      setActiveTab("labels")
      setCopied(false)
    }
  }, [open, namespace])

  const fetchNamespaceYaml = async () => {
    if (!namespace) return
    
    setIsLoading(true)
    try {
      const yaml = await namespacesApi.getNamespaceYaml(namespace.clusterId, namespace.name)
      setYamlContent(yaml)
    } catch (error) {
      console.error("Failed to fetch namespace YAML:", error)
      setYamlContent("Failed to load YAML content")
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  if (!namespace) return null

  const labelsArray = Object.entries(namespace.labels || {})
  const annotationsArray = Object.entries(namespace.annotations || {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-muted/30 border-b">
          <div className="space-y-3">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {namespace.name}
                  <Badge variant="secondary" className="font-normal">
                    {namespace.cluster}
                  </Badge>
                </div>
                <div className="text-sm font-normal text-muted-foreground mt-1">
                  Namespace Configuration & Metadata
                </div>
              </div>
            </DialogTitle>
            
            {/* Metadata Row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground pl-12">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Created {namespace.createdAt.toLocaleDateString()}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  namespace.status === "Active" ? "bg-green-500" : "bg-yellow-500"
                )} />
                <span>{namespace.status}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                <span>{labelsArray.length + annotationsArray.length} metadata items</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b">
              <TabsList className="h-12 w-auto inline-flex rounded-none bg-transparent p-0">
                <TabsTrigger 
                  value="labels" 
                  className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6"
                >
                  <Tags className="h-4 w-4 mr-2" />
                  Labels
                  {labelsArray.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {labelsArray.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="annotations" 
                  className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Annotations
                  {annotationsArray.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {annotationsArray.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="yaml" 
                  className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6"
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  YAML
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Labels Tab */}
            <TabsContent value="labels" className="flex-1 p-6 mt-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Label Configuration</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Key-value pairs for organizing and selecting resources
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(namespace.labels, null, 2))}
                    disabled={labelsArray.length === 0}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>

                <Card className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[420px]">
                    {labelsArray.length > 0 ? (
                      <div className="p-4 space-y-2">
                        {labelsArray.map(([key, value]) => (
                          <div
                            key={key}
                            className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all"
                          >
                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                              <Hash className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <code className="text-sm font-medium">{key}</code>
                                <span className="text-muted-foreground">=</span>
                                <code className="text-sm text-muted-foreground">{value}</code>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(`${key}=${value}`)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <Tags className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">No labels defined</p>
                        <p className="text-xs mt-1">Labels will appear here when configured</p>
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              </div>
            </TabsContent>

            {/* Annotations Tab */}
            <TabsContent value="annotations" className="flex-1 p-6 mt-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Annotation Metadata</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Non-identifying metadata attached to the namespace
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(namespace.annotations, null, 2))}
                    disabled={annotationsArray.length === 0}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>

                <Card className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[420px]">
                    {annotationsArray.length > 0 ? (
                      <div className="p-4 space-y-3">
                        {annotationsArray.map(([key, value]) => (
                          <div
                            key={key}
                            className="group p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <code className="text-sm font-medium text-foreground/90 block">
                                  {key}
                                </code>
                                <div className="bg-muted/50 rounded px-3 py-2">
                                  <code className="text-xs text-muted-foreground break-all block">
                                    {value}
                                  </code>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={() => copyToClipboard(value)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">No annotations defined</p>
                        <p className="text-xs mt-1">Annotations will appear here when configured</p>
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              </div>
            </TabsContent>

            {/* YAML Tab */}
            <TabsContent value="yaml" className="flex-1 p-6 mt-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">YAML Manifest</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete namespace configuration in YAML format
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(yamlContent)}
                    disabled={isLoading || !yamlContent}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy YAML
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex-1 overflow-hidden rounded-md">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-[420px]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm text-gray-400">Loading YAML...</p>
                      </div>
                    </div>
                  ) : (
                    <Editor
                      height="420px"
                      width="100%"
                      language="yaml"
                      value={yamlContent || "# No YAML content available"}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        domReadOnly: true,
                        contextmenu: false,
                        minimap: {
                          enabled: false
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
                        wordWrap: 'off',
                        fontSize: 13,
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
                        autoIndent: 'none',
                        scrollBeyondLastLine: false,
                        automaticLayout: true
                      }}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      }
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}