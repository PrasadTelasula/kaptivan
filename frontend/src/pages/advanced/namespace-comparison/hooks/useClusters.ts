import { useState, useEffect } from 'react'
import api from '@/services/api'

interface UseClusterResult {
  clusters: string[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useClusters(): UseClusterResult {
  const [clusters, setClusters] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClusters = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.clusters.listClusters()
      
      // Handle the response structure { clusters: [], total: number }
      if (response && response.clusters && Array.isArray(response.clusters)) {
        if (response.clusters.length > 0) {
          const clusterNames = response.clusters.map((cluster: any) => cluster.context || cluster.name || cluster)
          setClusters(clusterNames)
        } else {
          // No clusters available from kubeconfig
          console.warn('No clusters found in kubeconfig')
          setError('No clusters found. Please ensure your kubeconfig is properly configured.')
          setClusters([])
        }
      } else if (Array.isArray(response)) {
        // Handle if it's already an array
        const clusterNames = response.map((cluster: any) => cluster.context || cluster.name || cluster)
        setClusters(clusterNames)
      } else {
        // No clusters available
        console.warn('Invalid response format from API')
        setError('Invalid response from server')
        setClusters([])
      }
    } catch (err) {
      console.error('Failed to fetch clusters:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch clusters')
      setClusters([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClusters()
  }, [])

  return {
    clusters,
    isLoading,
    error,
    refetch: fetchClusters
  }
}