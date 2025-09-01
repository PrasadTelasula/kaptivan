/**
 * Centralized API URL builder for Kubernetes resources
 * 
 * This module provides a single source of truth for all API URLs in the application.
 * It handles proper URL encoding for special characters in cluster names (like EKS ARNs),
 * namespaces, and resource names.
 * 
 * EKS cluster names have format: arn:aws:eks:region:account:cluster/name
 * These contain special characters (:, /) that must be encoded for URLs
 */

import { API_BASE_URL } from '@/config/constants'

/**
 * Safely encode a string for use in a URL path segment
 * Handles null/undefined values gracefully
 */
function encode(value: string | undefined | null): string {
  if (!value) return ''
  return encodeURIComponent(value)
}

/**
 * Build WebSocket URL from HTTP base URL
 */
function getWsBaseUrl(): string {
  return API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://')
}

/**
 * Build a complete URL by prepending the API base URL
 */
export function buildUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path
  return `${API_BASE_URL}/${cleanPath}`
}

/**
 * Centralized API URL builder
 * All API endpoints should be defined here to ensure consistent encoding
 */
export const apiUrls = {
  // Pod endpoints
  pods: {
    list: (context: string, namespace?: string) => 
      namespace 
        ? `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}`
        : `${API_BASE_URL}/api/v1/pods/${encode(context)}`,
    
    get: (context: string, namespace: string, name: string) => {
      const params = new URLSearchParams({
        context: context,
        namespace: namespace,
        name: name
      })
      return `${API_BASE_URL}/api/v1/pods/get?${params.toString()}`
    },
    
    logs: (context: string, namespace: string, name: string, container?: string) => {
      const params = new URLSearchParams({
        context: context,
        namespace: namespace,
        name: name
      })
      if (container) params.append('container', container)
      return `${API_BASE_URL}/api/v1/pods/logs?${params.toString()}`
    },
    
    exec: (context: string, namespace: string, name: string, container?: string) => {
      const params = new URLSearchParams({
        context: context,
        namespace: namespace,
        name: name
      })
      if (container) params.append('container', container)
      return `${API_BASE_URL}/api/v1/pods/exec?${params.toString()}`
    },
    
    execWs: (context: string, namespace: string, name: string, container?: string) => {
      const params = new URLSearchParams({
        context: context,
        namespace: namespace,
        name: name
      })
      if (container) params.append('container', container)
      return `${getWsBaseUrl()}/api/v1/pods/exec/ws?${params.toString()}`
    },
    
    delete: (context: string, namespace: string, name: string) => {
      const params = new URLSearchParams({
        context: context,
        namespace: namespace,
        name: name
      })
      return `${API_BASE_URL}/api/v1/pods/delete?${params.toString()}`
    },
  },
  
  // Deployment endpoints
  deployments: {
    list: (context: string, namespace?: string) =>
      namespace
        ? `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}`
        : `${API_BASE_URL}/api/v1/deployments/${encode(context)}`,
    
    get: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    update: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    scale: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}/${encode(name)}/scale`,
    
    restart: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}/${encode(name)}/restart`,
    
    delete: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/deployments/${encode(context)}/${encode(namespace)}/${encode(name)}`,
  },
  
  // Service endpoints
  services: {
    list: (context: string, namespace?: string) =>
      namespace
        ? `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}`
        : `${API_BASE_URL}/api/v1/services/${encode(context)}`,
    
    get: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    endpoints: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}/endpoints`,
    
    update: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    delete: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
  },
  
  // Namespace endpoints
  namespaces: {
    list: (context: string) =>
      `${API_BASE_URL}/api/v1/namespaces/${encode(context)}`,
  },
  
  // Resources endpoints (generic)
  resources: {
    list: (context: string) =>
      `${API_BASE_URL}/api/v1/resources/${encode(context)}`,
    
    pods: (context: string, namespace?: string) =>
      namespace
        ? `${API_BASE_URL}/api/v1/resources/${encode(context)}/pods?namespace=${encode(namespace)}`
        : `${API_BASE_URL}/api/v1/resources/${encode(context)}/pods`,
    
    events: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/resources/${encode(context)}/events/${encode(namespace)}/${encode(name)}`,
  },
  
  // Topology endpoints
  topology: {
    deployment: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/topology/deployment/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    cronjob: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/topology/cronjob/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    daemonset: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/topology/daemonset/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    job: (context: string, namespace: string, name: string) =>
      `${API_BASE_URL}/api/v1/topology/job/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    
    namespaces: (context: string) =>
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/namespaces`,
    
    deployments: (context: string, namespace: string) =>
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/${encode(namespace)}/deployments`,
    
    cronjobs: (context: string, namespace: string) =>
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/${encode(namespace)}/cronjobs`,
    
    daemonsets: (context: string, namespace: string) =>
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/${encode(namespace)}/daemonsets`,
    
    jobs: (context: string, namespace: string) =>
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/${encode(namespace)}/jobs`,
  },
  
  // Manifest endpoints
  manifests: {
    get: (context: string, name: string, params: { kind: string; apiVersion: string; namespace?: string }) => {
      const queryParams = new URLSearchParams()
      queryParams.append('context', context)
      queryParams.append('name', name)
      queryParams.append('kind', params.kind)
      queryParams.append('apiVersion', params.apiVersion)
      if (params.namespace) {
        queryParams.append('namespace', params.namespace)
      }
      return `${API_BASE_URL}/api/v1/manifests/get?${queryParams.toString()}`
    },
  },
  
  // Cluster endpoints
  clusters: {
    list: () => `${API_BASE_URL}/api/v1/clusters`,
    config: () => `${API_BASE_URL}/api/v1/clusters/config`,
    connect: () => `${API_BASE_URL}/api/v1/clusters/connect`,
    disconnect: () => `${API_BASE_URL}/api/v1/clusters/disconnect`,
    get: (context: string) => `${API_BASE_URL}/api/v1/clusters/info?context=${encode(context)}`,
    version: (context: string) => `${API_BASE_URL}/api/v1/clusters/${encode(context)}/version`,
  },
}

/**
 * Helper function to build URLs with query parameters
 */
export function buildUrlWithParams(baseUrl: string, params: Record<string, string | undefined>): string {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value)
    }
  })
  return url.toString()
}

/**
 * Export the encode function for cases where direct encoding is needed
 */
export { encode as encodeUrlParam }