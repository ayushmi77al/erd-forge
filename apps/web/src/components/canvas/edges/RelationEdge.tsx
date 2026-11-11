import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath, type Position } from "@xyflow/react";
import type React from "react";
import { memo } from "react";
import { getCardinality, getDirectionAngle } from "../relationshipGeometry";
import styles from "./RelationEdge.module.css";

export interface RelationEdgeData extends Record<string, unknown> {
  direction?: string;
  sourceColumn?: string;
  targetColumn?: string;
  pathOffset?: number;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onEdgeHover?: (edgeId: string | null) => void;
  onEdgeSelect?: (edgeId: string) => void;
}

interface CardinalityGlyphProps {
  x: number;
  y: number;
  position: Position;
  kind: "1" | "N" | "";
  color: string;
  strokeWidth: number;
  opacity: number;
}

const CardinalityGlyph: React.FC<CardinalityGlyphProps> = ({ x, y, position, kind, color, strokeWidth, opacity }) => {
  if (!kind) return null;
  const angle = getDirectionAngle(position);

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${angle})`}
      opacity={opacity}
      className={styles.cardinalityGlyph}
      aria-hidden="true"
    >
      {kind === "1" ? (
        <path
          d="M 8 -5 L 8 5 M 12 -5 L 12 5"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M 15 0 L 2 -5.5 M 15 0 L 2 5.5 M 16 -4.5 L 16 4.5"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </g>
  );
};

export const RelationEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    data,
    label,
  }: EdgeProps) => {
    const edgeData = data as RelationEdgeData | undefined;
    const isHighlighted = Boolean(edgeData?.isHighlighted || selected);
    const isDimmed = Boolean(edgeData?.isDimmed && !selected);

    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
      offset: edgeData?.pathOffset ?? 24,
    });

    const { source: sourceCardinality, target: targetCardinality, summary } = getCardinality(edgeData?.direction);
    const baseStroke = (style as React.CSSProperties | undefined)?.stroke || "var(--color-info)";
    const strokeColor = isHighlighted ? "var(--color-brand-400)" : baseStroke;
    const strokeWidth = isHighlighted ? 2.5 : isDimmed ? 1.5 : 2;
    const opacity = isDimmed ? 0.25 : isHighlighted ? 1 : 0.88;

    const span = Math.hypot(targetX - sourceX, targetY - sourceY);
    const showLabel = Boolean(label) && (isHighlighted || span >= 115);

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          interactionWidth={20}
          style={{
            ...style,
            strokeWidth,
            stroke: strokeColor,
            opacity,
            fill: "none",
            transition: "stroke 150ms ease, stroke-width 150ms ease, opacity 150ms ease",
          }}
        />

        {/* Crow's Foot notation markers anchored flush on the wire endpoints */}
        <CardinalityGlyph
          x={sourceX}
          y={sourceY}
          position={sourcePosition}
          kind={sourceCardinality}
          color={strokeColor}
          strokeWidth={isHighlighted ? 2.2 : 1.75}
          opacity={opacity}
        />
        <CardinalityGlyph
          x={targetX}
          y={targetY}
          position={targetPosition}
          kind={targetCardinality}
          color={strokeColor}
          strokeWidth={isHighlighted ? 2.2 : 1.75}
          opacity={opacity}
        />

        {/* Relationship column pill shown when clear or focused */}
        {showLabel && (
          <EdgeLabelRenderer>
            <button
              type="button"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
              className={`${styles.centerLabel} nodrag nopan`}
              data-highlighted={isHighlighted || undefined}
              data-dimmed={isDimmed || undefined}
              onMouseEnter={() => edgeData?.onEdgeHover?.(id)}
              onMouseLeave={() => edgeData?.onEdgeHover?.(null)}
              onClick={() => edgeData?.onEdgeSelect?.(id)}
              aria-label={`Relationship ${label as string}${summary ? ` (${summary})` : ""}`}
            >
              <span>{label as string}</span>
              {isHighlighted && summary && <span className={styles.cardinalityChip}>{summary}</span>}
            </button>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

RelationEdge.displayName = "RelationEdge";
