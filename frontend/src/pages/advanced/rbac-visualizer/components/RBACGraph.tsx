import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { RBACGraphNode, RBACGraphEdge } from '../types';
import RoleNode from './nodes/RoleNode';
import SubjectNode from './nodes/SubjectNode';

interface RBACGraphProps {
  nodes: RBACGraphNode[];
  edges: RBACGraphEdge[];
  onNodeClick?: (node: RBACGraphNode) => void;
  onEdgeClick?: (edge: RBACGraphEdge) => void;
}

const nodeTypes: NodeTypes = {
  role: RoleNode,
  clusterRole: RoleNode,
  user: SubjectNode,
  group: SubjectNode,
  serviceaccount: SubjectNode,
};

export default function RBACGraph({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeClick,
  onEdgeClick,
}: RBACGraphProps) {
  // Convert RBAC nodes to React Flow nodes
  const flowNodes = useMemo<Node[]>(() => {
    return initialNodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        label: node.label,
        type: node.type,
        onClick: () => onNodeClick?.(node),
      },
    }));
  }, [initialNodes, onNodeClick]);

  // Convert RBAC edges to React Flow edges
  const flowEdges = useMemo<Edge[]>(() => {
    return initialEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: edge.type === 'clusterRoleBinding',
      style: {
        stroke: edge.type === 'clusterRoleBinding' ? '#3b82f6' : '#10b981',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.type === 'clusterRoleBinding' ? '#3b82f6' : '#10b981',
      },
      data: {
        type: edge.type,
        onClick: () => onEdgeClick?.(edge),
      },
    }));
  }, [initialEdges, onEdgeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Update nodes and edges when props change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'role':
                return '#10b981';
              case 'clusterRole':
                return '#3b82f6';
              case 'user':
                return '#f59e0b';
              case 'group':
                return '#8b5cf6';
              case 'serviceaccount':
                return '#ec4899';
              default:
                return '#6b7280';
            }
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}