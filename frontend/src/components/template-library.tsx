import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Save,
  Download,
  Trash2,
  Plus,
  Search,
  Edit,
  Copy,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import Editor from '@monaco-editor/react'
import { useTheme } from '@/components/theme-provider'

interface Template {
  id: string
  name: string
  description: string
  kind: string
  apiVersion: string
  namespace?: string
  content: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface TemplateLibraryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyTemplate?: (template: Template) => void
  currentResource?: {
    content: string
    kind: string
    apiVersion: string
    name: string
    namespace?: string
  }
}

export function TemplateLibrary({
  open,
  onOpenChange,
  onApplyTemplate,
  currentResource,
}: TemplateLibraryProps) {
  const { theme } = useTheme()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKind, setFilterKind] = useState<string>('all')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    tags: '',
  })

  // Load templates from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('k8s-templates')
    if (stored) {
      setTemplates(JSON.parse(stored))
    }
  }, [])

  // Save templates to localStorage
  const saveTemplates = (updatedTemplates: Template[]) => {
    localStorage.setItem('k8s-templates', JSON.stringify(updatedTemplates))
    setTemplates(updatedTemplates)
  }

  // Save current resource as template
  const saveAsTemplate = () => {
    if (!currentResource || !newTemplate.name) return

    const template: Template = {
      id: Date.now().toString(),
      name: newTemplate.name,
      description: newTemplate.description,
      kind: currentResource.kind,
      apiVersion: currentResource.apiVersion,
      namespace: currentResource.namespace,
      content: currentResource.content,
      tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    saveTemplates([...templates, template])
    setShowSaveDialog(false)
    setNewTemplate({ name: '', description: '', tags: '' })
  }

  // Delete template
  const deleteTemplate = (id: string) => {
    saveTemplates(templates.filter(t => t.id !== id))
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null)
    }
  }

  // Export template
  const exportTemplate = (template: Template) => {
    const blob = new Blob([template.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name.replace(/\s+/g, '-')}.yaml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesKind = filterKind === 'all' || template.kind === filterKind
    
    return matchesSearch && matchesKind
  })

  // Get unique kinds for filter
  const uniqueKinds = Array.from(new Set(templates.map(t => t.kind)))

  const getMonacoTheme = () => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isDark ? 'vs-dark' : 'vs'
    }
    return theme === 'dark' ? 'vs-dark' : 'vs'
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Library</DialogTitle>
            <DialogDescription>
              Save and reuse Kubernetes resource templates
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Template List */}
            <div className="w-1/3 flex flex-col gap-3">
              {/* Actions */}
              {currentResource && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Current as Template
                </Button>
              )}

              {/* Search and Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={filterKind} onValueChange={setFilterKind}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filter by kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Kinds</SelectItem>
                    {uniqueKinds.map(kind => (
                      <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template List */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      {templates.length === 0 
                        ? "No templates saved yet" 
                        : "No templates match your search"}
                    </div>
                  ) : (
                    filteredTemplates.map(template => (
                      <div
                        key={template.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedTemplate?.id === template.id 
                            ? "bg-accent border-accent-foreground/20" 
                            : "hover:bg-accent/50"
                        )}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium text-sm">{template.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {template.kind}
                          </Badge>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {template.description}
                          </p>
                        )}
                        {template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Template Preview */}
            <div className="flex-1 flex flex-col">
              {selectedTemplate ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{selectedTemplate.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.kind}/{selectedTemplate.apiVersion}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {onApplyTemplate && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onApplyTemplate(selectedTemplate)
                            onOpenChange(false)
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Apply Template
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportTemplate(selectedTemplate)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplate(selectedTemplate.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <Editor
                      height="100%"
                      language="yaml"
                      theme={getMonacoTheme()}
                      value={selectedTemplate.content}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a template to preview
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current resource as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g., Production Deployment"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Describe what this template is for..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="template-tags">Tags (comma-separated)</Label>
              <Input
                id="template-tags"
                value={newTemplate.tags}
                onChange={(e) => setNewTemplate({ ...newTemplate, tags: e.target.value })}
                placeholder="e.g., production, nginx, web"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} disabled={!newTemplate.name}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}