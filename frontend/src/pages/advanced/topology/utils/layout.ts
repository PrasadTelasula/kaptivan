import dagre from 'dagre';
import type { TopologyNode, TopologyEdge, TopologyViewOptions } from '../types';

// Helper function to identify RBAC nodes
const isRBACNode = (type: string): boolean => {
  return ['serviceaccount', 'role', 'clusterrole', 'rolebinding', 'clusterrolebinding'].includes(type);
};

export const applyDagreLayout = (
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: TopologyViewOptions
): { nodes: TopologyNode[]; edges: TopologyEdge[] } => {
  // Separate RBAC nodes from other nodes
  const rbacNodes = nodes.filter(n => isRBACNode(n.type));
  const nonRbacNodes = nodes.filter(n => !isRBACNode(n.type));
  const rbacNodeIds = new Set(rbacNodes.map(n => n.id));
  
  // Separate edges
  const rbacEdges = edges.filter(e => rbacNodeIds.has(e.source) || rbacNodeIds.has(e.target));
  const nonRbacEdges = edges.filter(e => !rbacNodeIds.has(e.source) && !rbacNodeIds.has(e.target));
  
  const g = new dagre.graphlib.Graph({ compound: true });
  
  // Balanced spacing - avoiding overlaps for group nodes
  g.setGraph({
    rankdir: options.layout === 'horizontal' ? 'LR' : 'TB',  // Respect layout option
    ranksep: 150,   // Increased space between ranks to avoid group node overlaps
    nodesep: 120,    // Increased horizontal spacing for larger nodes
    edgesep: 40,    // Reasonable edge separation
    marginx: 50,    // Increased margins for group nodes
    marginy: 50,
    acyclicer: 'greedy',
    ranker: 'tight-tree',  // More compact ranking algorithm
    align: 'DR'     // Down-right alignment for tighter grouping
  });
  
  // Create a separate graph for RBAC layout to ensure proper routing
  const rbacGraph = new dagre.graphlib.Graph();
  rbacGraph.setGraph({
    rankdir: 'TB',  // Always top-bottom for RBAC
    ranksep: 100,   // Tighter vertical spacing between RBAC layers
    nodesep: 50,    // Much tighter horizontal spacing between nodes
    edgesep: 30,    // Reduced edge separation
    marginx: 10,
    marginy: 10,
    acyclicer: 'greedy',
    ranker: 'tight-tree',  // Better alignment for tree-like structures
    align: 'UL'     // Up-left alignment for compact layout
  });
  
  // Create a separate graph for ConfigMaps and Secrets to avoid overlaps
  const resourceGraph = new dagre.graphlib.Graph();
  resourceGraph.setGraph({
    rankdir: 'TB',  // Top-bottom for vertical stacking
    ranksep: 20,    // Minimal vertical spacing
    nodesep: 30,    // Horizontal spacing between columns
    edgesep: 10,
    marginx: 5,
    marginy: 5,
    ranker: 'longest-path'  // Simple ranking for resources
  });
  
  g.setDefaultEdgeLabel(() => ({}));
  
  // Group nodes by type for hierarchical layout
  const nodeGroups = new Map<string, string[]>();
  
  // Add nodes to dagre graph with type-specific sizing
  nodes.forEach(node => {
    // Different sizes for different node types to prevent overlap
    let width = 200; // Default width
    let height = 80; // Default height
    
    // Adjusted sizes with more padding for V2 nodes
    switch(node.type) {
      case 'deployment':
        width = 280;
        height = 120;
        break;
      case 'daemonset':
        width = 340;
        height = 140;
        break;
      case 'cronjob':
        width = 360;
        height = 200;
        break;
      case 'job':
        width = 340;
        height = 160;
        break;
      case 'replicaset':
        width = 280;
        height = 110;
        break;
      case 'service':
        width = 280;
        height = 120;
        break;
      case 'endpoints':
        width = 280;
        height = 120;
        break;
      case 'pod':
        width = 440;
        height = 180;
        break;
      case 'container':
        width = 300;
        height = 120;
        break;
      case 'serviceaccount':
        width = 280;
        height = 120;
        break;
      case 'role':
      case 'clusterrole':
        width = 300;
        height = 120;
        break;
      case 'rolebinding':
      case 'clusterrolebinding':
        width = 320;
        height = 130;
        break;
      case 'configmap':
        width = 260;
        height = 110;
        break;
      case 'secret':
        width = 260;
        height = 120;
        break;
      case 'group':
        // Group nodes need much more space to avoid overlaps
        // Accounting for expanded state (450px width) and scrollable content
        width = 450;
        height = 350;
        break;
      default:
        width = 200;
        height = 100;
    }
    
    g.setNode(node.id, {
      width,
      height,
      label: node.data.label,
      type: node.type
    });
    
    // Track node groups
    if (!nodeGroups.has(node.type)) {
      nodeGroups.set(node.type, []);
    }
    nodeGroups.get(node.type)?.push(node.id);
  });
  
  // Add edges to dagre graph with weights for better grouping
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    // Give higher weight to RBAC connections to keep them aligned
    let weight = 1;
    let minlen = 1;  // Default minimum edge length
    
    if (sourceNode && targetNode) {
      // RBAC connections get higher weight for better alignment
      if ((sourceNode.type === 'serviceaccount' || 
           sourceNode.type === 'rolebinding' || 
           sourceNode.type === 'clusterrolebinding') &&
          (targetNode.type === 'role' || 
           targetNode.type === 'clusterrole' ||
           targetNode.type === 'rolebinding' ||
           targetNode.type === 'clusterrolebinding')) {
        weight = 10;  // Higher weight keeps RBAC nodes aligned
        minlen = 1;   // Keep them close vertically
      }
      // Service to endpoints connections
      else if (sourceNode.type === 'service' && targetNode.type === 'endpoints') {
        weight = 5;
        minlen = 1;
      }
      // Deployment to ReplicaSet connections
      else if (sourceNode.type === 'deployment' && targetNode.type === 'replicaset') {
        weight = 8;
        minlen = 1;
      }
      // ReplicaSet to Pod connections
      else if (sourceNode.type === 'replicaset' && targetNode.type === 'pod') {
        weight = 7;
        minlen = 1;
      }
      // DaemonSet to Pod connections
      else if (sourceNode.type === 'daemonset' && targetNode.type === 'pod') {
        weight = 8;
        minlen = 1;
      }
      // Job to Pod connections
      else if (sourceNode.type === 'job' && targetNode.type === 'pod') {
        weight = 8;
        minlen = 1;
      }
    }
    
    g.setEdge(edge.source, edge.target, {
      weight,
      minlen,
      labelpos: 'c',
      labeloffset: 10
    });
  });
  
  // Calculate layout
  dagre.layout(g);
  
  // Apply calculated positions to nodes with additional spacing
  let layoutedNodes = nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    // Use the actual node dimensions for centering
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2
      }
    };
  });
  
  // Post-process RBAC, ConfigMaps, and Secrets to position them in bottom section
  const bottomSectionTypes = ['serviceaccount', 'role', 'clusterrole', 'rolebinding', 'clusterrolebinding', 'configmap', 'secret'];
  let bottomSectionNodes = layoutedNodes.filter(n => bottomSectionTypes.includes(n.type));
  const mainTopologyNodes = layoutedNodes.filter(n => !bottomSectionTypes.includes(n.type));
  
  if (bottomSectionNodes.length > 0) {
    // Find the bottom-left corner position based on main topology nodes
    let maxY = 0;
    let minX = Infinity;
    
    mainTopologyNodes.forEach(node => {
      if (node.position.y > maxY) maxY = node.position.y;
      if (node.position.x < minX) minX = node.position.x;
    });
    
    // Position bottom section nodes starting from bottom-left corner with more spacing
    const sectionStartX = minX;  // Align with leftmost node
    const sectionStartY = maxY + 300;  // Increased spacing below all other nodes to avoid overlaps
    
    // Group nodes by type
    const serviceAccount = bottomSectionNodes.find(n => n.type === 'serviceaccount');
    const configMaps = bottomSectionNodes.filter(n => n.type === 'configmap');
    const secrets = bottomSectionNodes.filter(n => n.type === 'secret');
    const roles = bottomSectionNodes.filter(n => n.type === 'role' || n.type === 'clusterrole');
    const bindings = bottomSectionNodes.filter(n => n.type === 'rolebinding' || n.type === 'clusterrolebinding');
    
    // Handle ConfigMaps and Secrets with grouping for multiple items
    let rbacStartX = sectionStartX; // Default RBAC start position
    const groupThreshold = 2; // Group when we have more than 2 items
    
    // Create group nodes if needed
    const configMapGroupNode = configMaps.length > groupThreshold ? {
      id: 'configmap-group',
      type: 'group',
      position: { x: 0, y: 0 },
      data: {
        label: `ConfigMaps (${configMaps.length})`,
        namespace: bottomSectionNodes[0]?.data?.namespace,
        context: bottomSectionNodes[0]?.data?.context,
        isGroup: true,
        groupType: 'configmap',
        details: {
          itemCount: configMaps.length,
          items: configMaps.slice(0, 3).map(cm => ({
            name: cm.data.label,
            resource: cm.data.resource,
            status: cm.data.status,
            creationTimestamp: cm.data.resource?.creationTimestamp
          })), // First 3 for preview with full data
          hasMore: configMaps.length > 3
        },
        resource: { 
          count: configMaps.length,
          items: configMaps.map(cm => ({
            name: cm.data.label,
            resource: cm.data.resource,
            status: cm.data.status,
            creationTimestamp: cm.data.resource?.creationTimestamp
          })) // All items with full resource data for expanded view
        }
      }
    } : null;
    
    const secretGroupNode = secrets.length > groupThreshold ? {
      id: 'secret-group',
      type: 'group',
      position: { x: 0, y: 0 },
      data: {
        label: `Secrets (${secrets.length})`,
        namespace: bottomSectionNodes[0]?.data?.namespace,
        context: bottomSectionNodes[0]?.data?.context,
        isGroup: true,
        groupType: 'secret',
        details: {
          itemCount: secrets.length,
          items: secrets.slice(0, 3).map(s => ({
            name: s.data.label,
            resource: s.data.resource,
            status: s.data.status,
            creationTimestamp: s.data.resource?.creationTimestamp
          })), // First 3 for preview with full data
          hasMore: secrets.length > 3
        },
        resource: { 
          count: secrets.length,
          items: secrets.map(s => ({
            name: s.data.label,
            resource: s.data.resource,
            status: s.data.status,
            creationTimestamp: s.data.resource?.creationTimestamp
          })) // All items with full resource data for expanded view
        }
      }
    } : null;
    
    // Determine which nodes to show
    const visibleConfigMaps = configMapGroupNode ? [] : configMaps;
    const visibleSecrets = secretGroupNode ? [] : secrets;
    const groupNodes = [];
    if (configMapGroupNode) groupNodes.push(configMapGroupNode);
    if (secretGroupNode) groupNodes.push(secretGroupNode);
    
    if (visibleConfigMaps.length > 0 || visibleSecrets.length > 0 || groupNodes.length > 0) {
      resourceGraph.setDefaultEdgeLabel(() => ({}));
      
      // Configure the resource graph for side-by-side columns with more spacing
      resourceGraph.setGraph({
        rankdir: 'LR',  // Left-right for side-by-side columns
        ranksep: 100,    // Increased space between columns to avoid overlap
        nodesep: 50,    // Increased space between nodes in same column
        edgesep: 20,
        marginx: 20,
        marginy: 20,
        ranker: 'network-simplex'
      });
      
      // Add group nodes or individual ConfigMaps
      if (configMapGroupNode) {
        resourceGraph.setNode(configMapGroupNode.id, { 
          width: 450,  // Increased to match expanded GroupNodeV2 width
          height: 350  // Increased to accommodate expanded content
        });
        groupNodes.push(configMapGroupNode);
      } else {
        visibleConfigMaps.forEach((configMap, index) => {
          resourceGraph.setNode(configMap.id, { 
            width: 260, 
            height: 110
          });
          if (index > 0) {
            resourceGraph.setEdge(visibleConfigMaps[index - 1].id, configMap.id, {
              weight: 10,
              minlen: 1
            });
          }
        });
      }
      
      // Add group nodes or individual Secrets
      if (secretGroupNode) {
        resourceGraph.setNode(secretGroupNode.id, { 
          width: 450,  // Increased to match expanded GroupNodeV2 width
          height: 350  // Increased to accommodate expanded content
        });
        groupNodes.push(secretGroupNode);
      } else {
        visibleSecrets.forEach((secret, index) => {
          resourceGraph.setNode(secret.id, { 
            width: 260, 
            height: 120
          });
          if (index > 0) {
            resourceGraph.setEdge(visibleSecrets[index - 1].id, secret.id, {
              weight: 10,
              minlen: 1
            });
          }
        });
      }
      
      // Connect columns for layout
      const firstConfigNode = configMapGroupNode || visibleConfigMaps[0];
      const firstSecretNode = secretGroupNode || visibleSecrets[0];
      if (firstConfigNode && firstSecretNode) {
        resourceGraph.setEdge(firstConfigNode.id, firstSecretNode.id, {
          weight: 1,
          minlen: 2
        });
      }
      
      // Calculate resource layout
      dagre.layout(resourceGraph);
      
      // Apply positions to all resource nodes
      [...visibleConfigMaps, ...visibleSecrets, ...groupNodes].forEach(node => {
        const graphNode = resourceGraph.node(node.id);
        if (graphNode) {
          node.position = {
            x: sectionStartX + graphNode.x - graphNode.width / 2,
            y: sectionStartY + graphNode.y - graphNode.height / 2
          };
        }
      });
      
      // Add group nodes to the layoutedNodes if they exist
      if (configMapGroupNode) {
        // Remove individual configmaps from bottomSectionNodes and add group
        bottomSectionNodes = bottomSectionNodes.filter(n => n.type !== 'configmap');
        bottomSectionNodes.push(configMapGroupNode);
      }
      if (secretGroupNode) {
        // Remove individual secrets from bottomSectionNodes and add group
        bottomSectionNodes = bottomSectionNodes.filter(n => n.type !== 'secret');
        bottomSectionNodes.push(secretGroupNode);
      }
      
      // Determine where RBAC section starts with more spacing
      let maxResourceX = sectionStartX;
      [...visibleConfigMaps, ...visibleSecrets, ...groupNodes].forEach(node => {
        if (node.position) {
          // Use actual node width (450 for groups, 280 for others)
          const nodeWidth = groupNodes.includes(node) ? 450 : 280;
          const nodeRight = node.position.x + nodeWidth;
          if (nodeRight > maxResourceX) maxResourceX = nodeRight;
        }
      });
      rbacStartX = maxResourceX + 200;  // Increased spacing to avoid overlap
    }
    
    // Use dagre for RBAC layout if we have RBAC nodes
    if (serviceAccount || bindings.length > 0 || roles.length > 0) {
      rbacGraph.setDefaultEdgeLabel(() => ({}));
      
      // Add RBAC nodes to the graph
      if (serviceAccount) {
        rbacGraph.setNode(serviceAccount.id, { width: 280, height: 120 });
      }
      
      bindings.forEach(binding => {
        const width = binding.type === 'clusterrolebinding' ? 320 : 300;
        rbacGraph.setNode(binding.id, { width, height: 130 });
      });
      
      roles.forEach(role => {
        const width = role.type === 'clusterrole' ? 300 : 280;
        rbacGraph.setNode(role.id, { width, height: 120 });
      });
      
      // Add RBAC edges to help with layout
      if (serviceAccount) {
        bindings.forEach(binding => {
          rbacGraph.setEdge(serviceAccount.id, binding.id, {
            weight: 10,
            minlen: 1
          });
        });
      }
      
      // Create a map to track binding-role relationships
      const bindingRoleMap = new Map();
      
      // Match each binding with its corresponding role by name
      bindings.forEach(binding => {
        // Extract role reference from binding data
        const roleRef = binding.data?.details?.roleRef;
        let correspondingRole = null;
        
        if (roleRef) {
          // Find the exact role by name and kind
          const roleKind = roleRef.kind?.toLowerCase();
          correspondingRole = roles.find(r => 
            r.data?.label === roleRef.name && 
            r.type === roleKind
          );
        }
        
        if (!correspondingRole && roleRef?.name) {
          // Try to find by name in ID
          correspondingRole = roles.find(r => r.id.includes(roleRef.name));
        }
        
        if (correspondingRole) {
          bindingRoleMap.set(binding.id, correspondingRole.id);
          rbacGraph.setEdge(binding.id, correspondingRole.id, {
            weight: 20,
            minlen: 1
          });
        }
      });
      
      // Calculate RBAC layout
      dagre.layout(rbacGraph);
      
      // Apply RBAC positions with offset and ensure vertical alignment
      const rbacNodes = rbacGraph.nodes();
      
      // Group nodes by rank (layer) for alignment
      const nodesByRank = new Map();
      rbacNodes.forEach(nodeId => {
        const graphNode = rbacGraph.node(nodeId);
        const actualNode = bottomSectionNodes.find(n => n.id === nodeId);
        if (actualNode) {
          const rank = Math.round(graphNode.y / 50) * 50; // Round to nearest 50 for grouping
          if (!nodesByRank.has(rank)) {
            nodesByRank.set(rank, []);
          }
          nodesByRank.get(rank).push({ node: actualNode, graphNode });
        }
      });
      
      // Apply positions ensuring vertical alignment within each rank
      nodesByRank.forEach((nodesInRank, rank) => {
        // Sort nodes in rank by x position
        nodesInRank.sort((a, b) => a.graphNode.x - b.graphNode.x);
        
        // Apply positions with proper alignment
        nodesInRank.forEach(({ node, graphNode }) => {
          node.position = {
            x: rbacStartX + graphNode.x - graphNode.width / 2,
            y: sectionStartY + graphNode.y - graphNode.height / 2
          };
        });
      });
      
      // Post-process to ensure perfect vertical alignment
      // 1. First align roles directly below their bindings
      bindings.forEach(binding => {
        const roleId = bindingRoleMap.get(binding.id);
        if (roleId) {
          const role = roles.find(r => r.id === roleId);
          if (role && binding.position && role.position) {
            // Align role directly below its binding (same x coordinate)
            role.position.x = binding.position.x;
            // Ensure role is below binding (fix Y position if needed)
            if (role.position.y <= binding.position.y) {
              role.position.y = binding.position.y + 160;
            }
          }
        }
      });
      
      // 2. Center ServiceAccount above all bindings if there's only one SA
      if (serviceAccount && bindings.length > 0) {
        // Calculate center position of all bindings
        let minX = Infinity;
        let maxX = -Infinity;
        bindings.forEach(binding => {
          if (binding.position) {
            const bindingLeft = binding.position.x;
            const bindingRight = binding.position.x + 320; // Approximate width
            if (bindingLeft < minX) minX = bindingLeft;
            if (bindingRight > maxX) maxX = bindingRight;
          }
        });
        
        // Center the ServiceAccount
        if (minX !== Infinity && maxX !== -Infinity) {
          const centerX = (minX + maxX) / 2 - 140; // Half of SA width (280/2)
          serviceAccount.position.x = centerX;
        }
      }
    } else {
      // Fallback to manual positioning if no dagre layout needed
      // Layer 1: ServiceAccount at top of RBAC section
      if (serviceAccount) {
        serviceAccount.position = {
          x: rbacStartX + 150,  // Center it horizontally in RBAC section
          y: sectionStartY
        };
      }
      
      // Separate roles and cluster roles for better positioning
      const regularRoles = roles.filter(r => r.type === 'role');
      const clusterRoles = roles.filter(r => r.type === 'clusterrole');
      const roleBindings = bindings.filter(b => b.type === 'rolebinding');
      const clusterRoleBindings = bindings.filter(b => b.type === 'clusterrolebinding');
      
      // Layer 2: Bindings below ServiceAccount - spread horizontally to avoid overlap
      const bindingsY = sectionStartY + 160;  // STRICT vertical spacing from ServiceAccount
      roleBindings.forEach((binding, index) => {
        binding.position = {
          x: rbacStartX + (index * 330),  // Spread horizontally if multiple
          y: bindingsY  // All bindings at same vertical level
        };
      });
      
      // ClusterRoleBindings - to the right of regular bindings with spacing
      const clusterBindingStartX = rbacStartX + (roleBindings.length * 330);
      clusterRoleBindings.forEach((binding, index) => {
        binding.position = {
          x: clusterBindingStartX + (index * 330),  // Spread horizontally
          y: bindingsY  // SAME vertical level as role bindings (strict vertical rule)
        };
      });
      
      // Layer 3: Roles below their respective Bindings
      const rolesY = bindingsY + 160;  // STRICT vertical spacing from bindings
      regularRoles.forEach((role, index) => {
        role.position = {
          x: rbacStartX + (index * 330),  // Align with role bindings horizontally
          y: rolesY  // All roles at same vertical level
        };
      });
      
      // ClusterRoles below their respective ClusterRoleBindings
      clusterRoles.forEach((role, index) => {
        role.position = {
          x: clusterBindingStartX + (index * 330),  // Align with cluster bindings
          y: rolesY  // SAME vertical level as regular roles (strict vertical rule)
        };
      });
    }
    
    // Combine main topology and bottom section nodes
    // Make sure we're using the modified bottomSectionNodes that has group nodes instead of individuals
    layoutedNodes = [...mainTopologyNodes, ...bottomSectionNodes];
  }
  
  // Process edges for better routing with proper handle connections
  const layoutedEdges = edges.map(edge => {
    const edgeData = g.edge(edge.source, edge.target);
    const sourceNode = layoutedNodes.find(n => n.id === edge.source);
    const targetNode = layoutedNodes.find(n => n.id === edge.target);
    
    let updatedEdge = { ...edge };
    
    // IMPORTANT: If the edge already has handle specifications from the edge builders,
    // preserve them! Don't override them based on layout positions.
    const hasExistingHandles = edge.sourceHandle && edge.targetHandle;
    
    // Only set handles if they weren't already specified by the edge builders
    if (!hasExistingHandles && sourceNode && targetNode) {
      const isRBACConnection = 
        sourceNode.type === 'serviceaccount' || 
        targetNode.type === 'serviceaccount' ||
        sourceNode.type === 'role' || targetNode.type === 'role' ||
        sourceNode.type === 'clusterrole' || targetNode.type === 'clusterrole' ||
        sourceNode.type === 'rolebinding' || targetNode.type === 'rolebinding' ||
        sourceNode.type === 'clusterrolebinding' || targetNode.type === 'clusterrolebinding';
      
      // In horizontal layout, only RBAC and ServiceAccount can use top/bottom edges
      if (options.layout === 'horizontal' && !isRBACConnection) {
        // Force left/right edges for all non-RBAC connections in horizontal layout
        if (targetNode.position.x > sourceNode.position.x) {
          updatedEdge.sourceHandle = 'source-right';
          updatedEdge.targetHandle = 'target-left';
        } else {
          updatedEdge.sourceHandle = 'source-left';
          updatedEdge.targetHandle = 'target-right';
        }
      }
      // STRICT RULE: RBAC connections ALWAYS use top/bottom - NEVER left/right
      else if (isRBACConnection) {
        // ALL RBAC connections MUST be vertical - NO EXCEPTIONS
        // ServiceAccount to Bindings - ALWAYS top to bottom
        if (sourceNode.type === 'serviceaccount' && 
            (targetNode.type === 'rolebinding' || targetNode.type === 'clusterrolebinding')) {
          updatedEdge.sourceHandle = 'source-bottom';
          updatedEdge.targetHandle = 'target-top';
        }
        // Bindings to Role/ClusterRole - ALWAYS top to bottom
        else if ((sourceNode.type === 'rolebinding' || sourceNode.type === 'clusterrolebinding') &&
                 (targetNode.type === 'role' || targetNode.type === 'clusterrole')) {
          updatedEdge.sourceHandle = 'source-bottom';
          updatedEdge.targetHandle = 'target-top';
        }
        // ANY other RBAC connection - FORCE vertical
        else {
          // ALWAYS use vertical handles for RBAC - NO horizontal allowed
          updatedEdge.sourceHandle = 'source-bottom';
          updatedEdge.targetHandle = 'target-top';
        }
      }
      // Vertical layout - use position-based logic
      else {
        if (targetNode.position.y > sourceNode.position.y + 50) {
          updatedEdge.sourceHandle = 'source-bottom';
          updatedEdge.targetHandle = 'target-top';
        } else if (Math.abs(targetNode.position.x - sourceNode.position.x) > 100) {
          if (targetNode.position.x > sourceNode.position.x) {
            updatedEdge.sourceHandle = 'source-right';
            updatedEdge.targetHandle = 'target-left';
          } else {
            updatedEdge.sourceHandle = 'source-left';
            updatedEdge.targetHandle = 'target-right';
          }
        }
      }
    }
    
    // For RBAC edges, use step type for better flow chart style routing
    if (sourceNode && targetNode) {
      const isRBACEdge = 
        (sourceNode.type === 'serviceaccount' || targetNode.type === 'serviceaccount' ||
         sourceNode.type === 'role' || targetNode.type === 'role' ||
         sourceNode.type === 'clusterrole' || targetNode.type === 'clusterrole' ||
         sourceNode.type === 'rolebinding' || targetNode.type === 'rolebinding' ||
         sourceNode.type === 'clusterrolebinding' || targetNode.type === 'clusterrolebinding');
      
      if (isRBACEdge) {
        // Use custom edges for bezier curves in RBAC connections
        updatedEdge.type = 'custom';
        updatedEdge.data = {
          ...updatedEdge.data,
          type: 'rbac',
        };
        updatedEdge.animated = false;
        updatedEdge.style = {
          stroke: '#f97316',
          strokeWidth: 2
        };
        
        // Label positioning for better readability
        updatedEdge.labelStyle = {
          fill: '#f97316',
          fontSize: 12
        };
        updatedEdge.labelBgStyle = {
          fill: '#1f2937',
          fillOpacity: 0.8
        };
        
        // Bezier curve options for smooth flow
        updatedEdge.curvature = 0.3; // Gentle curve
      } else if (edgeData && edgeData.points) {
        // Add control points for smoother edges
        updatedEdge.data = {
          ...updatedEdge.data,
          points: edgeData.points
        };
      }
    }
    
    // Preserve edge type if it's already set, otherwise use custom for bezier curves
    if (!updatedEdge.type && (!edge.type || edge.type === 'default')) {
      updatedEdge.type = 'custom';
    }
    
    return updatedEdge;
  });
  
  return { nodes: layoutedNodes, edges: layoutedEdges };
};

export const groupNodesByType = (nodes: TopologyNode[]): Map<string, TopologyNode[]> => {
  const grouped = new Map<string, TopologyNode[]>();
  
  nodes.forEach(node => {
    const type = node.type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(node);
  });
  
  return grouped;
};

export const calculateRadialLayout = (
  centerNode: TopologyNode,
  connectedNodes: TopologyNode[],
  radius: number = 200
): TopologyNode[] => {
  const angleStep = (2 * Math.PI) / connectedNodes.length;
  
  return connectedNodes.map((node, index) => ({
    ...node,
    position: {
      x: centerNode.position.x + radius * Math.cos(index * angleStep),
      y: centerNode.position.y + radius * Math.sin(index * angleStep)
    }
  }));
};

export const getDefaultViewOptions = (): TopologyViewOptions => ({
  layout: 'horizontal',
  spacing: {
    nodeWidth: 180,
    nodeHeight: 60,
    rankSeparation: 200,  // Increased for more horizontal spacing between ranks
    nodeSeparation: 100   // Increased for more vertical spacing between nodes
  },
  showMinimap: true,
  showControls: true,
  showBackground: true
});