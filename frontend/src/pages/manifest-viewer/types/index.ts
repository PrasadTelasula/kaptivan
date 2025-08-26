import type { LucideIcon } from 'lucide-react'

export interface ResourceItem {
  name: string
  namespace?: string
  kind: string
  apiVersion: string
  uid?: string
  creationTimestamp?: string
  clusterContext?: string
  clusterName?: string
}

export interface ResourceGroup {
  name: string
  icon: LucideIcon
  expanded: boolean
  items: ResourceItem[]
  loading: boolean
  clusters?: Map<string, ResourceItem[]>
}

export interface ManifestTab {
  id: string
  title: string
  resource: ResourceItem
  content: string
  loading: boolean
}