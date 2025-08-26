import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TabResource {
  name: string
  namespace?: string
  kind: string
  apiVersion: string
  uid?: string
  clusterContext?: string
  clusterName?: string
}

interface Tab {
  id: string
  title: string
  resource: TabResource
  groupId?: string
  createdAt: number
}

interface TabGroup {
  id: string
  name: string
  color: string
  collapsed: boolean
  tabIds: string[]
}

interface TabSession {
  id: string
  name: string
  description?: string
  tabs: Tab[]
  groups: TabGroup[]
  activeTabId?: string
  createdAt: number
  updatedAt: number
}

interface TabsStore {
  // Current tabs
  tabs: Tab[]
  activeTabId: string | null
  
  // Tab groups
  groups: TabGroup[]
  
  // Saved sessions
  sessions: TabSession[]
  
  // Tab actions
  addTab: (tab: Omit<Tab, 'id' | 'createdAt'>) => string
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  closeAllTabs: () => void
  closeTabs: (tabIds: string[]) => void
  closeOtherTabs: (tabId: string) => void
  closeTabsToRight: (tabId: string) => void
  
  // Group actions
  createGroup: (name: string, tabIds: string[], color?: string) => string
  addTabToGroup: (tabId: string, groupId: string) => void
  removeTabFromGroup: (tabId: string) => void
  toggleGroupCollapse: (groupId: string) => void
  deleteGroup: (groupId: string) => void
  renameGroup: (groupId: string, name: string) => void
  
  // Session actions
  saveSession: (name: string, description?: string) => void
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<TabSession>) => void
  
  // Navigation
  nextTab: () => void
  previousTab: () => void
  goToTab: (index: number) => void
  
  // Search
  searchTabs: (query: string) => Tab[]
  
  // Utils
  getTabsByGroup: (groupId: string) => Tab[]
  getRelatedTabs: (tab: Tab) => Tab[]
  isTabOpen: (resource: TabResource) => Tab | undefined
}

const TAB_GROUP_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      groups: [],
      sessions: [],
      
      addTab: (tabData) => {
        const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const tab: Tab = {
          ...tabData,
          id,
          createdAt: Date.now(),
        }
        
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: id,
        }))
        
        return id
      },
      
      removeTab: (tabId) => {
        set((state) => {
          const index = state.tabs.findIndex(t => t.id === tabId)
          const newTabs = state.tabs.filter(t => t.id !== tabId)
          
          // Update active tab if needed
          let newActiveTabId = state.activeTabId
          if (state.activeTabId === tabId) {
            if (newTabs.length > 0) {
              // Set to previous tab or next if at start
              const newIndex = Math.min(index, newTabs.length - 1)
              newActiveTabId = newTabs[newIndex]?.id || null
            } else {
              newActiveTabId = null
            }
          }
          
          // Remove from groups
          const newGroups = state.groups.map(group => ({
            ...group,
            tabIds: group.tabIds.filter(id => id !== tabId)
          }))
          
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
            groups: newGroups,
          }
        })
      },
      
      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },
      
      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null, groups: [] })
      },
      
      closeTabs: (tabIds) => {
        set((state) => {
          const newTabs = state.tabs.filter(t => !tabIds.includes(t.id))
          const newActiveTabId = tabIds.includes(state.activeTabId || '') 
            ? newTabs[0]?.id || null
            : state.activeTabId
            
          const newGroups = state.groups.map(group => ({
            ...group,
            tabIds: group.tabIds.filter(id => !tabIds.includes(id))
          }))
          
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
            groups: newGroups,
          }
        })
      },
      
      closeOtherTabs: (tabId) => {
        set((state) => {
          const tab = state.tabs.find(t => t.id === tabId)
          if (!tab) return state
          
          return {
            tabs: [tab],
            activeTabId: tabId,
            groups: state.groups.map(group => ({
              ...group,
              tabIds: group.tabIds.filter(id => id === tabId)
            })).filter(group => group.tabIds.length > 0),
          }
        })
      },
      
      closeTabsToRight: (tabId) => {
        set((state) => {
          const index = state.tabs.findIndex(t => t.id === tabId)
          if (index === -1) return state
          
          const newTabs = state.tabs.slice(0, index + 1)
          const removedTabIds = state.tabs.slice(index + 1).map(t => t.id)
          
          const newGroups = state.groups.map(group => ({
            ...group,
            tabIds: group.tabIds.filter(id => !removedTabIds.includes(id))
          }))
          
          return {
            tabs: newTabs,
            activeTabId: removedTabIds.includes(state.activeTabId || '') 
              ? tabId 
              : state.activeTabId,
            groups: newGroups,
          }
        })
      },
      
      createGroup: (name, tabIds, color) => {
        const id = `group-${Date.now()}`
        const group: TabGroup = {
          id,
          name,
          color: color || TAB_GROUP_COLORS[get().groups.length % TAB_GROUP_COLORS.length],
          collapsed: false,
          tabIds,
        }
        
        set((state) => {
          // Update tabs to have group ID
          const newTabs = state.tabs.map(tab =>
            tabIds.includes(tab.id) ? { ...tab, groupId: id } : tab
          )
          
          return {
            tabs: newTabs,
            groups: [...state.groups, group],
          }
        })
        
        return id
      },
      
      addTabToGroup: (tabId, groupId) => {
        set((state) => {
          const newTabs = state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, groupId } : tab
          )
          
          const newGroups = state.groups.map(group =>
            group.id === groupId
              ? { ...group, tabIds: [...group.tabIds, tabId] }
              : { ...group, tabIds: group.tabIds.filter(id => id !== tabId) }
          )
          
          return { tabs: newTabs, groups: newGroups }
        })
      },
      
      removeTabFromGroup: (tabId) => {
        set((state) => {
          const newTabs = state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, groupId: undefined } : tab
          )
          
          const newGroups = state.groups.map(group => ({
            ...group,
            tabIds: group.tabIds.filter(id => id !== tabId)
          }))
          
          return { tabs: newTabs, groups: newGroups }
        })
      },
      
      toggleGroupCollapse: (groupId) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
          )
        }))
      },
      
      deleteGroup: (groupId) => {
        set((state) => {
          const newTabs = state.tabs.map(tab =>
            tab.groupId === groupId ? { ...tab, groupId: undefined } : tab
          )
          
          const newGroups = state.groups.filter(g => g.id !== groupId)
          
          return { tabs: newTabs, groups: newGroups }
        })
      },
      
      renameGroup: (groupId, name) => {
        set((state) => ({
          groups: state.groups.map(group =>
            group.id === groupId ? { ...group, name } : group
          )
        }))
      },
      
      saveSession: (name, description) => {
        const { tabs, groups, activeTabId } = get()
        const session: TabSession = {
          id: `session-${Date.now()}`,
          name,
          description,
          tabs: [...tabs],
          groups: [...groups],
          activeTabId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        
        set((state) => ({
          sessions: [...state.sessions, session],
        }))
      },
      
      loadSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId)
        if (!session) return
        
        set({
          tabs: [...session.tabs],
          groups: [...session.groups],
          activeTabId: session.activeTabId || null,
        })
      },
      
      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
        }))
      },
      
      updateSession: (sessionId, updates) => {
        set((state) => ({
          sessions: state.sessions.map(session =>
            session.id === sessionId
              ? { ...session, ...updates, updatedAt: Date.now() }
              : session
          ),
        }))
      },
      
      nextTab: () => {
        const { tabs, activeTabId } = get()
        if (tabs.length === 0) return
        
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const nextIndex = (currentIndex + 1) % tabs.length
        set({ activeTabId: tabs[nextIndex].id })
      },
      
      previousTab: () => {
        const { tabs, activeTabId } = get()
        if (tabs.length === 0) return
        
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
        set({ activeTabId: tabs[prevIndex].id })
      },
      
      goToTab: (index) => {
        const { tabs } = get()
        if (index >= 0 && index < tabs.length) {
          set({ activeTabId: tabs[index].id })
        }
      },
      
      searchTabs: (query) => {
        const { tabs } = get()
        const lowerQuery = query.toLowerCase()
        
        return tabs.filter(tab =>
          tab.title.toLowerCase().includes(lowerQuery) ||
          tab.resource.name.toLowerCase().includes(lowerQuery) ||
          tab.resource.kind.toLowerCase().includes(lowerQuery) ||
          (tab.resource.namespace?.toLowerCase().includes(lowerQuery) || false) ||
          (tab.resource.clusterName?.toLowerCase().includes(lowerQuery) || false)
        )
      },
      
      getTabsByGroup: (groupId) => {
        const { tabs } = get()
        return tabs.filter(tab => tab.groupId === groupId)
      },
      
      getRelatedTabs: (tab) => {
        const { tabs } = get()
        
        // Find tabs with same namespace and kind
        return tabs.filter(t =>
          t.id !== tab.id &&
          t.resource.namespace === tab.resource.namespace &&
          (
            t.resource.kind === tab.resource.kind ||
            // Related resources (e.g., Deployment -> ReplicaSet -> Pod)
            (tab.resource.kind === 'Deployment' && t.resource.kind === 'ReplicaSet') ||
            (tab.resource.kind === 'Deployment' && t.resource.kind === 'Pod') ||
            (tab.resource.kind === 'ReplicaSet' && t.resource.kind === 'Pod') ||
            (tab.resource.kind === 'Service' && t.resource.kind === 'Endpoint') ||
            (tab.resource.kind === 'StatefulSet' && t.resource.kind === 'Pod')
          )
        )
      },
      
      isTabOpen: (resource) => {
        const { tabs } = get()
        return tabs.find(tab =>
          tab.resource.name === resource.name &&
          tab.resource.namespace === resource.namespace &&
          tab.resource.kind === resource.kind &&
          tab.resource.clusterContext === resource.clusterContext
        )
      },
    }),
    {
      name: 'kaptivan-tabs-storage',
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
)

// Export types
export type { TabResource, Tab, TabGroup, TabSession }