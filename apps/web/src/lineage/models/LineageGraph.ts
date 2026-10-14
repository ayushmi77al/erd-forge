import { LineageNode } from './LineageNode';
import { LineageEdge } from './LineageEdge';

export interface SQLStatementSummary {
  index: number;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'MERGE';
  targetTable?: string;
  rawSql: string;
}

export interface LineageGraph {
  /** All entities in the lineage graph (tables, CTEs, subqueries, outer query) */
  nodes: LineageNode[];
  /** All directed dependency edges between entities or columns */
  edges: LineageEdge[];
  /** Breakdown of individual statements found in the SQL script */
  statements?: SQLStatementSummary[];
  /** ISO timestamp of when the lineage graph was computed */
  generatedAt: string;
}
