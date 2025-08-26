import { useState, useRef } from 'react'
import { TabsContent } from '@/components/ui/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { YamlOutline } from '@/components/yaml-outline'
import type { editor } from 'monaco-editor'
import type { ManifestTab } from '../types'
import { ManifestEditor } from './ManifestEditor'

interface TabContentProps {
  tab: ManifestTab
  showOutline?: boolean
}

export function TabContent({ tab, showOutline = false }: TabContentProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleOutlineItemClick = (line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(line)
      editorRef.current.setPosition({ lineNumber: line, column: 1 })
      editorRef.current.focus()
    }
  }

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
  }

  if (tab.loading) {
    return (
      <TabsContent value={tab.id} className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading manifest...</p>
        </div>
      </TabsContent>
    )
  }

  return (
    <TabsContent value={tab.id} className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-[400px]">
          {showOutline && (
            <>
              <ResizablePanel id="yaml-outline" order={1} defaultSize={20} minSize={15} maxSize={30}>
                <YamlOutline
                  content={tab.content}
                  onNavigate={handleOutlineItemClick}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel id="manifest-editor" order={2} defaultSize={showOutline ? 80 : 100} className="min-h-0">
            <div className="h-full w-full">
              <ManifestEditor
                content={tab.content}
                onEditorMount={handleEditorMount}
                className="h-full"
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TabsContent>
  )
}