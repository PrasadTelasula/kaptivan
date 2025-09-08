import type { Cluster, Namespace, NamespaceWithResources } from "../types"

const API_BASE_URL = "http://localhost:8080/api/v1"

export const namespacesApi = {
  // Get list of clusters
  async getClusters(): Promise<Cluster[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/config`)
      if (!response.ok) throw new Error("Failed to fetch clusters")
      
      const data = await response.json()
      
      // Transform backend data to our Cluster type
      console.log("Raw cluster data from backend:", data.clusters)
      return data.clusters?.map((cluster: any) => ({
        id: cluster.context || cluster.name, // Use context as the unique identifier
        name: cluster.name,
        status: cluster.connected ? "connected" : "disconnected",
        endpoint: cluster.server || ""
      })) || []
    } catch (error) {
      console.error("Error fetching clusters:", error)
      return []
    }
  },

  // Get namespaces for all clusters
  async getNamespaces(): Promise<Namespace[]> {
    try {
      // First get clusters
      const clusters = await this.getClusters()
      const allNamespaces: Namespace[] = []
      
      // Fetch namespaces for each connected cluster
      for (const cluster of clusters) {
        if (cluster.status === "connected") {
          try {
            const response = await fetch(`${API_BASE_URL}/topology/namespaces?context=${cluster.id}`)
            if (response.ok) {
              const data = await response.json()
              console.log(`Namespaces for cluster ${cluster.name}:`, data)
              console.log(`Cluster ID being set:`, cluster.name)
              
              // Transform backend namespace data
              // Backend returns array of strings, not objects
              const clusterNamespaces = data.namespaces
                ?.filter((ns: any) => ns) // Filter out null/undefined values
                ?.map((ns: any) => {
                  // Handle both string and object formats
                  const namespaceName = typeof ns === 'string' ? ns : ns.name
                  return {
                    name: namespaceName,
                    cluster: cluster.name,
                    clusterId: cluster.id, // Use cluster.id (which is the context) as the unique identifier
                    status: "Active", // Default status since backend doesn't provide it
                    createdAt: new Date(), // Default to now since backend doesn't provide it
                    labels: {},
                    annotations: {},
                    podCount: 0, // These would need separate API calls
                    serviceCount: 0,
                    resourceQuota: undefined // Would need to fetch ResourceQuota objects
                  }
                }) || []
              
              allNamespaces.push(...clusterNamespaces)
            }
          } catch (error) {
            console.error(`Error fetching namespaces for cluster ${cluster.name}:`, error)
          }
        }
      }
      
      console.log("All namespaces:", allNamespaces)
      return allNamespaces
    } catch (error) {
      console.error("Error fetching namespaces:", error)
      return []
    }
  },

  // Create a new namespace
  async createNamespace(data: {
    name: string
    cluster: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/resources/namespaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: data.cluster,
          namespace: data.name,
          labels: data.labels || {},
          annotations: data.annotations || {}
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to create namespace")
      }
    } catch (error) {
      console.error("Error creating namespace:", error)
      throw error
    }
  },

  // Delete a namespace
  async deleteNamespace(namespace: string, cluster: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/resources/namespaces/${namespace}?context=${cluster}`,
        {
          method: "DELETE",
        }
      )
      
      if (!response.ok) {
        throw new Error("Failed to delete namespace")
      }
    } catch (error) {
      console.error("Error deleting namespace:", error)
      throw error
    }
  },

  // Connect to a cluster
  async connectCluster(clusterName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context: clusterName })
      })
      
      if (!response.ok) {
        throw new Error("Failed to connect to cluster")
      }
    } catch (error) {
      console.error("Error connecting to cluster:", error)
      throw error
    }
  },

  // Disconnect from a cluster
  async disconnectCluster(clusterName: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context: clusterName })
      })
      
      if (!response.ok) {
        throw new Error("Failed to disconnect from cluster")
      }
    } catch (error) {
      console.error("Error disconnecting from cluster:", error)
      throw error
    }
  },

  // Get resource counts for a namespace
  async getNamespaceResources(cluster: string, namespace: string): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/namespace-resources/single?context=${cluster}&namespace=${namespace}`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch namespace resources")
      }
      
      return await response.json()
    } catch (error) {
      console.error("Error fetching namespace resources:", error)
      return null
    }
  },

  // Get resource counts for all namespaces
  async getAllNamespaceResources(cluster: string): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/namespace-resources/all?context=${cluster}`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch all namespace resources")
      }
      
      return await response.json()
    } catch (error) {
      console.error("Error fetching all namespace resources:", error)
      return null
    }
  },

  // Get namespace details including labels, annotations
  async getNamespaceDetails(cluster: string, namespace: string): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/namespace-resources/${namespace}/details?context=${cluster}`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch namespace details")
      }
      
      return await response.json()
    } catch (error) {
      console.error("Error fetching namespace details:", error)
      return null
    }
  },

  // Get namespace YAML
  async getNamespaceYaml(cluster: string, namespace: string): Promise<string> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/namespace-resources/${namespace}/yaml?context=${cluster}`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch namespace YAML")
      }
      
      return await response.text()
    } catch (error) {
      console.error("Error fetching namespace YAML:", error)
      return "Failed to load YAML content"
    }
  },

  // Get resource names for a specific resource type in a namespace
  async getResourceNames(context: string, namespace: string, resourceType: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/namespace-resources/resource-names`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          context, 
          namespace, 
          resourceType 
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to get resource names")
      }
      
      return await response.json()
    } catch (error) {
      console.error("Error getting resource names:", error)
      return { names: [], count: 0 }
    }
  }
}