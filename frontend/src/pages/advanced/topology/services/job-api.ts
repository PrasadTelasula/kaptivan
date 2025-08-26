import type { JobTopology, JobSummary } from '../types/job';
import { encodeClusterName, encodeNamespace, encodeResourceName } from '../../../../utils/url-encoding';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const jobAPI = {
  // Get list of namespaces
  async getNamespaces(context: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/namespaces`);
    if (!response.ok) {
      throw new Error('Failed to fetch namespaces');
    }
    const data = await response.json();
    return data.namespaces || [];
  },

  // List all Jobs in a namespace
  async listJobs(context: string, namespace: string): Promise<JobSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/jobs?namespace=${encodeNamespace(namespace)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch jobs');
    }
    const data = await response.json();
    return data.jobs || [];
  },

  // Get Job topology
  async getJobTopology(context: string, namespace: string, name: string): Promise<JobTopology> {
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/${encodeClusterName(context)}/job/${encodeNamespace(namespace)}/${encodeResourceName(name)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch job topology');
    }
    return response.json();
  }
};