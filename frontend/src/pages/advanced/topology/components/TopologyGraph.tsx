import React, { memo, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ConnectionMode,
  Panel
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  DeploymentNodeV2,
  DaemonSetNodeV2,
  JobNodeV2,
  ServiceNodeV2,
  ReplicaSetNodeV2,
  PodNodeV2,
  ContainerNodeV2,
  SecretNodeV2,
  ConfigMapNodeV2,
  ServiceAccountNodeV2,
  EndpointsNodeV2,
  RoleNodeV2,
  RoleBindingNodeV2,
  GroupNodeV2,
  CronJobNode
} from './nodes';
import { CustomEdge } from './edges';
import type { TopologyViewOptions } from '../types';

const nodeTypes = {
  deployment: DeploymentNodeV2,
  daemonset: DaemonSetNodeV2,
  cronjob: CronJobNode,
  job: JobNodeV2,
  service: ServiceNodeV2,
  endpoints: EndpointsNodeV2,
  replicaset: ReplicaSetNodeV2,
  pod: PodNodeV2,
  container: ContainerNodeV2,
  secret: SecretNodeV2,
  configmap: ConfigMapNodeV2,
  serviceaccount: ServiceAccountNodeV2,
  role: RoleNodeV2,
  rolebinding: RoleBindingNodeV2,
  clusterrole: RoleNodeV2,
  clusterrolebinding: RoleBindingNodeV2,
  group: GroupNodeV2
};

const edgeTypes = {
  custom: CustomEdge
};

interface TopologyGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  viewOptions: TopologyViewOptions;
  onFitView?: () => void;
  onResetView?: () => void;
}

const TopologyGraph = memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  viewOptions,
  onFitView,
  onResetView
}: TopologyGraphProps) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  
  return (
    <Card className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false
          }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'bezier',
            animated: false,
            pathOptions: {
              curvature: 0.25
            }
          }}
          connectionLineType="bezier"
        >
          {viewOptions.showBackground && (
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={16} 
              size={1} 
              color="#e5e7eb" 
            />
          )}
          
          {viewOptions.showControls && <Controls />}
          
          <Panel position="top-right" className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </Card>
  );
});

TopologyGraph.displayName = 'TopologyGraph';

export default TopologyGraph;