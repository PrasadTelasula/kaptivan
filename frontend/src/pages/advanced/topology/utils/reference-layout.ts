import type { TopologyNode, TopologyEdge } from '../types';

/**
 * Custom layout based on the reference diagram
 * Arranges nodes in specific positions matching the reference
 */
export const applyReferenceLayout = (
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): { nodes: TopologyNode[]; edges: TopologyEdge[] } => {
  const layoutedNodes = [...nodes];
  const nodeMap = new Map<string, TopologyNode>();
  
  // Create a map for quick lookup
  layoutedNodes.forEach(node => {
    nodeMap.set(node.id, node);
  });
  
  // Define grid spacing - increased to prevent overlapping
  const COLUMN_WIDTH = 400;  // Increased from 300 for more horizontal space
  const ROW_HEIGHT = 250;     // Increased from 180 for more vertical space
  const START_X = 100;
  const START_Y = 100;
  
  // Column positions with more spacing
  const COL_1 = START_X;
  const COL_2 = START_X + COLUMN_WIDTH;
  const COL_3 = START_X + COLUMN_WIDTH * 2;
  const COL_4 = START_X + COLUMN_WIDTH * 3;
  const COL_5 = START_X + COLUMN_WIDTH * 4;
  
  // Row positions with more spacing
  const ROW_1 = START_Y;
  const ROW_2 = START_Y + ROW_HEIGHT;
  const ROW_3 = START_Y + ROW_HEIGHT * 2;
  const ROW_4 = START_Y + ROW_HEIGHT * 3;
  const ROW_5 = START_Y + ROW_HEIGHT * 4;
  const ROW_6 = START_Y + ROW_HEIGHT * 5;
  const ROW_7 = START_Y + ROW_HEIGHT * 6;  // Extra row for better RBAC spacing
  
  // Position nodes according to reference diagram
  layoutedNodes.forEach(node => {
    // Deployment - Column 1, Row 2
    if (node.type === 'deployment') {
      node.position = { x: COL_1, y: ROW_2 };
    }
    
    // ReplicaSet - Column 2, Row 2
    else if (node.type === 'replicaset') {
      const index = layoutedNodes.filter(n => n.type === 'replicaset').indexOf(node);
      node.position = { x: COL_2, y: ROW_2 + (index * 80) };  // Increased spacing between multiple replicasets
    }
    
    // Pods - Column 3, properly spaced vertically
    else if (node.type === 'pod') {
      const podNodes = layoutedNodes.filter(n => n.type === 'pod');
      const index = podNodes.indexOf(node);
      // Space pods vertically with adequate spacing
      node.position = { x: COL_3, y: ROW_1 + (index * 150) };  // 150px spacing between pods
    }
    
    // Containers - Column 4, distributed near their pods
    else if (node.type === 'container') {
      const containerNodes = layoutedNodes.filter(n => n.type === 'container');
      const index = containerNodes.indexOf(node);
      const containerGroup = Math.floor(index / 2); // 2 containers per pod
      const containerIndex = index % 2;
      
      if (containerGroup === 0) {
        // First pod's containers
        node.position = { 
          x: COL_4, 
          y: ROW_1 - 40 + (containerIndex * 80)
        };
      } else {
        // Second pod's containers
        node.position = { 
          x: COL_4, 
          y: ROW_2 + ((containerGroup - 1) * ROW_HEIGHT) - 40 + (containerIndex * 80)
        };
      }
    }
    
    // Service - Column 1, Row 3 with better spacing
    else if (node.type === 'service') {
      const serviceNodes = layoutedNodes.filter(n => n.type === 'service');
      const index = serviceNodes.indexOf(node);
      node.position = { x: COL_1, y: ROW_3 + (index * 100) };  // Increased spacing between services
    }
    
    // Endpoints - Column 2, properly aligned with services
    else if (node.type === 'endpoints') {
      const endpointNodes = layoutedNodes.filter(n => n.type === 'endpoints');
      const index = endpointNodes.indexOf(node);
      node.position = { 
        x: COL_2, 
        y: ROW_3 + (index * 100)  // Match service spacing
      };
    }
    
    // ServiceAccount - Center top of RBAC section
    else if (node.type === 'serviceaccount') {
      node.position = { x: COL_2, y: ROW_5 };
    }
    
    // ConfigMap - Column 2, Row 4 with better spacing
    else if (node.type === 'configmap') {
      const configNodes = layoutedNodes.filter(n => n.type === 'configmap');
      const index = configNodes.indexOf(node);
      node.position = { x: COL_2, y: ROW_4 + (index * 100) };  // Increased spacing
    }
    
    // Secret - Column 2, Row 5 with better spacing
    else if (node.type === 'secret') {
      const secretNodes = layoutedNodes.filter(n => n.type === 'secret');
      const index = secretNodes.indexOf(node);
      node.position = { x: COL_2, y: ROW_5 + (index * 100) };  // Increased spacing
    }
    
    // RoleBindings - Middle layer, left side with offset for better edge visibility
    else if (node.type === 'rolebinding') {
      node.position = { x: COL_1 - 100, y: ROW_5 + 150 };  // Below and left of ServiceAccount
    }
    
    // ClusterRoleBindings - Middle layer, right side with offset for better edge visibility
    else if (node.type === 'clusterrolebinding') {
      const clusterBindingNodes = layoutedNodes.filter(n => n.type === 'clusterrolebinding');
      const index = clusterBindingNodes.indexOf(node);
      node.position = { x: COL_2 + 300 + (index * 300), y: ROW_5 + 150 };  // Below and right of ServiceAccount
    }
    
    // Roles - Bottom layer, below RoleBinding but slightly offset
    else if (node.type === 'role') {
      node.position = { x: COL_1 - 100, y: ROW_5 + 350 };  // Below RoleBinding with more spacing
    }
    
    // ClusterRoles - Bottom layer, below ClusterRoleBinding but slightly offset
    else if (node.type === 'clusterrole') {
      const clusterRoleNodes = layoutedNodes.filter(n => n.type === 'clusterrole');
      const index = clusterRoleNodes.indexOf(node);
      node.position = { x: COL_2 + 300 + (index * 300), y: ROW_5 + 350 };  // Below ClusterRoleBinding with more spacing
    }
  });
  
  // Update edges to use proper connection points
  const layoutedEdges = edges.map(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    if (!sourceNode || !targetNode) return edge;
    
    // Determine connection points based on node positions
    let sourceHandle = 'source';
    let targetHandle = 'target';
    
    // Special case: ServiceAccount to ClusterRoleBinding - vertical flow (already correct)
    if (sourceNode.type === 'serviceaccount' && targetNode.type === 'clusterrolebinding') {
      sourceHandle = 'source-bottom';
      targetHandle = 'target-top';
    }
    // Special case: ServiceAccount to RoleBinding - vertical flow (already correct)
    else if (sourceNode.type === 'serviceaccount' && targetNode.type === 'rolebinding') {
      sourceHandle = 'source-bottom';
      targetHandle = 'target-top';
    }
    // Special case: RoleBinding to Role - vertical flow (binding bottom to role top)
    else if (sourceNode.type === 'rolebinding' && targetNode.type === 'role') {
      sourceHandle = 'source-bottom';
      targetHandle = 'target-top';
    }
    // Special case: ClusterRoleBinding to ClusterRole - vertical flow (binding bottom to role top)
    else if (sourceNode.type === 'clusterrolebinding' && targetNode.type === 'clusterrole') {
      sourceHandle = 'source-bottom';
      targetHandle = 'target-top';
    }
    // Horizontal connections (left to right)
    else if (targetNode.position.x > sourceNode.position.x + 100) {
      sourceHandle = 'source-right';
      targetHandle = 'target-left';
    }
    // Vertical connections (top to bottom)
    else if (targetNode.position.y > sourceNode.position.y + 50) {
      sourceHandle = 'source-bottom';
      targetHandle = 'target-top';
    }
    // Vertical connections (bottom to top)
    else if (sourceNode.position.y > targetNode.position.y + 50) {
      sourceHandle = 'source-top';
      targetHandle = 'target-bottom';
    }
    
    return {
      ...edge,
      sourceHandle,
      targetHandle,
      type: 'custom' // Use our custom edge for all connections
    };
  });
  
  return { nodes: layoutedNodes, edges: layoutedEdges };
};