import type { DeploymentTopology } from '../types';
import { apiUrls } from '../../../../utils/api-urls';

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
  constructor() {
    // baseUrl is no longer needed as we use apiUrls
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
      const url = apiUrls.topology.namespaces(clusterContext);
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
      const url = apiUrls.topology.deployments.list(clusterContext, namespace);
        
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
      const response = await this.fetchWithAuth(
        apiUrls.topology.deployments.get(clusterContext, namespace, deploymentName)
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