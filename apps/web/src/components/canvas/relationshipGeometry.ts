import { Position } from "@xyflow/react";

export interface CardinalityPair {
  source: "1" | "N" | "";
  target: "1" | "N" | "";
  summary: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface FocusEdgeDescriptor {
  id: string;
  source: string;
  target: string;
  sourceColumn?: string;
  targetColumn?: string;
}

export interface RelationFocusState {
  isFocused: boolean;
  activeEdgeIds: Set<string>;
  activeTableIds: Set<string>;
  highlightedColumnsByTable: Map<string, Set<string>>;
}

const DEFAULT_ESTIMATED_NODE_WIDTH = 260;

/**
 * Maps SDL relationship directions to source and target cardinalities.
 *   '>'  = source Many, target One  (N:1)
 *   '<'  = source One,  target Many (1:N)
 *   '-'  = One-to-One               (1:1)
 *   '<>' = Many-to-Many             (N:N)
 */
export function getCardinality(direction: string | undefined): CardinalityPair {
  switch (direction) {
    case ">":
      return { source: "N", target: "1", summary: "N:1" };
    case "<":
      return { source: "1", target: "N", summary: "1:N" };
    case "-":
      return { source: "1", target: "1", summary: "1:1" };
    case "<>":
      return { source: "N", target: "N", summary: "N:N" };
    default:
      return { source: "", target: "", summary: "" };
  }
}

/**
 * Returns the SVG rotation angle (degrees) pointing outward from the node border
 * along the edge stem for the given handle Position.
 */
export function getDirectionAngle(position: Position): number {
  switch (position) {
    case Position.Right:
      return 0;
    case Position.Bottom:
      return 90;
    case Position.Left:
      return 180;
    case Position.Top:
      return -90;
    default:
      return 0;
  }
}

/**
 * Chooses source and target column handles based on relative table positions.
 * Uses facing inner handles when horizontally separated, and switches to outer
 * same-side C-routing when tables overlap horizontally (e.g. stacked vertically).
 */
export function pickEdgeHandles(
  srcPos: Point2D,
  tgtPos: Point2D,
  sourceColumn: string,
  targetColumn: string,
  estimatedNodeWidth = DEFAULT_ESTIMATED_NODE_WIDTH,
): { sourceHandle: string; targetHandle: string } {
  const dx = tgtPos.x - srcPos.x;
  const sideClearanceThreshold = estimatedNodeWidth * 0.75;

  if (Math.abs(dx) >= sideClearanceThreshold) {
    const targetIsToRight = dx >= 0;
    return {
      sourceHandle: targetIsToRight ? `right-${sourceColumn}` : `left-${sourceColumn}`,
      targetHandle: targetIsToRight ? `left-${targetColumn}` : `right-${targetColumn}`,
    };
  }

  // Stacked vertically or nearly aligned: route cleanly along one outer corridor
  const sameSide = dx >= 0 ? "right" : "left";
  return {
    sourceHandle: `${sameSide}-${sourceColumn}`,
    targetHandle: `${sameSide}-${targetColumn}`,
  };
}

/**
 * Computes active tables, edges, and columns for hover/selection relationship tracing.
 */
export function computeRelationFocus(
  edges: FocusEdgeDescriptor[],
  focusedTableId: string | null,
  focusedEdgeId: string | null,
): RelationFocusState {
  const activeEdgeIds = new Set<string>();
  const activeTableIds = new Set<string>();
  const highlightedColumnsByTable = new Map<string, Set<string>>();

  const markColumn = (tableId: string, colName?: string) => {
    if (!colName) return;
    let cols = highlightedColumnsByTable.get(tableId);
    if (!cols) {
      cols = new Set<string>();
      highlightedColumnsByTable.set(tableId, cols);
    }
    cols.add(colName);
  };

  if (focusedEdgeId) {
    const edge = edges.find((e) => e.id === focusedEdgeId);
    if (edge) {
      activeEdgeIds.add(edge.id);
      activeTableIds.add(edge.source);
      activeTableIds.add(edge.target);
      markColumn(edge.source, edge.sourceColumn);
      markColumn(edge.target, edge.targetColumn);
      return { isFocused: true, activeEdgeIds, activeTableIds, highlightedColumnsByTable };
    }
  }

  if (focusedTableId) {
    activeTableIds.add(focusedTableId);
    for (const edge of edges) {
      if (edge.source === focusedTableId || edge.target === focusedTableId) {
        activeEdgeIds.add(edge.id);
        activeTableIds.add(edge.source);
        activeTableIds.add(edge.target);
        markColumn(edge.source, edge.sourceColumn);
        markColumn(edge.target, edge.targetColumn);
      }
    }
    return { isFocused: true, activeEdgeIds, activeTableIds, highlightedColumnsByTable };
  }

  return { isFocused: false, activeEdgeIds, activeTableIds, highlightedColumnsByTable };
}
