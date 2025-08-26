import { useState, useEffect, useCallback } from 'react';
import type { CronJobTopology, CronJobSummary } from '../types/cronjob';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface UseCronJobTopologyDataReturn {
  namespaces: string[];
  cronjobs: CronJobSummary[];
  topology: CronJobTopology | null;
  selectedNamespace: string;
  selectedCronJob: string;
  selectNamespace: (namespace: string) => void;
  selectCronJob: (cronJob: string) => void;
  refresh: () => void;
  loading: boolean;
  error: string | null;
}

export const useCronJobTopologyData = (context: string | null): UseCronJobTopologyDataReturn => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [cronjobs, setCronJobs] = useState<CronJobSummary[]>([]);
  const [topology, setTopology] = useState<CronJobTopology | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedCronJob, setSelectedCronJob] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch namespaces
  useEffect(() => {
    const fetchNamespaces = async () => {
      if (!context) {
        setNamespaces([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/topology/${context}/namespaces`);
        if (!response.ok) throw new Error('Failed to fetch namespaces');
        const data = await response.json();
        setNamespaces(data.namespaces || []);
        
        // Auto-select first namespace if available
        if (data.namespaces?.length > 0 && !selectedNamespace) {
          setSelectedNamespace(data.namespaces[0]);
        }
      } catch (err) {
        console.error('Error fetching namespaces:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch namespaces');
        setNamespaces([]);
      }
    };

    fetchNamespaces();
  }, [context]);

  // Fetch CronJobs when namespace changes
  useEffect(() => {
    const fetchCronJobs = async () => {
      if (!context || !selectedNamespace) {
        setCronJobs([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/topology/${context}/cronjobs?namespace=${selectedNamespace}`);
        if (!response.ok) throw new Error('Failed to fetch CronJobs');
        const data = await response.json();
        setCronJobs(data.cronjobs || []);
        
        // Auto-select first CronJob if available
        if (data.cronjobs?.length > 0 && !selectedCronJob) {
          setSelectedCronJob(data.cronjobs[0].name);
        }
      } catch (err) {
        console.error('Error fetching CronJobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch CronJobs');
        setCronJobs([]);
      }
    };

    fetchCronJobs();
    
    // Poll for CronJob list updates every 10 seconds
    const interval = setInterval(fetchCronJobs, 10000);
    
    return () => clearInterval(interval);
  }, [context, selectedNamespace, selectedCronJob]);

  // Fetch CronJob topology
  const fetchTopology = useCallback(async () => {
    if (!context || !selectedNamespace || !selectedCronJob) {
      setTopology(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/topology/${context}/cronjob/${selectedNamespace}/${selectedCronJob}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch CronJob topology');
      
      const data = await response.json();
      setTopology(data);
    } catch (err) {
      console.error('Error fetching CronJob topology:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch CronJob topology');
      setTopology(null);
    } finally {
      setLoading(false);
    }
  }, [context, selectedNamespace, selectedCronJob]);

  // Fetch topology when CronJob selection changes
  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // Set up polling for real-time updates (every 5 seconds)
  useEffect(() => {
    if (!context || !selectedNamespace || !selectedCronJob) {
      return;
    }

    // Fetch immediately
    fetchTopology();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchTopology();
    }, 5000); // Refresh every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [context, selectedNamespace, selectedCronJob, fetchTopology]);

  const selectNamespace = useCallback((namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedCronJob(''); // Reset CronJob selection
    setTopology(null);
  }, []);

  const selectCronJob = useCallback((cronJob: string) => {
    setSelectedCronJob(cronJob);
  }, []);

  const refresh = useCallback(() => {
    fetchTopology();
  }, [fetchTopology]);

  return {
    namespaces,
    cronjobs,
    topology,
    selectedNamespace,
    selectedCronJob,
    selectNamespace,
    selectCronJob,
    refresh,
    loading,
    error
  };
};