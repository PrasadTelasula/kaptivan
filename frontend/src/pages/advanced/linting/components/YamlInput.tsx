import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, Copy, Trash2, FileUp, Loader2, FileText } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useTheme } from '@/components/theme-provider'
import { useState, useRef } from 'react'

interface YamlInputProps {
  value: string
  onChange: (value: string) => void
  onLint: () => void
  isLinting: boolean
}

export function YamlInput({ value, onChange, onLint, isLinting }: YamlInputProps) {
  const { theme } = useTheme()
  const [showEditor, setShowEditor] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        onChange(content)
      }
      reader.readAsText(file)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleClear = () => {
    onChange('')
  }

  const sampleYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>YAML Content</CardTitle>
              <CardDescription>
                Paste your Kubernetes manifest or upload a YAML file
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditor(!showEditor)}
              >
                {showEditor ? 'Simple Input' : 'Code Editor'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Upload YAML file"
              >
                <FileUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!value}
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleClear}
                disabled={!value}
                title="Clear content"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {showEditor ? (
            <div className="flex-1 border rounded-md overflow-hidden">
              <Editor
                height="100%"
                language="yaml"
                theme={getMonacoTheme()}
                value={value}
                onChange={(val) => onChange(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  folding: true,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </div>
          ) : (
            <Textarea
              placeholder="Paste your YAML content here..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 font-mono text-sm resize-none"
            />
          )}
          
          {!value && (
            <Alert className="mt-4">
              <AlertDescription>
                <div className="space-y-2">
                  <p>Need a sample? Try this:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChange(sampleYaml)}
                  >
                    Load Sample Deployment
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onLint}
          disabled={!value || isLinting}
          size="sm"
        >
          {isLinting ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Linting...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-3 w-3" />
              Run Linter
            </>
          )}
        </Button>
      </div>
    </div>
  )
}