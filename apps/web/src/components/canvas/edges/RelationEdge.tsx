import React, { memo } from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer, BaseEdge, Position } from '@xyflow/react';

/**
 * Cardinality direction from SDL:
 *   '>'  = source is Many, target is One  (N:1)
 *   '<'  = source is One,  target is Many  (1:N)
 *   '-'  = One-to-One  (1:1)
 *   '<>' = Many-to-Many (N:N)
 */

function getCardinality(direction: string | undefined): { source: string; target: string } {
  switch (direction) {
    case '>':  return { source: 'N', target: '1' };
    case '<':  return { source: '1', target: 'N' };
    case '-':  return { source: '1', target: '1' };
    case '<>': return { source: 'N', target: 'N' };
    default:   return { source: '', target: '' };
  }
}

export const RelationEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  label,
  labelBgStyle,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const direction = (data as any)?.direction as string | undefined;
  const { source: sourceLabel, target: targetLabel } = getCardinality(direction);
  const strokeColor = (style as any)?.stroke || '#38bdf8';

  // Position cardinality badges just outside the node handles (matching dbdiagram.io)
  const sourceBadgeX = sourcePosition === Position.Right ? sourceX + 16 : sourceX - 16;
  const sourceBadgeY = sourceY - 12;
  const targetBadgeX = targetPosition === Position.Left ? targetX - 16 : targetX + 16;
  const targetBadgeY = targetY - 12;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: strokeColor,
          fill: 'none',
        }}
      />

      {/* Center Relationship Label (e.g. user_id → id) */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'all',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              ...(labelBgStyle as React.CSSProperties),
            }}
            className="nodrag nopan"
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* dbdiagram.io-style Cardinality badges (1 and N / *) */}
      <EdgeLabelRenderer>
        {sourceLabel && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceBadgeX}px,${sourceBadgeY}px)`,
              fontSize: 11,
              fontWeight: 700,
              color: strokeColor,
              fontFamily: 'var(--font-mono)',
              backgroundColor: '#0f172a',
              border: `1.5px solid ${strokeColor}`,
              padding: '1px 5px',
              borderRadius: 4,
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {sourceLabel}
          </div>
        )}
        {targetLabel && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetBadgeX}px,${targetBadgeY}px)`,
              fontSize: 11,
              fontWeight: 700,
              color: strokeColor,
              fontFamily: 'var(--font-mono)',
              backgroundColor: '#0f172a',
              border: `1.5px solid ${strokeColor}`,
              padding: '1px 5px',
              borderRadius: 4,
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {targetLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
