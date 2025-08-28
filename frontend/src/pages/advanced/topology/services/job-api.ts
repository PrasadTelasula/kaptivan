import type { JobTopology, JobSummary } from '../types/job';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const jobAPI = {
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

  // List all Jobs in a namespace
  async listJobs(context: string, namespace: string): Promise<JobSummary[]> {
    const params = new URLSearchParams({ context, namespace });
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/jobs/list?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch jobs');
    }
    const data = await response.json();
    return data.jobs || [];
  },

  // Get Job topology
  async getJobTopology(context: string, namespace: string, name: string): Promise<JobTopology> {
    const params = new URLSearchParams({ context, namespace, name });
    const response = await fetch(`${API_BASE_URL}/api/v1/topology/job?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch job topology');
    }
    return response.json();
  }
};