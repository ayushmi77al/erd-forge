export interface LayoutTable {
  id?: string;
  name: string;
  schema?: string;
  domain?: string;
  columns?: any[];
  measuredWidth?: number;
  measuredHeight?: number;
}

export interface LayoutRef {
  sourceSchema?: string;
  sourceTable: string;
  sourceColumn?: string;
  direction?: string;
  targetSchema?: string;
  targetTable: string;
  targetColumn?: string;
}

export interface LayoutOptions {
  direction?: "LR" | "TB";
  nodeWidth?: number;
  nodeSpacingX?: number;
  nodeSpacingY?: number;
  rankSpacing?: number;
  signal?: AbortSignal;
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
  return Math.max(100, HEADER_HEIGHT + columnCount * COLUMN_HEIGHT + FOOTER_PADDING);
}

/**
 * Derives a collision-free identifier for a table.
 */
export function getTableKey(schema?: string, name?: string, id?: string): string {
  if (id) return id;
  if (!name) return "unknown";
  if (schema && !name.includes(".")) {
    return `${schema}.${name}`;
  }
  return name;
}
