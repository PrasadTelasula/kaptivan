import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiUrls } from '@/utils/api-urls'

interface Cluster {
  name: string
  context: string
  connected: boolean
  error?: string
}

interface ClusterVersion {
  major: string
  minor: string
  gitVersion: string
  platform: string
  goVersion: string
  gitCommit: string
  buildDate: string
}

interface ClusterState {
  clusters: Cluster[]
  currentContext: string | null
  selectedContexts: string[]  // For multiple cluster selection
  currentClusterVersion: ClusterVersion | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchClusters: () => Promise<void>
  connectCluster: (context: string) => Promise<void>
  disconnectCluster: (context: string) => Promise<void>
  setCurrentContext: (context: string | null) => void
  fetchClusterInfo: (context: string) => Promise<void>
  toggleClusterSelection: (context: string) => void
  selectAllClusters: () => void
  clearSelection: () => void
  isClusterSelected: (context: string) => boolean
}

// API URLs are now centralized in utils/api-urls.ts

export const useClusterStore = create<ClusterState>()(
  persist(
    (set, get) => ({
      clusters: [],
      currentContext: null,
      selectedContexts: [],
      currentClusterVersion: null,
      isLoading: false,
      error: null,

      fetchClusters: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(apiUrls.clusters.config())
          if (!response.ok) {
            throw new Error('Failed to fetch clusters')
          }
          const data = await response.json()
          set({ 
            clusters: data.clusters || [], 
            isLoading: false 
          })
          
          // Don't auto-select any clusters by default
          // User must explicitly select clusters
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch clusters',
            isLoading: false 
          })
        }
      },

      connectCluster: async (context: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(apiUrls.clusters.connect(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ context })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to connect to cluster')
          }
          
          // Don't automatically set as current context
          // User must explicitly select clusters
          await get().fetchClusters()
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to connect',
            isLoading: false 
          })
          throw error
        }
      },

      disconnectCluster: async (context: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(apiUrls.clusters.disconnect(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ context })
          })
          
          if (!response.ok) {
            throw new Error('Failed to disconnect from cluster')
          }
          
          if (get().currentContext === context) {
            set({ currentContext: null, currentClusterVersion: null })
          }
          
          await get().fetchClusters()
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to disconnect',
            isLoading: false 
          })
        }
      },

      setCurrentContext: (context: string | null) => {
        set({ currentContext: context })
        if (context) {
          get().fetchClusterInfo(context)
        } else {
          set({ currentClusterVersion: null })
        }
      },

      fetchClusterInfo: async (context: string) => {
        try {
          const url = apiUrls.clusters.get(context)
          console.log('Fetching cluster info from:', url)
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error('Failed to fetch cluster info')
          }
          const data = await response.json()
          if (data.version) {
            set({ currentClusterVersion: data.version })
          }
        } catch (error) {
          console.error('Failed to fetch cluster info:', error)
        }
      },

      toggleClusterSelection: (context: string) => {
        const currentSelected = get().selectedContexts
        if (currentSelected.includes(context)) {
          set({ selectedContexts: currentSelected.filter(c => c !== context) })
        } else {
          set({ selectedContexts: [...currentSelected, context] })
        }
      },

      selectAllClusters: () => {
        const connectedClusters = get().clusters
          .filter(c => c.connected)
          .map(c => c.context)
        set({ selectedContexts: connectedClusters })
      },

      clearSelection: () => {
        set({ selectedContexts: [] })
      },

      isClusterSelected: (context: string) => {
        return get().selectedContexts.includes(context)
      }
    }),
    {
      name: 'cluster-storage',
      partialize: (state) => ({
        // Don't persist currentContext to avoid auto-selection on reload
        // selectedContexts: state.selectedContexts, // Uncomment if you want to persist selections
      }),
    }
  )
)