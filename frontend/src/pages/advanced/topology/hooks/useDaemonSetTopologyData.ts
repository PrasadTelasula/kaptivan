import { useState, useEffect, useCallback } from 'react';
import { daemonsetAPI } from '../services/daemonset-api';
import type { DaemonSetTopology, DaemonSetSummary } from '../types/daemonset';

export const useDaemonSetTopologyData = (context: string | null) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [daemonsets, setDaemonsets] = useState<DaemonSetSummary[]>([]);
  const [topology, setTopology] = useState<DaemonSetTopology | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedDaemonSet, setSelectedDaemonSet] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch namespaces when context changes
  useEffect(() => {
    if (!context) return;
    
    const fetchNamespaces = async () => {
      try {
        setError(null);
        const data = await daemonsetAPI.getNamespaces(context);
        setNamespaces(data);
        
        // Auto-select first namespace if available
        if (data.length > 0 && !selectedNamespace) {
          setSelectedNamespace(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
        setError('Failed to fetch namespaces');
      }
    };
    
    fetchNamespaces();
  }, [context]); // selectedNamespace removed from deps to prevent loop

  // Fetch daemonsets when namespace changes
  useEffect(() => {
    if (!context || !selectedNamespace) return;
    
    const fetchDaemonSets = async () => {
      try {
        setError(null);
        const data = await daemonsetAPI.listDaemonSets(context, selectedNamespace);
        setDaemonsets(data);
        
        // Auto-select first daemonset if available
        if (data.length > 0 && !selectedDaemonSet) {
          setSelectedDaemonSet(data[0].name);
        } else if (data.length === 0) {
          setSelectedDaemonSet('');
          setTopology(null);
        }
      } catch (err) {
        console.error('Failed to fetch daemonsets:', err);
        setError('Failed to fetch daemonsets');
      }
    };
    
    fetchDaemonSets();
  }, [context, selectedNamespace]); // selectedDaemonSet removed from deps to prevent loop

  // Fetch topology when daemonset selection changes
  useEffect(() => {
    if (!context || !selectedNamespace || !selectedDaemonSet) {
      setTopology(null);
      return;
    }
    
    const fetchTopology = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await daemonsetAPI.getDaemonSetTopology(
          context,
          selectedNamespace,
          selectedDaemonSet
        );
        setTopology(data);
      } catch (err) {
        console.error('Failed to fetch topology:', err);
        setError('Failed to fetch daemonset topology');
        setTopology(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopology();
  }, [context, selectedNamespace, selectedDaemonSet]);

  // Handlers
  const selectNamespace = useCallback((namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedDaemonSet(''); // Reset daemonset selection
  }, []);

  const selectDaemonSet = useCallback((daemonset: string) => {
    setSelectedDaemonSet(daemonset);
  }, []);

  const refresh = useCallback(async () => {
    if (!context || !selectedNamespace || !selectedDaemonSet) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await daemonsetAPI.getDaemonSetTopology(
        context,
        selectedNamespace,
        selectedDaemonSet
      );
      setTopology(data);
    } catch (err) {
      console.error('Failed to refresh topology:', err);
      setError('Failed to refresh topology');
    } finally {
      setLoading(false);
    }
  }, [context, selectedNamespace, selectedDaemonSet]);

  return {
    namespaces,
    daemonsets,
    topology,
    selectedNamespace,
    selectedDaemonSet,
    selectNamespace,
    selectDaemonSet,
    refresh,
    loading,
    error
  };
};