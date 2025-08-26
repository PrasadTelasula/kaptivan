import { useMemo, useCallback, useEffect } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import type { 
  DeploymentTopology, 
  TopologyFilters, 
  TopologyViewOptions,
  TopologyNode,
  TopologyEdge 
} from '../types';
import type { DaemonSetTopology } from '../types/daemonset';
import type { CronJobTopology } from '../types/cronjob';
import { buildTopologyNodesEdges } from '../utils/topology-builder';
import { buildDaemonSetTopologyNodesEdges } from '../utils/daemonset-topology-builder';
import { buildJobTopologyGraph } from '../utils/job-topology-builder';
import { buildCronJobTopologyGraph } from '../utils/cronjob-topology-builder';
import { applyDagreLayout } from '../utils/layout';

export const useTopologyGraph = (
  topology: DeploymentTopology | DaemonSetTopology | CronJobTopology | any | null,
  filters: TopologyFilters,
  viewOptions: TopologyViewOptions,
  context?: string,
  isDaemonSet?: boolean,
  isJob?: boolean,
  isCronJob?: boolean
) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<TopologyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<TopologyEdge>([]);
  
  // Build and layout nodes/edges when topology or filters change
  useEffect(() => {
    if (!topology) {
      setNodes([]);
      setEdges([]);
      return;
    }
    
    console.log('🔄 Rebuilding React Flow nodes/edges from topology update');
    
    // Build nodes and edges from topology data based on type
    let rawNodes: TopologyNode[];
    let rawEdges: TopologyEdge[];
    
    if (isCronJob) {
      console.log('  Building CronJob topology');
      const result = buildCronJobTopologyGraph(topology as CronJobTopology, filters, viewOptions.layout, context || '');
      rawNodes = result.nodes;
      rawEdges = result.edges;
    } else if (isJob) {
      console.log('  Building Job topology');
      const result = buildJobTopologyGraph(topology, filters, viewOptions.layout, context || '');
      rawNodes = result.nodes;
      rawEdges = result.edges;
    } else if (isDaemonSet) {
      console.log('  Building DaemonSet topology');
      const result = buildDaemonSetTopologyNodesEdges(topology as DaemonSetTopology, filters, context, viewOptions.layout);
      rawNodes = result.nodes;
      rawEdges = result.edges;
    } else {
      console.log('  Topology replicasets:', (topology as DeploymentTopology).replicasets?.map(rs => `${rs.name}: ${rs.pods?.length || 0} pods`));
      const result = buildTopologyNodesEdges(topology as DeploymentTopology, filters, context, viewOptions.layout);
      rawNodes = result.nodes;
      rawEdges = result.edges;
    }
    
    // Apply layout algorithm based on view options
    let layoutedNodes: TopologyNode[];
    let layoutedEdges: TopologyEdge[];
    
    if (viewOptions.layout === 'radial') {
      // For radial layout, use the calculateRadialLayout function
      const centerNode = rawNodes.find(n => n.type === 'deployment' || n.type === 'daemonset' || n.type === 'job');
      if (centerNode) {
        // Set main resource at center
        centerNode.position = { x: 400, y: 300 };
        // Arrange other nodes in circles around it
        const otherNodes = rawNodes.filter(n => n.id !== centerNode.id);
        const radius = 250;
        const angleStep = (2 * Math.PI) / otherNodes.length;
        
        layoutedNodes = [
          centerNode,
          ...otherNodes.map((node, index) => ({
            ...node,
            position: {
              x: 400 + radius * Math.cos(index * angleStep),
              y: 300 + radius * Math.sin(index * angleStep)
            }
          }))
        ];
      } else {
        layoutedNodes = rawNodes;
      }
      layoutedEdges = rawEdges.map(edge => ({ ...edge, type: 'custom' }));
    } else {
      // Use dagre for horizontal and vertical layouts
      const result = applyDagreLayout(rawNodes, rawEdges, viewOptions);
      layoutedNodes = result.nodes;
      layoutedEdges = result.edges;
    }
    
    console.log(`  Setting ${layoutedNodes.length} nodes and ${layoutedEdges.length} edges`);
    
    // Force complete replacement of nodes and edges
    // This ensures stale edges are removed when nodes are deleted
    setNodes(() => layoutedNodes);
    setEdges(() => layoutedEdges);
  }, [topology, filters, viewOptions, context, isDaemonSet, isJob, setNodes, setEdges]);
  
  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === node.id
      }))
    );
  }, [setNodes]);
  
  // Fit view to show all nodes
  const fitView = useCallback(() => {
    // This will be handled by ReactFlow's fitView prop
    return true;
  }, []);
  
  // Get selected node
  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.selected);
  }, [nodes]);
  
  // Get node by ID
  const getNodeById = useCallback((nodeId: string) => {
    return nodes.find((node) => node.id === nodeId);
  }, [nodes]);
  
  // Get connected nodes
  const getConnectedNodes = useCallback((nodeId: string) => {
    const connectedNodeIds = new Set<string>();
    
    edges.forEach((edge) => {
      if (edge.source === nodeId) {
        connectedNodeIds.add(edge.target);
      }
      if (edge.target === nodeId) {
        connectedNodeIds.add(edge.source);
      }
    });
    
    return nodes.filter((node) => connectedNodeIds.has(node.id));
  }, [nodes, edges]);
  
  // Highlight path between nodes
  const highlightPath = useCallback((sourceId: string, targetId: string) => {
    const pathEdges = edges.filter(
      (edge) =>
        (edge.source === sourceId && edge.target === targetId) ||
        (edge.source === targetId && edge.target === sourceId)
    );
    
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: pathEdges.some((pe) => pe.id === edge.id),
        style: {
          ...edge.style,
          strokeWidth: pathEdges.some((pe) => pe.id === edge.id) ? 3 : 1
        }
      }))
    );
  }, [edges, setEdges]);
  
  // Clear highlights
  const clearHighlights = useCallback(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: false,
        style: {
          ...edge.style,
          strokeWidth: 1
        }
      }))
    );
  }, [setEdges]);
  
  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    fitView,
    selectedNode,
    getNodeById,
    getConnectedNodes,
    highlightPath,
    clearHighlights
  };
};