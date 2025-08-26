import type { DaemonSetTopology, DaemonSetSummary } from '../types/daemonset';
import { encodeClusterName, encodeNamespace, encodeResourceName } from '../../../../utils/url-encoding';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const daemonsetAPI = {
  // Get list of namespaces
  async getNamespaces(context: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/namespaces`);
    if (!response.ok) {
      throw new Error('Failed to fetch namespaces');
    }
    const data = await response.json();
    return data.namespaces || [];
  },

  // List all DaemonSets in a namespace
  async listDaemonSets(context: string, namespace: string): Promise<DaemonSetSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/daemonsets?namespace=${encodeNamespace(namespace)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonsets');
    }
    const data = await response.json();
    return data.daemonsets || [];
  },

  // Get DaemonSet topology
  async getDaemonSetTopology(context: string, namespace: string, name: string): Promise<DaemonSetTopology> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/daemonset/${encodeNamespace(namespace)}/${encodeResourceName(name)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch daemonset topology');
    }
    return response.json();
  }
};