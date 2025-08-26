const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ClusterInfo {
  name: string;
  context: string;
  connected: boolean;
}

class ClusterAPI {
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

  async listClusters(): Promise<ClusterInfo[]> {
    try {
      const response = await this.fetchWithAuth(`${this.baseUrl}/api/v1/clusters/config`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.statusText}`);
      }

      const data = await response.json();
      return data.clusters || [];
    } catch (error) {
      console.error('Error fetching clusters:', error);
      return [];
    }
  }

  async connectCluster(context: string): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth(`${this.baseUrl}/api/v1/clusters/connect`, {
        method: 'POST',
        body: JSON.stringify({ context }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to connect to cluster: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error connecting to cluster:', error);
      return false;
    }
  }

  // Get the first connected cluster or connect to the first available one
  async getActiveCluster(): Promise<string | null> {
    try {
      const clusters = await this.listClusters();
      
      // Find a connected cluster
      let activeCluster = clusters.find(c => c.connected);
      
      // If no cluster is connected, try to connect to the first one
      if (!activeCluster && clusters.length > 0) {
        const connected = await this.connectCluster(clusters[0].context);
        if (connected) {
          activeCluster = clusters[0];
        }
      }
      
      return activeCluster?.context || null;
    } catch (error) {
      console.error('Error getting active cluster:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const clusterAPI = new ClusterAPI();

export default ClusterAPI;