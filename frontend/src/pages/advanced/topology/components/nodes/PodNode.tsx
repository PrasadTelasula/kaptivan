import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Box, CircleDot, AlertCircle, Loader2 } from 'lucide-react';
import { phaseToColor } from '../../utils/status-helpers';
import type { PodPhase } from '../../types';

interface PodNodeData {
  label: string;
  phase?: PodPhase;
  namespace?: string;
  details?: {
    phase: PodPhase;
    nodeName?: string;
    podIP?: string;
    containers: number;
    qosClass?: string;
  };
}

const PodNode = memo(({ data }: NodeProps<PodNodeData>) => {
  const phase = data.phase || 'Unknown';
  const phaseColor = phaseToColor(phase);
  
  const PhaseIcon = {
    Running: CircleDot,
    Pending: Loader2,
    Failed: AlertCircle,
    Succeeded: CircleDot,
    Terminating: Loader2,
    CrashLoopBackOff: AlertCircle,
    Unknown: AlertCircle
  }[phase] || AlertCircle;
  
  const isAnimated = phase === 'Pending' || phase === 'Terminating';
  
  return (
    <div
      className="px-3 py-2 rounded-lg bg-background border shadow-md min-w-[140px] transition-all hover:shadow-lg"
      style={{ borderColor: phaseColor }}
    >
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <Box className="h-3 w-3 text-indigo-500" />
        <span className="font-medium text-xs">Pod</span>
        <PhaseIcon 
          className={`h-3 w-3 ml-auto ${isAnimated ? 'animate-spin' : ''}`} 
          style={{ color: phaseColor }} 
        />
      </div>
      
      <div className="text-xs truncate mb-1" title={data.label}>
        {data.label}
      </div>
      
      {data.details && (
        <div className="space-y-1">
          <Badge 
            variant="secondary" 
            className="text-xs px-1 py-0"
            style={{ backgroundColor: `${phaseColor}20`, color: phaseColor }}
          >
            {phase}
          </Badge>
          {data.details.containers > 0 && (
            <div className="text-xs text-muted-foreground">
              {data.details.containers} container{data.details.containers > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PodNode.displayName = 'PodNode';

export default PodNode;