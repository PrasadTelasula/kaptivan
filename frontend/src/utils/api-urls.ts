/**
 * Centralized API URL builder for all Kubernetes resources
 * Handles URL encoding and provides a single source of truth for all API endpoints
 */

import { API_BASE_URL } from '@/config/constants';

/**
 * Safely encodes URL parameters to handle special characters
 * Especially important for EKS cluster ARNs like: arn:aws:eks:us-west-2:123456:cluster/name
 */
function encode(value: string | undefined): string {
  return value ? encodeURIComponent(value) : '';
}

/**
 * Builds query string from parameters object
 */
function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const query = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

/**
 * Centralized API URL builder
 * All URL construction and encoding logic is handled here
 */
export const apiUrls = {
  // Base URL for HTTP requests
  base: API_BASE_URL,
  
  // Base URL for WebSocket connections
  wsBase: API_BASE_URL.replace('http', 'ws'),

  // Cluster endpoints
  clusters: {
    list: () => `${API_BASE_URL}/api/v1/clusters`,
    listFromConfig: () => `${API_BASE_URL}/api/v1/clusters/config`,
    connect: () => `${API_BASE_URL}/api/v1/clusters/connect`,
    disconnect: () => `${API_BASE_URL}/api/v1/clusters/disconnect`,
    get: (context: string) => `${API_BASE_URL}/api/v1/clusters/${encode(context)}`,
  },

  // Pod endpoints
  pods: {
    list: () => `${API_BASE_URL}/api/v1/pods/list`,
    get: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    logs: (context: string, namespace: string, name: string, params?: { container?: string; tailLines?: number; follow?: boolean }) => 
      `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}/logs${buildQuery(params)}`,
    events: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}/events`,
    delete: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    exec: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}/exec`,
    
    // WebSocket endpoints
    execWs: (context: string, namespace: string, name: string, container?: string) => {
      const base = `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}/exec/ws`;
      return container ? `${base}?container=${encodeURIComponent(container)}` : base;
    },
    logsWs: (context: string, namespace: string, name: string, params?: { container?: string; tailLines?: number; follow?: boolean }) => 
      `${API_BASE_URL.replace('http', 'ws')}/api/v1/pods/${encode(context)}/${encode(namespace)}/${encode(name)}/logs/ws${buildQuery(params)}`,
  },

  // Deployment endpoints
  deployments: {
    list: () => `${API_BASE_URL}/api/v1/deployments/list`,
    get: (context: string, namespace: string, name: string) => 
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
    list: () => `${API_BASE_URL}/api/v1/services/list`,
    get: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    endpoints: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}/endpoints`,
    update: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
    delete: (context: string, namespace: string, name: string) => 
      `${API_BASE_URL}/api/v1/services/${encode(context)}/${encode(namespace)}/${encode(name)}`,
  },

  // Topology endpoints
  topology: {
    namespaces: (context: string) => 
      `${API_BASE_URL}/api/v1/topology/${encode(context)}/namespaces`,
    
    // Deployment topology
    deployments: {
      list: (context: string, namespace?: string) => 
        namespace 
          ? `${API_BASE_URL}/api/v1/topology/${encode(context)}/deployments?namespace=${encode(namespace)}`
          : `${API_BASE_URL}/api/v1/topology/${encode(context)}/deployments`,
      get: (context: string, namespace: string, name: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/deployment/${encode(namespace)}/${encode(name)}`,
    },
    
    // CronJob topology
    cronjobs: {
      list: (context: string, namespace: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/cronjobs?namespace=${encode(namespace)}`,
      get: (context: string, namespace: string, name: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/cronjob/${encode(namespace)}/${encode(name)}`,
    },
    
    // DaemonSet topology
    daemonsets: {
      list: (context: string, namespace: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/daemonsets?namespace=${encode(namespace)}`,
      get: (context: string, namespace: string, name: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/daemonset/${encode(namespace)}/${encode(name)}`,
    },
    
    // Job topology
    jobs: {
      list: (context: string, namespace: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/jobs?namespace=${encode(namespace)}`,
      get: (context: string, namespace: string, name: string) => 
        `${API_BASE_URL}/api/v1/topology/${encode(context)}/job/${encode(namespace)}/${encode(name)}`,
    },
  },

  // Manifest endpoints
  manifests: {
    discover: () => `${API_BASE_URL}/api/v1/manifests/discover`,
    list: () => `${API_BASE_URL}/api/v1/manifests/list`,
    get: (context: string, resourceName: string, params?: { group?: string; version?: string; kind?: string; namespace?: string; name?: string }) => 
      `${API_BASE_URL}/api/v1/manifests/${encode(context)}/${encode(resourceName)}${buildQuery(params)}`,
    related: (context: string, resourceName: string, params?: { group?: string; version?: string; kind?: string; namespace?: string; name?: string }) => 
      `${API_BASE_URL}/api/v1/manifests/${encode(context)}/${encode(resourceName)}/related${buildQuery(params)}`,
  },

  // Legacy resource endpoints
  resources: {
    pods: () => `${API_BASE_URL}/api/v1/resources/pods`,
    deployments: () => `${API_BASE_URL}/api/v1/resources/deployments`,
    services: () => `${API_BASE_URL}/api/v1/resources/services`,
    namespaces: () => `${API_BASE_URL}/api/v1/resources/namespaces`,
    nodes: () => `${API_BASE_URL}/api/v1/resources/nodes`,
  },
};

// Type-safe helper to ensure all required parameters are provided
export type ApiUrlBuilder = typeof apiUrls;