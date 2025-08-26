import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeploymentTopology } from '../types';
import { topologyAPI } from '../services/topology-api';
import type { DeploymentSummary } from '../services/topology-api';
import { TopologyWebSocketClient, type TopologyUpdate, type ResourceChange } from '../services/topology-websocket';

interface UseTopologyDataReturn {
  // Data
  namespaces: string[];
  deployments: DeploymentSummary[];
  topology: DeploymentTopology | null;
  
  // Selection
  selectedNamespace: string;
  selectedDeployment: string;
  
  // Actions
  selectNamespace: (namespace: string) => void;
  selectDeployment: (deployment: string) => void;
  refresh: () => void;
  
  // State
  loading: boolean;
  error: string | null;
}

export const useTopologyData = (selectedCluster: string | null = null): UseTopologyDataReturn => {
  // Data states
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const [topology, setTopology] = useState<DeploymentTopology | null>(null);
  
  // Selection states
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedDeployment, setSelectedDeployment] = useState<string>('');
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // WebSocket reference
  const wsClientRef = useRef<TopologyWebSocketClient | null>(null);
  
  // Fetch namespaces when cluster changes
  useEffect(() => {
    const fetchNamespaces = async () => {
      if (!selectedCluster) {
        console.log('No cluster selected, clearing data');
        setError('No Kubernetes cluster selected. Please select a cluster first.');
        setNamespaces([]);
        setDeployments([]);
        setTopology(null);
        setSelectedNamespace('');
        setSelectedDeployment('');
        return;
      }
      
      try {
        console.log('Fetching namespaces for cluster:', selectedCluster);
        setError(null);
        // Reset selections when cluster changes
        setSelectedNamespace('');
        setSelectedDeployment('');
        setTopology(null);
        
        // Fetch namespaces for the selected cluster
        const namespaceList = await topologyAPI.getNamespaces(selectedCluster);
        console.log('Received namespaces:', namespaceList);
        setNamespaces(namespaceList);
        
        // Auto-select first namespace if available
        if (namespaceList.length > 0) {
          setSelectedNamespace(namespaceList[0]);
        }
      } catch (err) {
        setError('Failed to fetch namespaces');
        console.error('Error fetching namespaces:', err);
      }
    };
    
    fetchNamespaces();
  }, [selectedCluster]);
  
  // Fetch deployments when namespace changes
  useEffect(() => {
    if (!selectedNamespace || !selectedCluster) return;
    
    const fetchDeployments = async () => {
      try {
        setLoading(true);
        const deploymentList = await topologyAPI.listDeployments(selectedCluster, selectedNamespace);
        setDeployments(deploymentList);
        
        // Auto-select first deployment if available
        if (deploymentList.length > 0 && !selectedDeployment) {
          setSelectedDeployment(deploymentList[0].name);
        }
      } catch (err) {
        setError('Failed to fetch deployments');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeployments();
  }, [selectedNamespace, selectedCluster]);
  
  // Handle WebSocket updates
  const handleWebSocketUpdate = useCallback((update: TopologyUpdate) => {
    console.log('🔄 WebSocket update received:', update);
    console.log('  Changes:', update.changes.length);
    update.changes.forEach(change => {
      console.log(`  - ${change.type} ${change.resourceType}: ${change.resourceId}`);
    });
    
    setTopology(prevTopology => {
      if (!prevTopology) return prevTopology;
      
      // Deep clone the topology to ensure React detects all changes
      const newTopology = JSON.parse(JSON.stringify(prevTopology));
      
      update.changes.forEach((change: ResourceChange) => {
        // Normalize event type to lowercase for consistent comparison
        const eventType = change.type.toLowerCase();
        
        switch (change.resourceType) {
          case 'deployment':
            if (eventType === 'modified' && change.data) {
              // Update deployment data (flat structure)
              if (newTopology.deployment && newTopology.deployment.name === change.resourceId) {
                if (change.data.replicas !== undefined) {
                  newTopology.deployment.replicas = change.data.replicas;
                }
                if (change.data.available !== undefined) {
                  newTopology.deployment.available = change.data.available;
                }
                if (change.data.ready !== undefined) {
                  newTopology.deployment.ready = change.data.ready;
                }
              }
            }
            break;
            
          case 'pod':
            // Pods are nested within replicasets in our topology structure
            if (!newTopology.replicasets) break;
            
            if (eventType === 'added' && change.data) {
              // Add new pod to the appropriate replicaset based on ownership
              // Pod structure matches backend PodRef type (flat structure)
              const newPod = {
                name: change.data.name,
                phase: change.data.phase,
                containers: change.data.containers || [],
                nodeName: change.data.nodeName,
                hostIP: change.data.hostIP,
                podIP: change.data.podIP
              };
              
              // Find the correct ReplicaSet based on ownership
              const ownerReplicaSet = change.data.ownerReplicaSet;
              if (ownerReplicaSet) {
                const targetRS = newTopology.replicasets.find(rs => rs.name === ownerReplicaSet);
                if (targetRS) {
                  console.log(`Adding pod ${change.data.name} to its owner ReplicaSet ${ownerReplicaSet}`);
                  targetRS.pods = [...(targetRS.pods || []), newPod];
                } else {
                  console.warn(`Owner ReplicaSet ${ownerReplicaSet} not found for pod ${change.data.name}`);
                  // If owner RS not found but we have RSs, add to first one as fallback
                  if (newTopology.replicasets.length > 0) {
                    newTopology.replicasets[0].pods = [...(newTopology.replicasets[0].pods || []), newPod];
                  }
                }
              } else {
                // No owner specified, add to first replicaset as fallback
                console.warn(`No owner ReplicaSet specified for pod ${change.data.name}`);
                if (newTopology.replicasets.length > 0) {
                  newTopology.replicasets[0].pods = [...(newTopology.replicasets[0].pods || []), newPod];
                }
              }
            } else if (eventType === 'modified') {
              // Update existing pod in the correct replicaset
              const ownerReplicaSet = change.data?.ownerReplicaSet;
              
              if (ownerReplicaSet) {
                // Update pod only in its owner ReplicaSet
                const targetRS = newTopology.replicasets.find(rs => rs.name === ownerReplicaSet);
                if (targetRS) {
                  targetRS.pods = targetRS.pods.map(pod => {
                    if (pod.name === change.resourceId) {
                      // Update pod fields directly (flat structure)
                      if (change.data?.phase !== undefined) {
                        pod.phase = change.data.phase;
                      }
                      if (change.data?.podIP !== undefined) {
                        pod.podIP = change.data.podIP;
                      }
                      if (change.data?.hostIP !== undefined) {
                        pod.hostIP = change.data.hostIP;
                      }
                      if (change.data?.nodeName !== undefined) {
                        pod.nodeName = change.data.nodeName;
                      }
                      if (change.data?.containers) {
                        pod.containers = change.data.containers;
                        // Debug: log container resources update
                        console.log(`Updated containers for pod ${pod.name}:`, 
                          change.data.containers.map((c: any) => ({
                            name: c.name,
                            cpu: c.resources?.requests?.cpu,
                            memory: c.resources?.requests?.memory
                          }))
                        );
                      }
                    }
                    return pod;
                  });
                }
              } else {
                // No owner specified, update in all replicasets (fallback behavior)
                newTopology.replicasets.forEach(rs => {
                  rs.pods = rs.pods.map(pod => {
                    if (pod.name === change.resourceId) {
                      // Update pod fields directly (flat structure)
                      if (change.data?.phase !== undefined) {
                        pod.phase = change.data.phase;
                      }
                      if (change.data?.podIP !== undefined) {
                        pod.podIP = change.data.podIP;
                      }
                      if (change.data?.hostIP !== undefined) {
                        pod.hostIP = change.data.hostIP;
                      }
                      if (change.data?.nodeName !== undefined) {
                        pod.nodeName = change.data.nodeName;
                      }
                      if (change.data?.containers) {
                        pod.containers = change.data.containers;
                        // Debug: log container resources update
                        console.log(`Updated containers for pod ${pod.name}:`, 
                          change.data.containers.map((c: any) => ({
                            name: c.name,
                            cpu: c.resources?.requests?.cpu,
                            memory: c.resources?.requests?.memory
                          }))
                        );
                      }
                    }
                    return pod;
                  });
                });
              }
            } else if (eventType === 'deleted') {
              // Remove deleted pod from all replicasets
              console.log(`Removing pod ${change.resourceId} from replicasets`);
              newTopology.replicasets.forEach(rs => {
                const originalLength = rs.pods.length;
                rs.pods = rs.pods.filter(pod => pod.name !== change.resourceId);
                if (originalLength !== rs.pods.length) {
                  console.log(`  ReplicaSet ${rs.name}: ${originalLength} pods -> ${rs.pods.length} pods`);
                }
              });
            }
            break;
            
          case 'service':
            if (!newTopology.services) newTopology.services = [];
            
            if (eventType === 'modified' && change.data) {
              newTopology.services.forEach(service => {
                if (service.name === change.resourceId) {
                  // Update service fields directly (flat structure)
                  if (change.data.type !== undefined) {
                    service.type = change.data.type;
                  }
                  if (change.data.clusterIP !== undefined) {
                    service.clusterIP = change.data.clusterIP;
                  }
                  if (change.data.ports) {
                    service.ports = change.data.ports;
                  }
                }
              });
            }
            break;
            
          case 'endpoints':
            if (!newTopology.endpoints) newTopology.endpoints = [];
            
            if (eventType === 'modified' && change.data) {
              const existingEndpoint = newTopology.endpoints.find(ep => ep.name === change.resourceId);
              if (existingEndpoint && change.data.addresses) {
                existingEndpoint.addresses = change.data.addresses;
              }
            }
            break;
            
          case 'replicaset':
            if (!newTopology.replicasets) newTopology.replicasets = [];
            
            if (eventType === 'added' && change.data) {
              // Add new replicaset (flat structure matching ReplicaSetRef)
              newTopology.replicasets.push({
                name: change.data.name,
                desired: change.data.replicas || 0,
                ready: change.data.ready || 0,
                available: change.data.available,
                pods: []  // New replicasets start with empty pods array
              });
            } else if (eventType === 'modified' && change.data) {
              newTopology.replicasets.forEach(rs => {
                if (rs.name === change.resourceId) {
                  // Update replicaset fields directly (flat structure)
                  if (change.data.replicas !== undefined) {
                    rs.desired = change.data.replicas;
                  }
                  if (change.data.ready !== undefined) {
                    rs.ready = change.data.ready;
                  }
                  if (change.data.available !== undefined) {
                    rs.available = change.data.available;
                  }
                }
              });
            } else if (eventType === 'deleted') {
              newTopology.replicasets = newTopology.replicasets.filter(rs => rs.name !== change.resourceId);
            }
            break;
        }
      });
      
      console.log('Updated topology - ReplicaSets:', newTopology.replicasets?.map(rs => `${rs.name}: ${rs.pods.length} pods`));
      return newTopology;
    });
  }, []);
  
  // Fetch topology when deployment changes
  useEffect(() => {
    if (!selectedNamespace || !selectedDeployment || !selectedCluster) return;
    
    const fetchTopology = async () => {
      try {
        setLoading(true);
        setError(null);
        const topologyData = await topologyAPI.getDeploymentTopology(
          selectedCluster,
          selectedNamespace,
          selectedDeployment
        );
        console.log('Topology data received:', topologyData);
        console.log('RBAC data check:', {
          roles: topologyData?.roles,
          roleBindings: topologyData?.roleBindings,
          clusterRoles: topologyData?.clusterRoles,
          clusterRoleBindings: topologyData?.clusterRoleBindings,
          endpoints: topologyData?.endpoints,
          serviceAccount: topologyData?.serviceAccount
        });
        setTopology(topologyData);
      } catch (err) {
        setError('Failed to fetch topology data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopology();
  }, [selectedNamespace, selectedDeployment, selectedCluster]);
  
  // Setup WebSocket connection
  useEffect(() => {
    // Cleanup previous connection
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    
    // Create new connection if we have all required params
    if (selectedCluster && selectedNamespace) {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const wsClient = new TopologyWebSocketClient(
        baseUrl,
        selectedCluster,
        selectedNamespace,
        selectedDeployment
      );
      
      wsClientRef.current = wsClient;
      wsClient.connect();
      
      // Subscribe to updates
      const unsubscribe = wsClient.onUpdate(handleWebSocketUpdate);
      
      return () => {
        unsubscribe();
        wsClient.disconnect();
      };
    }
  }, [selectedCluster, selectedNamespace, selectedDeployment, handleWebSocketUpdate]);
  
  // Action handlers
  const selectNamespace = useCallback((namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedDeployment(''); // Reset deployment selection
    setTopology(null); // Clear topology
  }, []);
  
  const selectDeployment = useCallback((deployment: string) => {
    setSelectedDeployment(deployment);
  }, []);
  
  const refresh = useCallback(async () => {
    if (!selectedCluster) {
      setError('No cluster selected');
      return;
    }
    
    if (!selectedNamespace) {
      setError('No namespace selected');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Refresh deployments list first
      const deploymentList = await topologyAPI.listDeployments(selectedCluster, selectedNamespace);
      setDeployments(deploymentList);
      
      // If a deployment is selected, refresh its topology
      if (selectedDeployment) {
        const topologyData = await topologyAPI.getDeploymentTopology(
          selectedCluster,
          selectedNamespace,
          selectedDeployment
        );
        setTopology(topologyData);
      }
    } catch (err) {
      setError('Failed to refresh');
      console.error('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace, selectedDeployment, selectedCluster]);
  
  return {
    // Data
    namespaces,
    deployments,
    topology,
    
    // Selection
    selectedNamespace,
    selectedDeployment,
    
    // Actions
    selectNamespace,
    selectDeployment,
    refresh,
    
    // State
    loading,
    error,
  };
};