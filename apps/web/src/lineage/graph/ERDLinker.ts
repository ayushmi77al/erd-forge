import { LineageGraph } from '../models/LineageGraph';
import { LineageNode } from '../models/LineageNode';

export interface ERDTableSummary {
  id: string;
  name: string;
  columns?: Array<{ name: string; type?: string }>;
}

/**
 * ERDLinker connects SQL Lineage nodes with the user's active ERD Forge data model.
 * Nodes that match tables in the ERD schema are flagged as isPhantom: false with linkedEntityId,
 * while CTEs, subqueries, or external unmodeled tables are flagged as isPhantom: true.
 */
export class ERDLinker {
  static link(graph: LineageGraph, erdTables: ERDTableSummary[] = []): LineageGraph {
    if (!graph || graph.nodes.length === 0) return graph;

    const tableLookup = new Map<string, ERDTableSummary>();
    erdTables.forEach((t) => {
      tableLookup.set(t.name.trim().toLowerCase(), t);
    });

    const updatedNodes: LineageNode[] = graph.nodes.map((node) => {
      // CTEs and Subqueries are always local query constructs (phantom relative to physical ERD)
      if (node.type === 'CTE' || node.type === 'SUBQUERY' || node.type === 'FINAL_SELECT') {
        return {
          ...node,
          isPhantom: true,
        };
      }

      // Base tables or views
      const matched = tableLookup.get(node.name.trim().toLowerCase());
      if (matched) {
        // Enrich columns with data types from ERD if missing
        const enrichedColumns = node.columns.map((col) => {
          if (!col.dataType && matched.columns) {
            const matchedCol = matched.columns.find((mc) => mc.name.toLowerCase() === col.name.toLowerCase());
            if (matchedCol && matchedCol.type) {
              return { ...col, dataType: matchedCol.type };
            }
          }
          return col;
        });

        return {
          ...node,
          columns: enrichedColumns,
          isPhantom: false,
          linkedEntityId: matched.id,
        };
      }

      // Table referenced in SQL but not present in ERD schema
      return {
        ...node,
        isPhantom: true,
      };
    });

    return {
      ...graph,
      nodes: updatedNodes,
    };
  }
}
