import type { DeploymentTopology } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface DeploymentSummary {
  name: string;
  namespace: string;
  replicas: number;
  ready: number;
}

export interface TopologyAPIResponse<T> {
  data?: T;
  error?: string;
}

class TopologyAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
    // Get token from zustand auth store
    const authStorage = localStorage.getItem('auth-storage');
    let token = null;
    
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage);
        token = authData.state?.token;
      } catch (e) {
        console.error('Failed to parse auth storage:', e);
      }
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async getNamespaces(clusterContext: string): Promise<string[]> {
    try {
      const params = new URLSearchParams({ context: clusterContext });
      const url = `${this.baseUrl}/api/v1/topology/namespaces?${params.toString()}`;
      console.log('Fetching namespaces from:', url);
      
      const response = await this.fetchWithAuth(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch namespaces:', response.status, errorText);
        throw new Error(`Failed to fetch namespaces: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Namespaces API response:', data);
      return data.namespaces || [];
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      return [];
    }
  }

  async listDeployments(clusterContext: string, namespace?: string): Promise<DeploymentSummary[]> {
    try {
      const params = new URLSearchParams({ context: clusterContext });
      if (namespace) params.append('namespace', namespace);
      const url = `${this.baseUrl}/api/v1/topology/deployments/list?${params.toString()}`;
        
      const response = await this.fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.statusText}`);
      }

      const data = await response.json();
      return data.deployments || [];
    } catch (error) {
      console.error('Error fetching deployments:', error);
      return [];
    }
  }

  async getDeploymentTopology(
    clusterContext: string, 
    namespace: string, 
    deploymentName: string
  ): Promise<DeploymentTopology | null> {
    try {
      const params = new URLSearchParams({
        context: clusterContext,
        namespace: namespace,
        name: deploymentName
      });
      const response = await this.fetchWithAuth(
        `${this.baseUrl}/api/v1/topology/deployment?${params.toString()}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch topology: ${response.statusText}`);
      }

      const data = await response.json();
      return data as DeploymentTopology;
    } catch (error) {
      console.error('Error fetching deployment topology:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const topologyAPI = new TopologyAPI();

// Export the class for testing
export default TopologyAPI;