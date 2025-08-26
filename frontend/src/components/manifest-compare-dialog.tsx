import { useState, useEffect, useRef } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/components/theme-provider'
import { 
  GitCompare, 
  Copy, 
  SplitSquareVertical,
  FileEdit,
  Check
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface ManifestCompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leftContent?: string
  leftTitle?: string
  rightContent?: string
  rightTitle?: string
  onCompare?: (left: string, right: string) => void
}

export function ManifestCompareDialog({
  open,
  onOpenChange,
  leftContent = '',
  leftTitle = 'Original',
  rightContent = '',
  rightTitle = 'Modified',
  onCompare
}: ManifestCompareDialogProps) {
  const { theme } = useTheme()
  const [leftYaml, setLeftYaml] = useState(leftContent)
  const [rightYaml, setRightYaml] = useState(rightContent)
  const [compareMode, setCompareMode] = useState<'paste' | 'diff'>('diff')
  const [copiedSide, setCopiedSide] = useState<'left' | 'right' | null>(null)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    setLeftYaml(leftContent)
  }, [leftContent])

  useEffect(() => {
    setRightYaml(rightContent)
  }, [rightContent])

  // Cleanup diff editor when dialog closes
  useEffect(() => {
    if (!open && diffEditorRef.current) {
      try {
        diffEditorRef.current.dispose()
        diffEditorRef.current = null
      } catch (error) {
        console.warn('Error disposing diff editor:', error)
      }
    }
  }, [open])

  const handleDiffEditorMount = (editor: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = editor
  }

  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  const handleCompare = () => {
    if (onCompare) {
      onCompare(leftYaml, rightYaml)
    }
    setCompareMode('diff')
  }

  const copyToClipboard = (content: string, side: 'left' | 'right') => {
    navigator.clipboard.writeText(content)
    setCopiedSide(side)
    setTimeout(() => setCopiedSide(null), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-full sm:max-w-full p-0 flex flex-col"
      >
        {/* Compact Header */}
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Manifests
          </SheetTitle>
          <SheetDescription>
            Compare YAML manifests side by side to identify differences
          </SheetDescription>
        </SheetHeader>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as 'paste' | 'diff')} className="flex-1 flex flex-col">
            {/* Compact Tab List */}
            <div className="px-4 py-2 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <TabsList className="h-8">
                  <TabsTrigger value="diff" className="h-7 text-xs px-3 flex items-center gap-1.5">
                    <SplitSquareVertical className="h-3.5 w-3.5" />
                    Diff View
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="h-7 text-xs px-3 flex items-center gap-1.5">
                    <FileEdit className="h-3.5 w-3.5" />
                    Paste & Compare
                  </TabsTrigger>
                </TabsList>
                
                {/* Info badges */}
                <div className="flex items-center gap-2">
                  {compareMode === 'diff' && (
                    <>
                      <Badge variant="outline" className="h-6 px-2 text-xs">
                        <span className="text-muted-foreground mr-1">Left:</span>
                        {leftTitle}
                      </Badge>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <Badge variant="outline" className="h-6 px-2 text-xs">
                        <span className="text-muted-foreground mr-1">Right:</span>
                        {rightTitle}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Diff View Tab */}
            <TabsContent value="diff" className="flex-1 m-0 flex flex-col">
              {/* Minimal Toolbar */}
              <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500/20 border border-red-500/50 rounded-sm" />
                    <span>Removed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500/20 border border-green-500/50 rounded-sm" />
                    <span>Added</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/50 rounded-sm" />
                    <span>Modified</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(leftYaml, 'left')}
                  >
                    {copiedSide === 'left' ? (
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Copy Left
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(rightYaml, 'right')}
                  >
                    {copiedSide === 'right' ? (
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Copy Right
                  </Button>
                </div>
              </div>
              
              {/* Maximized Diff Editor */}
              <div className="flex-1 min-h-0">
                <DiffEditor
                  height="100%"
                  language="yaml"
                  theme={getMonacoTheme()}
                  original={leftYaml}
                  modified={rightYaml}
                  onMount={handleDiffEditorMount}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    diffWordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'none',
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                    },
                  }}
                />
              </div>
            </TabsContent>

            {/* Paste View Tab */}
            <TabsContent value="paste" className="flex-1 m-0 flex flex-col p-4">
              <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                <div className="flex flex-col">
                  <Label className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span>Left YAML (Original)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setLeftYaml('')}
                    >
                      Clear
                    </Button>
                  </Label>
                  <Textarea
                    value={leftYaml}
                    onChange={(e) => setLeftYaml(e.target.value)}
                    placeholder="Paste or type YAML content here..."
                    className="flex-1 font-mono text-sm resize-none"
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span>Right YAML (Modified)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setRightYaml('')}
                    >
                      Clear
                    </Button>
                  </Label>
                  <Textarea
                    value={rightYaml}
                    onChange={(e) => setRightYaml(e.target.value)}
                    placeholder="Paste or type YAML content here..."
                    className="flex-1 font-mono text-sm resize-none"
                  />
                </div>
              </div>
              
              {/* Compare Button */}
              <div className="pt-4 flex justify-center">
                <Button 
                  onClick={handleCompare} 
                  disabled={!leftYaml || !rightYaml}
                  className="w-32"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}