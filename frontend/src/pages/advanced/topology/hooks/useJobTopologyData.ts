import { useState, useEffect, useCallback, useRef } from 'react';
import { jobAPI } from '../services/job-api';
import type { JobTopology, JobSummary } from '../types/job';
import { TopologyWebSocketClient } from '../services/topology-websocket';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useJobTopologyData(clusterContext: string) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [topology, setTopology] = useState<JobTopology | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsClientRef = useRef<TopologyWebSocketClient | null>(null);

  // Fetch namespaces
  useEffect(() => {
    if (!clusterContext) return;

    const fetchNamespaces = async () => {
      try {
        const ns = await jobAPI.getNamespaces(clusterContext);
        setNamespaces(ns);
        if (ns.length > 0 && !selectedNamespace) {
          setSelectedNamespace(ns[0]);
        }
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
        setError('Failed to fetch namespaces');
      }
    };

    fetchNamespaces();
  }, [clusterContext]);

  // Fetch jobs when namespace changes
  useEffect(() => {
    if (!clusterContext || !selectedNamespace) return;

    const fetchJobs = async () => {
      try {
        const jobList = await jobAPI.listJobs(clusterContext, selectedNamespace);
        setJobs(jobList);
        
        // Auto-select first job if available
        if (jobList.length > 0 && !selectedJob) {
          setSelectedJob(jobList[0].name);
        } else if (jobList.length === 0) {
          setSelectedJob('');
          setTopology(null);
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError('Failed to fetch jobs');
        setJobs([]);
      }
    };

    fetchJobs();
  }, [clusterContext, selectedNamespace]);

  // Fetch topology when job changes
  useEffect(() => {
    if (!clusterContext || !selectedNamespace || !selectedJob) {
      setTopology(null);
      return;
    }

    const fetchTopology = async () => {
      setLoading(true);
      setError(null);
      try {
        const topo = await jobAPI.getJobTopology(clusterContext, selectedNamespace, selectedJob);
        setTopology(topo);
      } catch (err) {
        console.error('Failed to fetch job topology:', err);
        setError('Failed to fetch job topology');
        setTopology(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTopology();
  }, [clusterContext, selectedNamespace, selectedJob]);

  // Define refresh function early so it can be used in WebSocket handler
  const refresh = useCallback(async () => {
    if (!clusterContext || !selectedNamespace || !selectedJob) return;
    
    setLoading(true);
    try {
      const topo = await jobAPI.getJobTopology(clusterContext, selectedNamespace, selectedJob);
      setTopology(topo);
      
      // Also refresh job list
      const jobList = await jobAPI.listJobs(clusterContext, selectedNamespace);
      setJobs(jobList);
    } catch (err) {
      console.error('Failed to refresh topology:', err);
      setError('Failed to refresh topology');
    } finally {
      setLoading(false);
    }
  }, [clusterContext, selectedNamespace, selectedJob]);

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    if (!clusterContext || !selectedNamespace || !selectedJob) {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
      return;
    }

    // Create WebSocket client
    const wsClient = new TopologyWebSocketClient(
      API_BASE_URL,
      clusterContext,
      selectedNamespace,
      selectedJob,
      'job'
    );

    // Subscribe to updates
    const unsubscribe = wsClient.onUpdate((update) => {
      console.log('Received Job topology update:', update);
      
      // Handle updates for different resource types
      update.changes.forEach(change => {
        if (change.resourceType === 'job' && change.resourceId === selectedJob) {
          // Job itself was updated - refresh the whole topology
          refresh();
        } else if (change.resourceType === 'pod') {
          // Pod was updated - refresh topology to get updated pod status
          refresh();
        }
      });
    });

    // Connect to WebSocket
    wsClient.connect();
    wsClientRef.current = wsClient;

    // Cleanup on unmount or when dependencies change
    return () => {
      unsubscribe();
      wsClient.disconnect();
      if (wsClientRef.current === wsClient) {
        wsClientRef.current = null;
      }
    };
  }, [clusterContext, selectedNamespace, selectedJob, refresh]);

  const selectNamespace = useCallback((namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedJob(''); // Reset job selection when namespace changes
  }, []);

  const selectJob = useCallback((job: string) => {
    setSelectedJob(job);
  }, []);

  return {
    namespaces,
    jobs,
    topology,
    selectedNamespace,
    selectedJob,
    selectNamespace,
    selectJob,
    refresh,
    loading,
    error
  };
}