import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  ConnectionMode,
  Panel,
  BackgroundVariant,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { uniqueNodeTypes } from './UniqueRBACNodes';

// Type definitions for ReactFlow v11
type Node = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  targetPosition?: Position;
  sourcePosition?: Position;
};

type Edge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
};
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Maximize,
  ZoomIn,
  ZoomOut,
  Home
} from 'lucide-react';
import type { RBACResources, RBACRole, RBACRoleBinding } from '../types';
import { formatAge } from '../../topology/utils/age-formatter';

interface RBACGraphViewProps {
  resources: RBACResources | null;
  onNodeClick?: (node: any) => void;
  filters?: any;
}


// Enhanced Layout configuration with better hierarchy
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Dynamic node sizes based on type and content - enhanced for unique design
const getNodeDimensions = (nodeType: string, hasExpandedContent: boolean = false) => {
  switch (nodeType) {
    case 'clusterRole':
      return { width: hasExpandedContent ? 450 : 380, height: hasExpandedContent ? 350 : 280 };
    case 'role':
      return { width: hasExpandedContent ? 400 : 340, height: hasExpandedContent ? 320 : 240 };
    case 'serviceAccount':
      return { width: 300, height: 180 };
    case 'subject':
      return { width: 280, height: 120 };
    case 'binding':
      return { width: 220, height: 80 };
    case 'pod':
      return { width: 250, height: 140 };
    default:
      return { width: 320, height: 160 };
  }
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  
  // Clear the graph before adding new nodes/edges
  dagreGraph.nodes().forEach(n => dagreGraph.removeNode(n));
  
  // Enhanced layout with optimized spacing to avoid overlaps
  dagreGraph.setGraph({ 
    rankdir: direction, 
    nodesep: isHorizontal ? 280 : 200,  // Increased space between nodes
    ranksep: isHorizontal ? 400 : 300,  // Increased space between ranks
    marginx: 150, 
    marginy: 150,
    edgesep: 50,  // Space between edges
    acyclicer: 'greedy',  // Better cycle handling
    ranker: 'network-simplex'  // Better node placement algorithm
  });

  // Set node dimensions dynamically based on type
  nodes.forEach((node) => {
    const dimensions = getNodeDimensions(node.type || 'default');
    dagreGraph.setNode(node.id, dimensions);
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Create hierarchical positioning with role importance
  const layoutedNodes = nodes.map((node, index) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const dimensions = getNodeDimensions(node.type || 'default');
    
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // Handle nodes that dagre couldn't position (e.g., disconnected pods)
    if (nodeWithPosition) {
      node.position = {
        x: nodeWithPosition.x - dimensions.width / 2,
        y: nodeWithPosition.y - dimensions.height / 2,
      };
    } else {
      // Provide default position for orphaned nodes (arrange them at the bottom)
      console.warn(`Node ${node.id} (type: ${node.type}) has no position from dagre, using fallback`);
      const orphanedNodes = nodes.filter((n, i) => i <= index && !dagreGraph.node(n.id));
      const orphanedIndex = orphanedNodes.length - 1;
      const row = Math.floor(orphanedIndex / 5);
      const col = orphanedIndex % 5;
      node.position = {
        x: 100 + (col * 350),  // Horizontal spacing
        y: 600 + (row * 180),  // Place at visible area
      };
    }

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export default function RBACGraphView({ resources, onNodeClick, filters = {} }: RBACGraphViewProps) {
  const layoutedElements = useMemo(() => {
    if (!resources) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeIdMap = new Map<string, string>();

    // Filter function for search
    const matchesSearch = (text: string) => {
      if (!filters.searchTerm) return true;
      return text.toLowerCase().includes(filters.searchTerm.toLowerCase());
    };

    // Determine which resources to show based on filterType and filterValue
    let filteredResources = { ...resources };
    let allowedSubjects = new Set<string>();
    let allowedRoles = new Set<string>();
    let allowedClusterRoles = new Set<string>();

    if (filters.filterType && filters.filterValue) {
      if (filters.filterType === 'serviceAccount') {
        // Find all bindings that include this service account
        const saName = filters.filterValue.split('/').pop();
        const saNamespace = filters.filterValue.includes('/') ? filters.filterValue.split('/')[0] : undefined;
        
        // Check ClusterRoleBindings
        resources.clusterRoleBindings.forEach(binding => {
          binding.subjects?.forEach(subject => {
            if (subject.kind === 'ServiceAccount' && 
                subject.name === saName &&
                (!saNamespace || subject.namespace === saNamespace)) {
              allowedClusterRoles.add(binding.roleRef.name);
              allowedSubjects.add(`ServiceAccount-${subject.name}-${subject.namespace || binding.metadata.namespace}`);
            }
          });
        });
        
        // Check RoleBindings
        resources.roleBindings.forEach(binding => {
          binding.subjects?.forEach(subject => {
            if (subject.kind === 'ServiceAccount' && 
                subject.name === saName &&
                (!saNamespace || subject.namespace === saNamespace || binding.metadata.namespace === saNamespace)) {
              if (binding.roleRef.kind === 'ClusterRole') {
                allowedClusterRoles.add(binding.roleRef.name);
              } else {
                allowedRoles.add(`${binding.metadata.namespace}/${binding.roleRef.name}`);
              }
              allowedSubjects.add(`ServiceAccount-${subject.name}-${subject.namespace || binding.metadata.namespace}`);
            }
          });
        });
        
        // Filter resources to only show relevant ones
        filteredResources.clusterRoles = resources.clusterRoles.filter(r => allowedClusterRoles.has(r.metadata.name));
        filteredResources.roles = resources.roles.filter(r => allowedRoles.has(`${r.metadata.namespace}/${r.metadata.name}`));
        filteredResources.clusterRoleBindings = resources.clusterRoleBindings.filter(b => 
          b.subjects?.some(s => s.kind === 'ServiceAccount' && s.name === saName && (!saNamespace || s.namespace === saNamespace))
        );
        filteredResources.roleBindings = resources.roleBindings.filter(b => 
          b.subjects?.some(s => s.kind === 'ServiceAccount' && s.name === saName && 
            (!saNamespace || s.namespace === saNamespace || b.metadata.namespace === saNamespace))
        );
        
      } else if (filters.filterType === 'role') {
        // Filter for a specific role
        const roleName = filters.filterValue.split('/').pop();
        const roleNamespace = filters.filterValue.includes('/') ? filters.filterValue.split('/')[0] : undefined;
        
        filteredResources.roles = resources.roles.filter(r => 
          r.metadata.name === roleName && (!roleNamespace || r.metadata.namespace === roleNamespace)
        );
        filteredResources.clusterRoles = [];
        filteredResources.roleBindings = resources.roleBindings.filter(b => 
          b.roleRef.name === roleName && b.roleRef.kind === 'Role' && 
          (!roleNamespace || b.metadata.namespace === roleNamespace)
        );
        filteredResources.clusterRoleBindings = [];
        
      } else if (filters.filterType === 'clusterRole') {
        // Filter for a specific cluster role
        filteredResources.clusterRoles = resources.clusterRoles.filter(r => r.metadata.name === filters.filterValue);
        filteredResources.roles = [];
        filteredResources.clusterRoleBindings = resources.clusterRoleBindings.filter(b => 
          b.roleRef.name === filters.filterValue && b.roleRef.kind === 'ClusterRole'
        );
        filteredResources.roleBindings = resources.roleBindings.filter(b => 
          b.roleRef.name === filters.filterValue && b.roleRef.kind === 'ClusterRole'
        );
      }
    }

    // Add ClusterRoles as nodes
    filteredResources.clusterRoles.forEach((role) => {
      // Apply filters
      if (!filters.showSystemRoles && role.metadata.name.startsWith('system:')) return;
      if (!matchesSearch(role.metadata.name)) return;
      const nodeId = `cr-${role.metadata.uid}`;
      nodeIdMap.set(role.metadata.name, nodeId);
      
      const bindings = filteredResources.clusterRoleBindings.filter(
        b => b.roleRef.name === role.metadata.name && b.roleRef.kind === 'ClusterRole'
      );
      
      nodes.push({
        id: nodeId,
        type: 'clusterRole',
        position: { x: 0, y: 0 },
        data: {
          label: role.metadata.name,
          rules: role.rules.length,
          bindings: bindings.length,
          role: role,
          context: resources?.context || 'default',
          namespace: role.metadata.namespace || '',
        },
      });
    });

    // Add Roles as nodes
    filteredResources.roles.forEach((role) => {
      // Apply filters
      if (!matchesSearch(role.metadata.name)) return;
      const nodeId = `r-${role.metadata.uid}`;
      nodeIdMap.set(`${role.metadata.namespace}/${role.metadata.name}`, nodeId);
      
      const bindings = filteredResources.roleBindings.filter(
        b => b.roleRef.name === role.metadata.name
      );
      
      nodes.push({
        id: nodeId,
        type: 'role',
        position: { x: 0, y: 0 },
        data: {
          label: role.metadata.name,
          namespace: role.metadata.namespace,
          rules: role.rules.length,
          bindings: bindings.length,
          role: role,
          context: resources?.context || 'default',
        },
      });
    });

    // Process bindings and add subject nodes
    const subjectNodes = new Map<string, Node>();
    
    // Process ClusterRoleBindings
    filteredResources.clusterRoleBindings.forEach((binding) => {
      const bindingId = `crb-${binding.metadata.uid}`;
      const roleId = nodeIdMap.get(binding.roleRef.name);
      
      if (roleId && binding.subjects) {
        // Add binding node (only if showBindings is true)
        if (filters.showBindings !== false) {
          nodes.push({
            id: bindingId,
            type: 'binding',
            position: { x: 0, y: 0 },
            data: {
              label: binding.metadata.name,
              type: 'ClusterRoleBinding',
              context: resources.context,
            },
          });
        }

        // Connect role to binding or directly to subjects
        const connectionSource = filters.showBindings !== false ? bindingId : roleId;
        
        if (filters.showBindings !== false) {
          edges.push({
            id: `${roleId}-${bindingId}`,
            source: roleId,
            target: bindingId,
            type: 'smoothstep',
            animated: true,
            style: { 
              stroke: '#3b82f6', 
              strokeWidth: 4,
              strokeDasharray: '8 4',
              opacity: 0.8
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#3b82f6',
              width: 24,
              height: 24
            },
          });
        }

        // Add subjects
        binding.subjects.forEach((subject, idx) => {
          // Apply subject filters
          if (subject.kind === 'ServiceAccount' && filters.showServiceAccounts === false) return;
          if (subject.kind === 'User' && filters.showUsers === false) return;
          if (subject.kind === 'Group' && filters.showGroups === false) return;
          
          // If we're filtering by serviceAccount, only show that specific service account
          if (filters.filterType === 'serviceAccount' && filters.filterValue) {
            const saName = filters.filterValue.split('/').pop();
            const saNamespace = filters.filterValue.includes('/') ? filters.filterValue.split('/')[0] : undefined;
            if (subject.kind !== 'ServiceAccount' || 
                subject.name !== saName || 
                (saNamespace && subject.namespace && subject.namespace !== saNamespace)) {
              return;
            }
          }
          
          const subjectKey = `${subject.kind}-${subject.name}`;
          let subjectId = `subject-${subjectKey}`;
          
          if (!subjectNodes.has(subjectKey)) {
            const subjectNode: Node = {
              id: subjectId,
              type: subject.kind === 'ServiceAccount' ? 'serviceAccount' : 'subject',
              position: { x: 0, y: 0 },
              data: {
                label: subject.name,
                kind: subject.kind,
                namespace: subject.namespace,
                context: resources?.context || 'default',
              },
            };
            subjectNodes.set(subjectKey, subjectNode);
            nodes.push(subjectNode);
          }

          // Connect binding to subject (or role directly to subject if bindings are hidden)
          edges.push({
            id: `${connectionSource}-${subjectId}-${idx}`,
            source: connectionSource,
            target: subjectId,
            type: 'smoothstep',
            style: { 
              stroke: '#f97316', 
              strokeWidth: 3,
              opacity: 0.7
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#f97316',
              width: 20,
              height: 20
            },
          });
        });
      }
    });

    // Process RoleBindings
    filteredResources.roleBindings.forEach((binding) => {
      const bindingId = `rb-${binding.metadata.uid}`;
      const roleId = nodeIdMap.get(`${binding.metadata.namespace}/${binding.roleRef.name}`) || 
                    nodeIdMap.get(binding.roleRef.name); // Could reference a ClusterRole
      
      if (roleId && binding.subjects) {
        // Add binding node (only if showBindings is true)
        if (filters.showBindings !== false) {
          nodes.push({
            id: bindingId,
            type: 'binding',
            position: { x: 0, y: 0 },
            data: {
              label: binding.metadata.name,
              type: 'RoleBinding',
              namespace: binding.metadata.namespace,
              context: resources.context,
            },
          });
        }

        // Connect role to binding or directly to subjects
        const connectionSource = filters.showBindings !== false ? bindingId : roleId;
        
        if (filters.showBindings !== false) {
          edges.push({
            id: `${roleId}-${bindingId}`,
            source: roleId,
            target: bindingId,
            type: 'smoothstep',
            animated: true,
            style: { 
              stroke: '#10b981', 
              strokeWidth: 4,
              strokeDasharray: '8 4',
              opacity: 0.8
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#10b981',
              width: 24,
              height: 24
            },
          });
        }

        // Add subjects
        binding.subjects.forEach((subject, idx) => {
          // Apply subject filters
          if (subject.kind === 'ServiceAccount' && filters.showServiceAccounts === false) return;
          if (subject.kind === 'User' && filters.showUsers === false) return;
          if (subject.kind === 'Group' && filters.showGroups === false) return;
          
          // If we're filtering by serviceAccount, only show that specific service account
          if (filters.filterType === 'serviceAccount' && filters.filterValue) {
            const saName = filters.filterValue.split('/').pop();
            const saNamespace = filters.filterValue.includes('/') ? filters.filterValue.split('/')[0] : undefined;
            const subjectNs = subject.namespace || binding.metadata.namespace;
            if (subject.kind !== 'ServiceAccount' || 
                subject.name !== saName || 
                (saNamespace && subjectNs !== saNamespace)) {
              return;
            }
          }
          
          const subjectKey = `${subject.kind}-${subject.name}-${binding.metadata.namespace}`;
          let subjectId = `subject-${subjectKey}`;
          
          if (!subjectNodes.has(subjectKey)) {
            const subjectNode: Node = {
              id: subjectId,
              type: subject.kind === 'ServiceAccount' ? 'serviceAccount' : 'subject',
              position: { x: 0, y: 0 },
              data: {
                label: subject.name,
                kind: subject.kind,
                namespace: subject.namespace || binding.metadata.namespace,
                context: resources?.context || 'default',
              },
            };
            subjectNodes.set(subjectKey, subjectNode);
            nodes.push(subjectNode);
          }

          // Connect binding to subject (or role directly to subject if bindings are hidden)
          edges.push({
            id: `${connectionSource}-${subjectId}-${idx}`,
            source: connectionSource,
            target: subjectId,
            type: 'smoothstep',
            style: { 
              stroke: '#f97316', 
              strokeWidth: 3,
              opacity: 0.7
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#f97316',
              width: 20,
              height: 20
            },
          });
        });
      }
    });

    // Add Pod nodes if available
    console.log('=== POD PROCESSING START ===');
    console.log('Pods available:', resources.pods?.length || 0);
    console.log('showPods filter:', filters.showPods);
    console.log('namespace filter:', filters.namespace);
    console.log('searchTerm:', filters.searchTerm);
    
    let podsAdded = 0;
    let podsFiltered = 0;
    
    if (resources.pods && filters.showPods !== false) {
      console.log('Processing', resources.pods.length, 'pods');
      resources.pods.forEach((pod: any, index: number) => {
        console.log(`\n--- Processing pod ${index + 1}/${resources.pods.length} ---`);
        console.log('Pod data:', pod);
        
        // Handle both API response formats
        const podName = pod.metadata?.name || pod.name;
        const podNamespace = pod.metadata?.namespace || pod.namespace;
        const podUid = pod.metadata?.uid || pod.uid || `${podNamespace}-${podName}`;
        const podStatus = pod.status?.phase || pod.status;
        
        // Check if pod has required data
        if (!podName) {
          console.warn('Pod missing name:', pod);
          podsFiltered++;
          return;
        }
        
        // Get service account (from spec or default)
        const serviceAccountName = pod.spec?.serviceAccountName || pod.spec?.serviceAccount || pod.serviceAccount || 'default';
        
        // Check if pod matches namespace filter
        if (filters.namespace && podNamespace !== filters.namespace) {
          console.log(`Pod ${podName} filtered out: namespace ${podNamespace} != ${filters.namespace}`);
          podsFiltered++;
          return;
        }
        
        // Check if pod matches search
        if (!matchesSearch(podName)) {
          console.log(`Pod ${podName} filtered out: doesn't match search term "${filters.searchTerm}"`);
          podsFiltered++;
          return;
        }
        
        const podId = `pod-${podUid}`;
        const saKey = `${podNamespace || 'default'}/${serviceAccountName}`;
        
        // Find the service account node
        let saNodeId: string | undefined;
        nodes.forEach(node => {
          if (node.type === 'serviceAccount' && 
              node.data.label === serviceAccountName &&
              node.data.namespace === podNamespace) {
            saNodeId = node.id;
          }
        });
        
        // If service account node doesn't exist, create it (for default SA)
        if (!saNodeId && serviceAccountName) {
          saNodeId = `sa-${podNamespace}-${serviceAccountName}`;
          const defaultSANode = {
            id: saNodeId,
            type: 'serviceAccount',
            position: { x: 0, y: 0 },
            data: {
              label: serviceAccountName,
              namespace: podNamespace,
              kind: 'ServiceAccount',
              isDefault: true, // Mark as implicitly created
              context: resources.context || 'default',
            },
          };
          nodes.push(defaultSANode);
          console.log(`Created implicit SA node for ${serviceAccountName} in namespace ${podNamespace}`);
        }
        
        // Log if we found a matching service account
        console.log(`Pod ${podName} looking for SA ${serviceAccountName} in namespace ${podNamespace}, found: ${saNodeId ? 'yes' : 'no'}`);
        
        // Prepare container information - handle simplified format
        const containers = pod.spec?.containers || pod.containers || [];
        const containerData = Array.isArray(containers) ? containers.map((container: any, idx: number) => {
          const containerStatus = pod.status?.containerStatuses?.find((cs: any) => cs.name === container.name);
          return {
            name: container.name || container || 'unknown',
            image: container.image || 'unknown',
            ready: containerStatus?.ready || false,
            restartCount: containerStatus?.restartCount || pod.restarts || 0,
            state: containerStatus?.state?.running ? 'Running' :
                   containerStatus?.state?.waiting ? containerStatus.state.waiting.reason :
                   containerStatus?.state?.terminated ? containerStatus.state.terminated.reason : 
                   'Unknown',
            resources: container.resources
          };
        }) : [];
        
        // Add pod node with detailed resource information
        const podNode = {
          id: podId,
          type: 'pod',
          position: { x: 0, y: 0 },
          data: {
            label: podName,
            namespace: podNamespace || 'default',
            serviceAccount: serviceAccountName,
            status: podStatus || 'Unknown',
            containers: containerData.length,
            resource: {
              name: podName,
              phase: podStatus || 'Unknown',
              containers: containerData,
              nodeName: pod.spec?.nodeName || pod.nodeName,
              podIP: pod.status?.podIP || pod.podIP,
              hostIP: pod.status?.hostIP || pod.hostIP,
              startTime: pod.status?.startTime || pod.startTime
            },
            age: formatAge(pod.status?.startTime || pod.metadata?.creationTimestamp || pod.creationTimestamp),
            context: resources.context || 'default',
          },
        };
        
        console.log(`Adding pod node: ${podName} (${podId})`);
        nodes.push(podNode);
        podsAdded++;
        
        // Connect pod to service account if found
        if (saNodeId) {
          edges.push({
            id: `${saNodeId}-${podId}`,
            source: saNodeId,
            target: podId,
            type: 'smoothstep',
            animated: true,
            style: { 
              stroke: '#8b5cf6',  // Purple for SA to Pod connection
              strokeWidth: 2,
              strokeDasharray: '4 2',
              opacity: 0.6
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#8b5cf6',
              width: 18,
              height: 18
            },
          });
        }
      });
      
      console.log('=== POD PROCESSING SUMMARY ===');
      console.log(`Total pods processed: ${resources.pods.length}`);
      console.log(`Pods added to graph: ${podsAdded}`);
      console.log(`Pods filtered out: ${podsFiltered}`);
    } else {
      console.log('Pod processing skipped:', {
        hasPods: !!resources.pods,
        showPods: filters.showPods,
        podsLength: resources.pods?.length || 0
      });
    }

    // Debug: Log the final nodes
    console.log('=== FINAL NODE SUMMARY ===');
    console.log('Total nodes:', nodes.length);
    const nodeTypeCounts = nodes.reduce((acc, node) => {
      acc[node.type || 'unknown'] = (acc[node.type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Node type breakdown:', nodeTypeCounts);
    console.log('Pod nodes specifically:', nodes.filter(n => n.type === 'pod').map(n => ({
      id: n.id,
      label: n.data.label,
      namespace: n.data.namespace,
      serviceAccount: n.data.serviceAccount
    })));
    
    return getLayoutedElements(nodes, edges);
  }, [resources, filters]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedElements.edges);

  const onNodeClickHandler = useCallback((event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      // Create a standardized node object for the click handler
      const clickNode = {
        id: node.id,
        label: node.data.label,
        type: node.type as 'role' | 'clusterRole' | 'user' | 'group' | 'serviceaccount',
        data: {
          ...node.data,
          namespace: node.data.namespace
        }
      };
      onNodeClick(clickNode);
    }
  }, [onNodeClick]);

  if (!resources) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No RBAC data available</p>
      </Card>
    );
  }

  return (
    <Card className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={uniqueNodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#e5e7eb" />
        <Controls position="top-left">
          <button className="react-flow__controls-button" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="react-flow__controls-button" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="react-flow__controls-button" title="Fit view">
            <Maximize className="w-4 h-4" />
          </button>
          <button className="react-flow__controls-button" title="Reset">
            <Home className="w-4 h-4" />
          </button>
        </Controls>
        <MiniMap 
          nodeColor={(node) => {
            switch(node.type) {
              case 'clusterRole': return 'rgb(59, 130, 246)';
              case 'role': return 'rgb(16, 185, 129)';
              case 'serviceAccount': return 'rgb(168, 85, 247)';
              case 'pod': return 'rgb(14, 165, 233)'; // Sky blue for pods
              case 'subject': return 'rgb(249, 115, 22)';
              case 'binding': return 'rgb(107, 114, 128)';
              default: return 'rgb(107, 114, 128)';
            }
          }}
          position="top-right"
          pannable
          zoomable
        />
      </ReactFlow>
    </Card>
  );
}