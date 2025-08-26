import { useState, useEffect, useCallback } from 'react'
import type { ResourceItem } from '../types'

export function useNamespaces(clusterContext?: string) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  
  const fetchNamespaces = useCallback(async () => {
    if (!clusterContext) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/resources/namespaces?context=${clusterContext}`)
      if (response.ok) {
        const data = await response.json()
        setNamespaces(data.items?.map((ns: any) => ns.name) || [])
      }
    } catch (error) {
      console.error('Failed to fetch namespaces:', error)
    } finally {
      setLoading(false)
    }
  }, [clusterContext])
  
  useEffect(() => {
    fetchNamespaces()
  }, [fetchNamespaces])
  
  return { namespaces, loading, refetch: fetchNamespaces }
}

export function useFetchResources() {
  const fetchResources = useCallback(async (
    clusters: Array<{ context: string; name: string }>,
    kind: string,
    apiVersion: string,
    namespace?: string
  ) => {
    const fetchPromises = clusters.map(async (cluster) => {
      try {
        console.log('Fetching resources:', { cluster: cluster.name, kind, apiVersion, namespace })
        const response = await fetch(`/api/v1/manifests/list`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: cluster.context,
            namespace: namespace || '',
            kind: kind,
            apiVersion: apiVersion
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          const items = data.items?.map((item: any) => ({
            name: item.name,
            namespace: item.namespace,
            kind: item.kind,
            apiVersion: item.apiVersion || apiVersion,
            uid: item.uid,
            creationTimestamp: item.creationTimestamp,
            clusterContext: cluster.context,
            clusterName: cluster.name
          })) || []
          
          return { cluster: cluster.context, items }
        }
        return { cluster: cluster.context, items: [] }
      } catch (error) {
        console.error(`Failed to fetch from cluster ${cluster.name}:`, error)
        return { cluster: cluster.context, items: [] }
      }
    })

    return Promise.all(fetchPromises)
  }, [])
  
  return { fetchResources }
}

export function useFetchManifest() {
  const fetchManifest = useCallback(async (
    resource: ResourceItem,
    clusterContext?: string
  ): Promise<string> => {
    const context = resource.clusterContext || clusterContext
    if (!context) return '# No cluster context available'

    try {
      const params = new URLSearchParams()
      params.append('kind', resource.kind)
      params.append('apiVersion', resource.apiVersion)
      if (resource.namespace) {
        params.append('namespace', resource.namespace)
      }
      
      const endpoint = `/api/v1/manifests/${context}/${resource.name}?${params.toString()}`
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const yaml = await response.text()
        return yaml
      }
    } catch (error) {
      console.error('Failed to fetch manifest:', error)
    }
    return '# Failed to load manifest'
  }, [])
  
  return { fetchManifest }
}