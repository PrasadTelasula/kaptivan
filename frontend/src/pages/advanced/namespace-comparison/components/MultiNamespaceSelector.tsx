import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, 
  ArrowRight, 
  Server, 
  Layers, 
  Sparkles, 
  Plus, 
  X,
  GitCompare,
  Copy,
  ChevronDown
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface NamespaceSelection {
  id: string
  cluster: string
  namespace: string
  color: string
}

interface MultiNamespaceSelectorProps {
  clusters: string[]
  onCompare: (selections: NamespaceSelection[]) => void
  isLoading?: boolean
  error?: string | null
}

const COLORS = [
  'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'bg-green-500/10 text-green-500 border-green-500/20',
  'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'bg-pink-500/10 text-pink-500 border-pink-500/20',
  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  'bg-red-500/10 text-red-500 border-red-500/20',
]

export function MultiNamespaceSelector({
  clusters,
  onCompare,
  isLoading = false,
  error = null
}: MultiNamespaceSelectorProps) {
  const [selections, setSelections] = useState<NamespaceSelection[]>([
    { id: '1', cluster: '', namespace: '', color: COLORS[0] },
    { id: '2', cluster: '', namespace: '', color: COLORS[1] }
  ])
  const [namespacesMap, setNamespacesMap] = useState<Record<string, string[]>>({})
  const [loadingNamespaces, setLoadingNamespaces] = useState<Record<string, boolean>>({})

  // Fetch namespaces from the actual API
  const fetchNamespaces = async (cluster: string): Promise<string[]> => {
    if (namespacesMap[cluster]) {
      return namespacesMap[cluster]
    }

    try {
      setLoadingNamespaces(prev => ({ ...prev, [cluster]: true }))
      const response = await fetch(`http://localhost:8080/api/v1/resources/namespaces?context=${encodeURIComponent(cluster)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch namespaces: ${response.statusText}`)
      }
      const data = await response.json()
      
      let namespaces: string[] = []
      if (data && data.items && Array.isArray(data.items)) {
        namespaces = data.items.map((ns: any) => ns.name || ns)
      } else if (data && data.namespaces && Array.isArray(data.namespaces)) {
        namespaces = data.namespaces.map((ns: any) => ns.name || ns)
      } else if (Array.isArray(data)) {
        namespaces = data.map((ns: any) => ns.name || ns)
      }

      setNamespacesMap(prev => ({ ...prev, [cluster]: namespaces }))
      return namespaces
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
      return []
    } finally {
      setLoadingNamespaces(prev => ({ ...prev, [cluster]: false }))
    }
  }

  const addSelection = () => {
    const newId = Date.now().toString()
    const colorIndex = selections.length % COLORS.length
    setSelections([...selections, {
      id: newId,
      cluster: '',
      namespace: '',
      color: COLORS[colorIndex]
    }])
  }

  const removeSelection = (id: string) => {
    if (selections.length > 2) {
      setSelections(selections.filter(s => s.id !== id))
    }
  }

  const duplicateSelection = (selection: NamespaceSelection) => {
    const newId = Date.now().toString()
    const colorIndex = selections.length % COLORS.length
    setSelections([...selections, {
      ...selection,
      id: newId,
      color: COLORS[colorIndex]
    }])
  }

  const updateSelection = (id: string, field: 'cluster' | 'namespace', value: string) => {
    setSelections(selections.map(s => {
      if (s.id === id) {
        if (field === 'cluster') {
          // Reset namespace when cluster changes
          fetchNamespaces(value)
          return { ...s, cluster: value, namespace: '' }
        }
        return { ...s, [field]: value }
      }
      return s
    }))
  }

  const canCompare = selections.filter(s => s.cluster && s.namespace).length >= 2 && !isLoading

  const handleCompare = () => {
    if (canCompare) {
      const validSelections = selections.filter(s => s.cluster && s.namespace)
      onCompare(validSelections)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Select Namespaces</CardTitle>
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Badge variant="outline" className="px-3 py-1">
                  {selections.filter(s => s.cluster && s.namespace).length} / {selections.length} configured
                </Badge>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={addSelection}
                  size="sm"
                  variant="outline"
                  className="gap-2 transition-all hover:shadow-md"
                  disabled={selections.length >= 8}
                >
                  <motion.div
                    animate={{ rotate: selections.length >= 8 ? 0 : [0, 90, 0] }}
                    transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Plus className="h-4 w-4" />
                  </motion.div>
                  Add Namespace
                </Button>
              </motion.div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {selections.map((selection, index) => (
                  <motion.div
                    key={selection.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 25,
                      delay: index * 0.05
                    }}
                  >
                    <Card className={cn(
                      "border-2 transition-all hover:shadow-md",
                      selection.cluster && selection.namespace 
                        ? selection.color 
                        : "border-border bg-muted/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-3 pt-1">
                            <motion.div
                              className="relative group"
                              whileHover={{ scale: 1.05, rotate: 3 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <div
                                className={cn(
                                  "w-14 h-14 rounded-3xl rotate-45 transition-all duration-300 group-hover:rotate-[50deg]",
                                  selection.cluster && selection.namespace 
                                    ? selection.color.replace('text-', 'bg-').replace('/10', '/20').replace('border-', 'bg-')
                                    : "bg-gradient-to-br from-muted to-muted/50"
                                )}
                              />
                              <Server className={cn(
                                "h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors",
                                selection.cluster && selection.namespace 
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )} />
                            </motion.div>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Config {index + 1}
                              </span>
                              {selection.cluster && selection.namespace && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="text-xs text-muted-foreground"
                                >
                                  Ready
                                </motion.div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <motion.div 
                              className="space-y-2"
                              whileHover={{ scale: 1.01 }}
                              transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Cluster
                              </label>
                              <Select 
                                value={selection.cluster} 
                                onValueChange={(value) => updateSelection(selection.id, 'cluster', value)}
                              >
                                <motion.div whileTap={{ scale: 0.98 }}>
                                  <SelectTrigger className="h-10 border hover:border-primary/50 transition-all duration-200 hover:shadow-sm">
                                    <motion.div
                                      key={selection.cluster}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: 10 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <SelectValue placeholder="Select cluster" />
                                    </motion.div>
                                  </SelectTrigger>
                                </motion.div>
                                <SelectContent className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                                  <SelectGroup>
                                    <SelectLabel>Available Clusters</SelectLabel>
                                    {clusters.map((cluster, idx) => (
                                      <motion.div
                                        key={cluster}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                      >
                                        <SelectItem 
                                          value={cluster}
                                          className="cursor-pointer transition-colors hover:bg-primary/5"
                                        >
                                          <motion.span
                                            whileHover={{ x: 2 }}
                                            transition={{ type: "spring", stiffness: 400 }}
                                          >
                                            {cluster}
                                          </motion.span>
                                        </SelectItem>
                                      </motion.div>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </motion.div>

                            <motion.div 
                              className="space-y-2"
                              whileHover={{ scale: 1.01 }}
                              transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Namespace
                              </label>
                              <AnimatePresence mode="wait">
                                {loadingNamespaces[selection.cluster] ? (
                                  <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                  >
                                    <Skeleton className="h-10 w-full" />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="loaded"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                  >
                                    <Select 
                                      value={selection.namespace} 
                                      onValueChange={(value) => updateSelection(selection.id, 'namespace', value)}
                                      disabled={!selection.cluster || !namespacesMap[selection.cluster]?.length}
                                    >
                                      <motion.div whileTap={{ scale: 0.98 }}>
                                        <SelectTrigger className="h-10 border hover:border-primary/50 transition-all duration-200 hover:shadow-sm">
                                          <motion.div 
                                            className="flex items-center gap-2"
                                            key={selection.namespace}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2 }}
                                          >
                                            <motion.div
                                              animate={{ rotate: selection.namespace ? 360 : 0 }}
                                              transition={{ duration: 0.5 }}
                                            >
                                              <Layers className="h-4 w-4 text-muted-foreground" />
                                            </motion.div>
                                            <SelectValue placeholder="Select namespace" />
                                          </motion.div>
                                        </SelectTrigger>
                                      </motion.div>
                                      <SelectContent className="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                                        <SelectGroup>
                                          <SelectLabel>Available Namespaces</SelectLabel>
                                          {(namespacesMap[selection.cluster] || []).map((ns, idx) => (
                                            <motion.div
                                              key={ns}
                                              initial={{ opacity: 0, x: -20 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: idx * 0.02 }}
                                            >
                                              <SelectItem 
                                                value={ns}
                                                className="cursor-pointer transition-colors hover:bg-primary/5"
                                              >
                                                <motion.span
                                                  whileHover={{ x: 2 }}
                                                  transition={{ type: "spring", stiffness: 400 }}
                                                >
                                                  {ns}
                                                </motion.span>
                                              </SelectItem>
                                            </motion.div>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </div>

                          <div className="flex items-center gap-1 pt-2">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                onClick={() => duplicateSelection(selection)}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 transition-colors"
                                disabled={selections.length >= 8 || !selection.cluster || !selection.namespace}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                onClick={() => removeSelection(selection.id)}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 transition-colors"
                                disabled={selections.length <= 2}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <motion.div 
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <Button 
              onClick={handleCompare}
              disabled={!canCompare}
              size="lg"
              className="group relative overflow-hidden px-8 py-6 text-base font-semibold shadow-lg transition-all hover:shadow-xl"
            >
              <motion.span
                className="relative z-10 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Compare {selections.filter(s => s.cluster && s.namespace).length} Namespaces
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.div>
              </motion.span>
              {canCompare && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              )}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}