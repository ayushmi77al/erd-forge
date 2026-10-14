import dagre from '@dagrejs/dagre';
import { LineageNode } from '../models/LineageNode';
import { LineageEdge } from '../models/LineageEdge';

export interface LineageLayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeSpacingY?: number;
  rankSpacing?: number;
  compact?: boolean;
}

export function estimateLineageNodeHeight(columnCount: number, compact = false): number {
  const HEADER_HEIGHT = 44;
  if (compact) {
    return HEADER_HEIGHT + 30;
  }
  const COLUMN_HEIGHT = 28;
  const FOOTER_PADDING = 14;
  return Math.max(90, HEADER_HEIGHT + (columnCount * COLUMN_HEIGHT) + FOOTER_PADDING);
}

/**
 * Calculates hierarchical auto-layout for SQL Lineage graph nodes using Dagre.
 * Left-to-Right by default: Sources -> CTEs / Subqueries -> Final Queries.
 */
export function calculateLineageLayout(
  nodes: LineageNode[],
  edges: LineageEdge[],
  options: LineageLayoutOptions = {}
): Map<string, { x: number; y: number }> {
  const {
    direction = 'LR',
    nodeWidth = 260,
    nodeSpacingY = 50,
    rankSpacing = 120,
    compact = false,
  } = options;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    align: 'UL',
    nodesep: nodeSpacingY,
    ranksep: rankSpacing,
    marginx: 80,
    marginy: 80,
  });

  // 1. Add all lineage nodes
  nodes.forEach((node) => {
    const height = estimateLineageNodeHeight(node.columns?.length || 0, compact);
    g.setNode(node.id, {
      width: nodeWidth,
      height,
    });
  });

  // 2. Add dependencies (source feeds into target)
  edges.forEach((edge, idx) => {
    const src = edge.sourceNodeId || edge.source;
    const tgt = edge.targetNodeId || edge.target;
    if (!src || !tgt || src === tgt) return;
    if (!g.hasNode(src) || !g.hasNode(tgt)) return;

    g.setEdge(src, tgt, {}, `edge-${idx}`);
  });

  // 3. Compute layout
  dagre.layout(g);

  // 4. Extract calculated coordinates
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node) => {
    const gNode = g.node(node.id);
    if (gNode) {
      const height = estimateLineageNodeHeight(node.columns?.length || 0, compact);
      positions.set(node.id, {
        x: Math.round(gNode.x - nodeWidth / 2),
        y: Math.round(gNode.y - height / 2),
      });
    } else {
      positions.set(node.id, { x: 80, y: 80 });
    }
  });

  return positions;
}
