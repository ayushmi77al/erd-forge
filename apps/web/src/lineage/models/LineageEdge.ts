export type LineageEdgeType = 'table' | 'column';

export interface ColumnLineageMapping {
  sourceColumnId: string;
  targetColumnId: string;
  sourceColumnName?: string;
  targetColumnName?: string;
  transformation?: string;
  /** True for direct projection flow into SELECT, false for indirect WHERE/JOIN filter flow */
  isDirect?: boolean;
  /** SQL clause context for this column dependency */
  context?: 'select' | 'where' | 'join' | 'group_by' | 'order_by';
}

export interface LineageEdge {
  /** Unique ID for the edge */
  id: string;
  /** Source entity ID (or `${nodeId}__${colName}` for column edges) */
  source: string;
  /** Target entity ID (or `${nodeId}__${colName}` for column edges) */
  target: string;
  /** Helper source node ID (always table/CTE node id) */
  sourceNodeId?: string;
  /** Helper target node ID (always table/CTE node id) */
  targetNodeId?: string;
  /** Handle ID on source node (for React Flow handle mapping) */
  sourceHandle?: string;
  /** Handle ID on target node (for React Flow handle mapping) */
  targetHandle?: string;
  /** Whether this edge represents table-level or column-level data flow */
  type: LineageEdgeType;
  /** Optional label on the edge, e.g. "LEFT JOIN", "GROUP BY", or transformation function */
  label?: string;
  /** True if the data passed through a transformation function/expression */
  isTransform?: boolean;
  /** Granular column level mappings carried by this edge */
  columnLineage?: ColumnLineageMapping[];
}
