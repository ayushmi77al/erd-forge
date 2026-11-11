import {
  estimateTableHeight,
  getTableKey,
  type LayoutMap,
  type LayoutOptions,
  type LayoutRef,
  type LayoutTable,
  type NodePosition,
} from "@erd-forge/core";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import elk from "./elkInstance";

export {
  estimateTableHeight,
  getTableKey,
  type LayoutMap,
  type LayoutOptions,
  type LayoutRef,
  type LayoutTable,
  type NodePosition,
};

/**
 * Runs Eclipse Layout Kernel (ELK) hierarchical auto-layout on a set of tables and relational references.
 *
 * Runs off the main thread in a dedicated Web Worker (with fallback to bundled runner in test environments).
 * Left-to-Right (LR) by default: placing master/parent tables on the left and child/junction tables on the right.
 * Supports compound domain grouping, collision-safe schema-qualified keys, and deterministic grid fallbacks.
 */
export async function calculateAutoLayout(
  tables: LayoutTable[],
  refs: LayoutRef[],
  options: LayoutOptions = {},
): Promise<LayoutMap> {
  const { direction = "LR", nodeWidth = 270, nodeSpacingY = 64, rankSpacing = 160, signal } = options;

  if (tables.length === 0) {
    return new Map();
  }

  if (signal?.aborted) {
    throw new DOMException("Layout computation aborted", "AbortError");
  }

  // Group tables by domain for compound hierarchy
  const domainGroups = new Map<string, LayoutTable[]>();
  const rootTables: LayoutTable[] = [];
  const tableKeyMap = new Map<string, LayoutTable>();

  tables.forEach((table) => {
    const key = getTableKey(table.schema, table.name, table.id);
    tableKeyMap.set(key, table);

    if (table.domain) {
      const group = domainGroups.get(table.domain) || [];
      group.push(table);
      domainGroups.set(table.domain, group);
    } else {
      rootTables.push(table);
    }
  });

  const children: ElkNode[] = [];

  // 1. Add domain compound nodes
  domainGroups.forEach((groupTables, domainName) => {
    children.push({
      id: `domain:${domainName}`,
      layoutOptions: {
        "elk.padding": "[top=50,left=40,bottom=40,right=40]",
        "elk.spacing.nodeNode": String(nodeSpacingY),
        "elk.direction": direction === "LR" ? "RIGHT" : "DOWN",
      },
      children: groupTables.map((table) => ({
        id: getTableKey(table.schema, table.name, table.id),
        width: table.measuredWidth ?? nodeWidth,
        height: table.measuredHeight ?? estimateTableHeight(table.columns?.length ?? 0),
      })),
    });
  });

  // 2. Add root-level tables
  rootTables.forEach((table) => {
    children.push({
      id: getTableKey(table.schema, table.name, table.id),
      width: table.measuredWidth ?? nodeWidth,
      height: table.measuredHeight ?? estimateTableHeight(table.columns?.length ?? 0),
    });
  });

  // 3. Map relationships with orthogonal edge routing
  const edges: ElkExtendedEdge[] = [];
  refs.forEach((ref, idx) => {
    const sourceKey = getTableKey(ref.sourceSchema, ref.sourceTable);
    const targetKey = getTableKey(ref.targetSchema, ref.targetTable);

    // Skip self-referencing relationships in DAG rank calculation
    if (sourceKey === targetKey) return;
    if (!tableKeyMap.has(sourceKey) || !tableKeyMap.has(targetKey)) return;

    // Parent -> Child ranking
    const parentKey = ref.direction === "<" ? sourceKey : targetKey;
    const childKey = ref.direction === "<" ? targetKey : sourceKey;

    edges.push({
      id: `edge-${idx}`,
      sources: [parentKey],
      targets: [childKey],
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
    children,
    edges,
  };

  try {
    const layout = await elk.layout(elkGraph);

    if (signal?.aborted) {
      throw new DOMException("Layout computation aborted", "AbortError");
    }

    const positions: LayoutMap = new Map();
    let maxLayoutX = 80;
    let maxLayoutY = 80;

    const extractPositions = (nodes: ElkNode[] = [], parentX = 0, parentY = 0) => {
      nodes.forEach((node) => {
        const absX = parentX + (node.x ?? 0);
        const absY = parentY + (node.y ?? 0);

        if (node.children && node.children.length > 0) {
          extractPositions(node.children, absX, absY);
        } else {
          const pos: NodePosition = {
            x: Math.round(absX),
            y: Math.round(absY),
          };
          positions.set(node.id, pos);

          const table = tableKeyMap.get(node.id);
          if (table && table.name && !positions.has(table.name)) {
            // Provide alias by table.name for single-schema backward compatibility
            positions.set(table.name, pos);
          }

          const width = node.width ?? nodeWidth;
          const height = node.height ?? 100;
          maxLayoutX = Math.max(maxLayoutX, absX + width);
          maxLayoutY = Math.max(maxLayoutY, absY + height);
        }
      });
    };

    extractPositions(layout.children);

    // 4. Deterministic multi-column grid placement for unlinked / missing tables
    let gridCol = 0;
    let gridRow = 0;
    const GRID_COLS = 4;
    const GRID_START_Y = maxLayoutY + 120;

    tables.forEach((table) => {
      const key = getTableKey(table.schema, table.name, table.id);
      if (!positions.has(key)) {
        const pos: NodePosition = {
          x: 80 + gridCol * (nodeWidth + 50),
          y: GRID_START_Y + gridRow * 200,
        };
        positions.set(key, pos);
        if (!positions.has(table.name)) {
          positions.set(table.name, pos);
        }

        gridCol++;
        if (gridCol >= GRID_COLS) {
          gridCol = 0;
          gridRow++;
        }
      }
    });

    return positions;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err; // Propagate intentional aborts
    }

    console.warn("ELK layout computation failed; falling back to deterministic grid arrangement:", err);

    // Predictable fallback: arrange all tables on a clean deterministic grid
    const fallbackPositions: LayoutMap = new Map();
    const GRID_COLS = 4;
    tables.forEach((table, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);
      const pos: NodePosition = {
        x: 80 + col * (nodeWidth + 60),
        y: 80 + row * 220,
      };
      const key = getTableKey(table.schema, table.name, table.id);
      fallbackPositions.set(key, pos);
      if (!fallbackPositions.has(table.name)) {
        fallbackPositions.set(table.name, pos);
      }
    });

    return fallbackPositions;
  }
}
