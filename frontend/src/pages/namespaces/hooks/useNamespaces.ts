import { useState, useEffect, useMemo } from "react"
import type { Cluster, Namespace, FilterState } from "../types"
import { namespacesApi } from "../services/api"

export function useNamespaces() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch real data from API
      const [clustersData, namespacesData] = await Promise.all([
        namespacesApi.getClusters(),
        namespacesApi.getNamespaces()
      ])
      
      setClusters(clustersData)
      setNamespaces(namespacesData)
      setError(null)
    } catch (err) {
      setError("Failed to load clusters and namespaces")
      console.error("Error in fetchData:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const createNamespace = async (data: any) => {
    try {
      // Parse labels and annotations from string format
      const labels = data.labels ? 
        Object.fromEntries(data.labels.split('\n').filter(Boolean).map((l: string) => l.split('='))) : {}
      const annotations = data.annotations ? 
        Object.fromEntries(data.annotations.split('\n').filter(Boolean).map((l: string) => l.split('='))) : {}
      
      // Call API to create namespace
      await namespacesApi.createNamespace({
        name: data.name,
        cluster: data.cluster,
        labels,
        annotations
      })
      
      // Refresh the data
      await fetchData()
    } catch (error) {
      console.error("Error creating namespace:", error)
      throw error
    }
  }

  const deleteNamespace = async (namespace: Namespace) => {
    try {
      // Call API to delete namespace
      await namespacesApi.deleteNamespace(namespace.name, namespace.clusterId)
      
      // Refresh the data
      await fetchData()
    } catch (error) {
      console.error("Error deleting namespace:", error)
      throw error
    }
  }

  return {
    clusters,
    namespaces,
    isLoading,
    error,
    createNamespace,
    deleteNamespace,
    refetch: fetchData
  }
}

export function useFilteredNamespaces(namespaces: Namespace[], filters: FilterState) {
  return useMemo(() => {
    return namespaces.filter(ns => {
      // Filter by clusters - if clusters array is empty, show all clusters
      if (filters.clusters.length > 0 && !filters.clusters.includes(ns.clusterId)) return false
      if (filters.search && !ns.name.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.status !== "all") {
        if (filters.status === "active" && ns.status !== "Active") return false
        if (filters.status === "terminating" && ns.status !== "Terminating") return false
        if (filters.status === "error" && ns.status !== "Error") return false
      }
      return true
    })
  }, [namespaces, filters])
}