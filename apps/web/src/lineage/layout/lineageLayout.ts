import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import elk from "../../core/layout/elkInstance";
import type { LineageEdge } from "../models/LineageEdge";
import type { LineageNode } from "../models/LineageNode";

export interface LineageLayoutOptions {
  direction?: "LR" | "TB";
  nodeWidth?: number;
  nodeSpacingY?: number;
  rankSpacing?: number;
  compact?: boolean;
  signal?: AbortSignal;
}

export function estimateLineageNodeHeight(columnCount: number, compact = false): number {
  const HEADER_HEIGHT = 44;
  if (compact) {
    return HEADER_HEIGHT + 30;
  }
  const COLUMN_HEIGHT = 28;
  const FOOTER_PADDING = 14;
  return Math.max(90, HEADER_HEIGHT + columnCount * COLUMN_HEIGHT + FOOTER_PADDING);
}

/**
 * Calculates hierarchical auto-layout for SQL Lineage graph nodes using ELK in Web Worker.
 * Left-to-Right by default: Sources -> CTEs / Subqueries -> Final Queries.
 */
export async function calculateLineageLayout(
  nodes: LineageNode[],
  edges: LineageEdge[],
  options: LineageLayoutOptions = {},
): Promise<Map<string, { x: number; y: number }>> {
  const { direction = "LR", nodeWidth = 260, nodeSpacingY = 50, rankSpacing = 120, compact = false, signal } = options;

  if (nodes.length === 0) {
    return new Map();
  }

  if (signal?.aborted) {
    throw new DOMException("Layout computation aborted", "AbortError");
  }

  const nodeMap = new Map<string, LineageNode>();
  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
  });

  const elkChildren: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: nodeWidth,
    height: estimateLineageNodeHeight(node.columns?.length || 0, compact),
  }));

  const elkEdges: ElkExtendedEdge[] = [];
  edges.forEach((edge, idx) => {
    const src = edge.sourceNodeId || edge.source;
    const tgt = edge.targetNodeId || edge.target;
    if (!src || !tgt || src === tgt) return;
    if (!nodeMap.has(src) || !nodeMap.has(tgt)) return;

    elkEdges.push({
      id: `edge-${idx}`,
      sources: [src],
      targets: [tgt],
    });
  });

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction === "LR" ? "RIGHT" : "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(nodeSpacingY),
      "elk.layered.spacing.baseValue": String(rankSpacing),
      "elk.padding": "[top=80,left=80,bottom=80,right=80]",
    },
    children: elkChildren,
    edges: elkEdges,
  };

  try {
    const layout = await elk.layout(elkGraph);

    if (signal?.aborted) {
      throw new DOMException("Layout computation aborted", "AbortError");
    }

    const positions = new Map<string, { x: number; y: number }>();
    let maxLayoutY = 80;

    layout.children?.forEach((child) => {
      const pos = {
        x: Math.round(child.x ?? 80),
        y: Math.round(child.y ?? 80),
      };
      positions.set(child.id, pos);
      maxLayoutY = Math.max(maxLayoutY, (child.y ?? 80) + (child.height ?? 100));
    });

    // Deterministic fallback for unplaced nodes
    let unplacedIdx = 0;
    nodes.forEach((node) => {
      if (!positions.has(node.id)) {
        positions.set(node.id, {
          x: 80 + (unplacedIdx % 4) * (nodeWidth + 50),
          y: maxLayoutY + 120 + Math.floor(unplacedIdx / 4) * 180,
        });
        unplacedIdx++;
      }
    });

    return positions;
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    console.warn("ELK lineage layout failed; falling back to grid:", err);

    const fallback = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, idx) => {
      fallback.set(node.id, {
        x: 80 + (idx % 4) * (nodeWidth + 50),
        y: 80 + Math.floor(idx / 4) * 180,
      });
    });
    return fallback;
  }
}
