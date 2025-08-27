import type { DaemonSetTopology, DaemonSetSummary } from '../types/daemonset';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const daemonsetAPI = {
  // Get list of namespaces
  async getNamespaces(context: string): Promise<string[]> {
    const params = new URLSearchParams({ context });
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/namespaces?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch namespaces');
    }
    const data = await response.json();
    return data.namespaces || [];
  },

  // List all DaemonSets in a namespace
  async listDaemonSets(context: string, namespace: string): Promise<DaemonSetSummary[]> {
    const params = new URLSearchParams({ context, namespace });
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/daemonsets/list?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonsets');
    }
    const data = await response.json();
    return data.daemonsets || [];
  },

  // Get DaemonSet topology
  async getDaemonSetTopology(context: string, namespace: string, name: string): Promise<DaemonSetTopology> {
    const params = new URLSearchParams({ context, namespace, name });
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/daemonset?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonset topology');
    }
    return response.json();
  }
};