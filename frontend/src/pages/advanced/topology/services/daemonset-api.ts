import type { DaemonSetTopology, DaemonSetSummary } from '../types/daemonset';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const daemonsetAPI = {
  // Get list of namespaces
  async getNamespaces(context: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${context}/namespaces`);
    if (!response.ok) {
      throw new Error('Failed to fetch namespaces');
    }
    const data = await response.json();
    return data.namespaces || [];
  },

  // List all DaemonSets in a namespace
  async listDaemonSets(context: string, namespace: string): Promise<DaemonSetSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${context}/daemonsets?namespace=${namespace}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonsets');
    }
    const data = await response.json();
    return data.daemonsets || [];
  },

  // Get DaemonSet topology
  async getDaemonSetTopology(context: string, namespace: string, name: string): Promise<DaemonSetTopology> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${context}/daemonset/${namespace}/${name}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonset topology');
    }
    return response.json();
  }
};