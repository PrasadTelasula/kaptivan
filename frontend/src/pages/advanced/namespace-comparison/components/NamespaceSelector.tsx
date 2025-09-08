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
import { AlertCircle, ArrowRight, Server, Layers, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface NamespaceSelectorProps {
  clusters: string[]
  onCompare: (clusterA: string, namespaceA: string, clusterB: string, namespaceB: string) => void
  isLoading?: boolean
  error?: string | null
}

export function NamespaceSelector({
  clusters,
  onCompare,
  isLoading = false,
  error = null
}: NamespaceSelectorProps) {
  const [clusterA, setClusterA] = useState<string>('')
  const [clusterB, setClusterB] = useState<string>('')
  const [namespaceA, setNamespaceA] = useState<string>('')
  const [namespaceB, setNamespaceB] = useState<string>('')
  const [namespacesA, setNamespacesA] = useState<string[]>([])
  const [namespacesB, setNamespacesB] = useState<string[]>([])
  const [loadingNamespacesA, setLoadingNamespacesA] = useState(false)
  const [loadingNamespacesB, setLoadingNamespacesB] = useState(false)

  // Fetch namespaces from the actual API
  const fetchNamespaces = async (cluster: string): Promise<string[]> => {
    try {
      const response = await fetch(`http://localhost:8080/api/v1/resources/namespaces?context=${encodeURIComponent(cluster)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch namespaces: ${response.statusText}`)
      }
      const data = await response.json()
      
      // Handle the response format from ListNamespaces handler
      // The response has format: { items: [...], total: number }
      if (data && data.items && Array.isArray(data.items)) {
        return data.items.map((ns: any) => ns.name || ns)
      } else if (data && data.namespaces && Array.isArray(data.namespaces)) {
        return data.namespaces.map((ns: any) => ns.name || ns)
      } else if (Array.isArray(data)) {
        return data.map((ns: any) => ns.name || ns)
      } else {
        // No namespaces found
        console.warn('No namespaces found for cluster:', cluster)
        return []
      }
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
      // Return empty array on error - user should check their cluster connection
      return []
    }
  }

  // Fetch namespaces when cluster A changes
  useEffect(() => {
    if (clusterA) {
      setLoadingNamespacesA(true)
      setNamespaceA('')
      fetchNamespaces(clusterA)
        .then(namespaces => {
          console.log('Fetched namespaces for cluster A:', namespaces)
          setNamespacesA(namespaces)
        })
        .catch(console.error)
        .finally(() => setLoadingNamespacesA(false))
    } else {
      setNamespacesA([])
      setNamespaceA('')
    }
  }, [clusterA])

  // Fetch namespaces when cluster B changes
  useEffect(() => {
    if (clusterB) {
      setLoadingNamespacesB(true)
      setNamespaceB('')
      fetchNamespaces(clusterB)
        .then(namespaces => {
          console.log('Fetched namespaces for cluster B:', namespaces)
          setNamespacesB(namespaces)
        })
        .catch(console.error)
        .finally(() => setLoadingNamespacesB(false))
    } else {
      setNamespacesB([])
      setNamespaceB('')
    }
  }, [clusterB])

  const canCompare = clusterA && namespaceA && clusterB && namespaceB && !isLoading

  const handleCompare = () => {
    if (canCompare) {
      onCompare(clusterA, namespaceA, clusterB, namespaceB)
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
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl">Select Namespaces to Compare</CardTitle>
          </div>
          <CardDescription>Choose clusters and namespaces to analyze differences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Namespace A Selection */}
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Namespace A</h3>
                    <p className="text-xs text-muted-foreground">Source configuration</p>
                  </div>
                </div>
                {clusterA && namespaceA && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <Badge variant="secondary">Ready</Badge>
                  </motion.div>
                )}
              </div>
            
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cluster</label>
                <Select value={clusterA} onValueChange={setClusterA}>
                  <SelectTrigger className="h-12 border-2 hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Select cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Available Clusters</SelectLabel>
                      {clusters.map(cluster => (
                        <SelectItem key={cluster} value={cluster}>
                          {cluster}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence mode="wait">
                {loadingNamespacesA ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Skeleton className="h-12 w-full" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Namespace</label>
                    <Select 
                      value={namespaceA} 
                      onValueChange={setNamespaceA}
                      disabled={!clusterA || namespacesA.length === 0}
                    >
                      <SelectTrigger className="h-12 border-2 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select namespace" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Available Namespaces</SelectLabel>
                          {namespacesA.map(ns => (
                            <SelectItem key={ns} value={ns}>
                              {ns}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Namespace B Selection */}
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Server className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Namespace B</h3>
                    <p className="text-xs text-muted-foreground">Target configuration</p>
                  </div>
                </div>
                {clusterB && namespaceB && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <Badge variant="secondary">Ready</Badge>
                  </motion.div>
                )}
              </div>
            
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cluster</label>
                <Select value={clusterB} onValueChange={setClusterB}>
                  <SelectTrigger className="h-12 border-2 hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Select cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Available Clusters</SelectLabel>
                      {clusters.map(cluster => (
                        <SelectItem key={cluster} value={cluster}>
                          {cluster}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence mode="wait">
                {loadingNamespacesB ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Skeleton className="h-12 w-full" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Namespace</label>
                    <Select 
                      value={namespaceB} 
                      onValueChange={setNamespaceB}
                      disabled={!clusterB || namespacesB.length === 0}
                    >
                      <SelectTrigger className="h-12 border-2 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select namespace" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Available Namespaces</SelectLabel>
                          {namespacesB.map(ns => (
                            <SelectItem key={ns} value={ns}>
                              {ns}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <motion.div 
            className="mt-8 flex justify-center"
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
                Compare Namespaces
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