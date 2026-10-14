export type LineageNodeType = 
  | 'table' 
  | 'view' 
  | 'cte' 
  | 'subquery' 
  | 'outer_query' 
  | 'final_select'
  | 'window_function'
  | 'set_operation'
  | 'TABLE'
  | 'VIEW'
  | 'CTE'
  | 'SUBQUERY'
  | 'FINAL_SELECT'
  | 'WINDOW_FUNCTION'
  | 'SET_OPERATION';

export interface ColumnReference {
  /** The unique ID of the source node (table, CTE, or subquery) */
  tableId: string;
  /** The column name or expression in the source entity */
  column: string;
  /** Optional display table name */
  tableName?: string;
  /** Optional display column name */
  columnName?: string;
}

export interface LineageColumn {
  /** Optional unique identifier for column handle routing */
  id?: string;
  /** Output column name or alias */
  name: string;
  /** SQL expression that computed this column (e.g. "CONCAT(first_name, ' ', last_name)" or "SUM(price)") */
  expression?: string;
  /** Optional data type if inferred */
  dataType?: string;
  /** Direct upstream sources for this column */
  sources: ColumnReference[];
}

export interface LineageNode {
  /** Unique ID within the lineage graph, e.g. "cte_ranked_sales" or "table_customers" */
  id: string;
  /** Display name of the entity, e.g. "customers", "ranked_sales", or "Subquery #1" */
  name: string;
  /** The entity category: table, view, CTE, subquery, or top-level outer query */
  type: LineageNodeType;
  /** Output columns defined by or selected from this node */
  columns: LineageColumn[];
  /** Optional SQL alias assigned to this entity in FROM / JOIN */
  alias?: string;
  /** Optional database schema name */
  schema?: string;
  /** Index of the SQL statement this node belongs to in a multi-statement script */
  statementIndex?: number;
  /** Raw SQL snippet producing this node (for CTEs and subqueries) */
  rawSql?: string;
  /** True if this node does NOT exist in the ERD schema model (phantom node) */
  isPhantom?: boolean;
  /** ID of corresponding ERD schema table if matched */
  linkedEntityId?: string;
}
