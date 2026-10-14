import dagre from '@dagrejs/dagre';

export interface LayoutTable {
  name: string;
  columns?: any[];
}

export interface LayoutRef {
  sourceTable: string;
  sourceColumn?: string;
  direction?: string;
  targetTable: string;
  targetColumn?: string;
}

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeSpacingX?: number;
  nodeSpacingY?: number;
  rankSpacing?: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

export type LayoutMap = Map<string, NodePosition>;

/**
 * Calculates estimated height of a table node based on its columns.
 */
export function estimateTableHeight(columnCount: number): number {
  const HEADER_HEIGHT = 44;
  const COLUMN_HEIGHT = 32;
  const FOOTER_PADDING = 16;
  return Math.max(100, HEADER_HEIGHT + (columnCount * COLUMN_HEIGHT) + FOOTER_PADDING);
}

/**
 * Runs Dagre hierarchical auto-layout on a set of tables and relational references.
 *
 * Defaults to Left-to-Right (LR), placing master/parent tables on the left
 * and dependent child/junction tables on the right.
 */
export function calculateAutoLayout(
  tables: LayoutTable[],
  refs: LayoutRef[],
  options: LayoutOptions = {}
): LayoutMap {
  const {
    direction = 'LR',
    nodeWidth = 260,
    nodeSpacingY = 50,
    rankSpacing = 100,
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

  // 1. Add all nodes with estimated dimensions
  tables.forEach((table) => {
    const height = estimateTableHeight(table.columns?.length ?? 0);
    g.setNode(table.name, {
      width: nodeWidth,
      height,
    });
  });

  // 2. Add edges
  // In SDL, `ref.sourceTable.sourceColumn > ref.targetTable.targetColumn`
  // indicates source has FK pointing to target (parent/primary key).
  // Placing edge from target (parent) -> source (child) ensures parent is ranked to the left of child.
  refs.forEach((ref, idx) => {
    // Skip self-referencing relationships in DAG rank calculation
    if (ref.sourceTable === ref.targetTable) return;

    // Check that both tables actually exist in graph
    if (!g.hasNode(ref.sourceTable) || !g.hasNode(ref.targetTable)) return;

    if (ref.direction === '<') {
      // Source is parent, target is child
      g.setEdge(ref.sourceTable, ref.targetTable, {}, `edge-${idx}`);
    } else {
      // '>' or '-' or '<>': target is parent, source is child
      g.setEdge(ref.targetTable, ref.sourceTable, {}, `edge-${idx}`);
    }
  });

  // 3. Compute layout
  dagre.layout(g);

  // 4. Extract top-left coordinates for each table
  const positions: LayoutMap = new Map();

  tables.forEach((table) => {
    const node = g.node(table.name);
    if (node) {
      const height = estimateTableHeight(table.columns?.length ?? 0);
      positions.set(table.name, {
        x: Math.round(node.x - nodeWidth / 2),
        y: Math.round(node.y - height / 2),
      });
    } else {
      positions.set(table.name, { x: 80, y: 80 });
    }
  });

  return positions;
}
