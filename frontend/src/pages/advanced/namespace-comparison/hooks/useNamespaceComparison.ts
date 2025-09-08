import { useState, useCallback } from 'react'
import type { NamespaceSnapshot, CompareRow } from '../types/index'
import { compareSnapshots } from '../utils/comparison'
import { k8sReader, mockK8sReader } from '../services/k8sAdapter'

interface UseNamespaceComparisonResult {
  snapshotA: NamespaceSnapshot | null
  snapshotB: NamespaceSnapshot | null
  comparisonRows: CompareRow[]
  isLoading: boolean
  error: string | null
  fetchSnapshots: (
    clusterA: string,
    namespaceA: string,
    clusterB: string,
    namespaceB: string
  ) => Promise<void>
  refresh: () => Promise<void>
  clearComparison: () => void
}

export function useNamespaceComparison(useMockData = false): UseNamespaceComparisonResult {
  const [snapshotA, setSnapshotA] = useState<NamespaceSnapshot | null>(null)
  const [snapshotB, setSnapshotB] = useState<NamespaceSnapshot | null>(null)
  const [comparisonRows, setComparisonRows] = useState<CompareRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Store last fetch params for refresh
  const [lastFetchParams, setLastFetchParams] = useState<{
    clusterA: string
    namespaceA: string
    clusterB: string
    namespaceB: string
  } | null>(null)

  const reader = useMockData ? mockK8sReader : k8sReader

  const fetchSnapshots = useCallback(async (
    clusterA: string,
    namespaceA: string,
    clusterB: string,
    namespaceB: string
  ) => {
    setIsLoading(true)
    setError(null)
    
    // Store params for refresh
    setLastFetchParams({ clusterA, namespaceA, clusterB, namespaceB })

    try {
      // Try to use the backend compare endpoint for better performance
      if (!useMockData) {
        try {
          const response = await fetch('http://localhost:8080/api/v1/namespaces/compare', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              clusterA,
              namespaceA,
              clusterB,
              namespaceB
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.snapshotA && data.snapshotB) {
              setSnapshotA(data.snapshotA)
              setSnapshotB(data.snapshotB)
              setComparisonRows(data.rows || compareSnapshots(data.snapshotA, data.snapshotB))
              return
            }
          }
        } catch (err) {
          console.warn('Failed to use compare endpoint, falling back to individual fetches:', err)
        }
      }
      
      // Fallback: Fetch both snapshots in parallel
      const [snapA, snapB] = await Promise.all([
        reader.getNamespaceSnapshot(clusterA, namespaceA),
        reader.getNamespaceSnapshot(clusterB, namespaceB)
      ])

      setSnapshotA(snapA)
      setSnapshotB(snapB)

      // Compare snapshots
      const rows = compareSnapshots(snapA, snapB)
      setComparisonRows(rows)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch namespace data'
      setError(errorMessage)
      console.error('Failed to fetch snapshots:', err)
    } finally {
      setIsLoading(false)
    }
  }, [reader])

  const refresh = useCallback(async () => {
    if (lastFetchParams) {
      await fetchSnapshots(
        lastFetchParams.clusterA,
        lastFetchParams.namespaceA,
        lastFetchParams.clusterB,
        lastFetchParams.namespaceB
      )
    }
  }, [lastFetchParams, fetchSnapshots])

  const clearComparison = useCallback(() => {
    setSnapshotA(null)
    setSnapshotB(null)
    setComparisonRows([])
    setError(null)
    setLastFetchParams(null)
  }, [])

  return {
    snapshotA,
    snapshotB,
    comparisonRows,
    isLoading,
    error,
    fetchSnapshots,
    refresh,
    clearComparison
  }
}