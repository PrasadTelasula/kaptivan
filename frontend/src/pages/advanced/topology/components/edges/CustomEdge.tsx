import React from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { cn } from '@/lib/utils';

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  // Determine edge color based on connection type
  const getEdgeColor = () => {
    if (data?.animated) {
      return '#6366f1'; // Indigo for animated edges
    }
    if (data?.type === 'rbac') {
      return '#f97316'; // Orange for RBAC connections
    }
    if (data?.type === 'service') {
      return '#10b981'; // Green for service connections
    }
    return '#6b7280'; // Gray default
  };

  const edgeColor = getEdgeColor();

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: data?.animated ? '5 5' : undefined,
          animation: data?.animated ? 'dash 1s linear infinite' : undefined,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className={cn(
              "px-2 py-1 rounded-md text-xs font-medium",
              "bg-white dark:bg-gray-900 border",
              "shadow-sm",
              data?.type === 'rbac' 
                ? "border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                : data?.type === 'service'
                ? "border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            )}>
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;