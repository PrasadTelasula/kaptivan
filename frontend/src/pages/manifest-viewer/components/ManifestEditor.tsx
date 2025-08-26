import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { cn } from '@/utils/cn'

interface ManifestEditorProps {
  content: string
  language?: string
  className?: string
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function ManifestEditor({
  content,
  language = 'yaml',
  className,
  onEditorMount
}: ManifestEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
    
    // Configure read-only editor
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
      autoIndent: 'none'
    })

    if (onEditorMount) {
      onEditorMount(editor)
    }
  }

  useEffect(() => {
    if (editorRef.current && content) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== content) {
        editorRef.current.setValue(content)
        // Reset position to top when content changes
        editorRef.current.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
        editorRef.current.setPosition({ lineNumber: 1, column: 1 })
      }
    }
  }, [content])

  return (
    <div className={cn("h-full w-full relative", className)}>
      {!content && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading manifest...</p>
          </div>
        </div>
      )}
      <Editor
        key={content ? content.substring(0, 50) : 'empty'}
        height="100%"
        width="100%"
        language={language}
        value={content || '# No content available'}
        onMount={handleEditorDidMount}
        theme="vs-dark"
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
  )
}