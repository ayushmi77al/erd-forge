import { ERDLinker } from "../graph/ERDLinker";
import { PipelineStitcher } from "../graph/PipelineStitcher";
import type { ColumnLineageMapping, LineageEdge } from "../models/LineageEdge";
import type { LineageGraph, SQLStatementSummary } from "../models/LineageGraph";
import type { ColumnReference, LineageColumn, LineageNode } from "../models/LineageNode";
import type { ParseError, ParseLineageOptions, ParseLineageResult, SQLDialect } from "../types";
import type {
  NormalizedColumnRef,
  NormalizedFromItem,
  NormalizedSelectStatement,
  NormalizedStatement,
} from "./SqlParserAdapter";
import { SymbolTable } from "./SymbolTable";
import { WasmSqlParserAdapter } from "./WasmSqlParserAdapter";

export type { ParseLineageOptions, ParseLineageResult };

const defaultWasmAdapter = new WasmSqlParserAdapter();

function toEdgeContext(ctx?: string): "select" | "where" | "join" | "group_by" | "order_by" {
  if (ctx === "select" || ctx === "where" || ctx === "join" || ctx === "group_by" || ctx === "order_by") {
    return ctx;
  }
  return "where";
}

function toSummaryType(type: string): "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "MERGE" {
  if (type === "INSERT" || type === "UPDATE" || type === "DELETE" || type === "MERGE") {
    return type;
  }
  if (type === "CREATE_TABLE" || type === "CREATE_VIEW") {
    return "INSERT";
  }
  return "SELECT";
}

/**
 * Builds a standardized LineageGraph from NormalizedStatement contracts.
 */
export function buildLineageFromNormalized(
  statements: NormalizedStatement[],
  rawSql: string,
  options: ParseLineageOptions = {},
): LineageGraph {
  const nodeMap = new Map<string, LineageNode>();
  const edgeList: LineageEdge[] = [];
  const stmtSummaries: SQLStatementSummary[] = [];

  const symbolTable = new SymbolTable();
  const adapter = defaultWasmAdapter;
  let subqueryCounter = 0;

  function getOrCreateTableNode(tableName: string, schemaName?: string, alias?: string): LineageNode {
    const rawName = schemaName ? `${schemaName}.${tableName}`.trim() : tableName.trim();
    const id = `table_${rawName.toLowerCase()}`;
    if (!nodeMap.has(id)) {
      const node: LineageNode = {
        id,
        name: rawName,
        type: "TABLE",
        columns: [],
        alias: alias || undefined,
      };
      nodeMap.set(id, node);
    }
    const existing = nodeMap.get(id)!;
    if (alias && !existing.alias) existing.alias = alias;
    return existing;
  }

  function ensureColumnOnNode(nodeId: string, colName: string): string {
    if (!colName || typeof colName !== "string") return "";
    const node = nodeMap.get(nodeId);
    if (!node) return `${nodeId}_${colName}`;

    let col = node.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
    if (!col) {
      const colId = `${node.id}_col_${node.columns.length + 1}`;
      col = {
        id: colId,
        name: colName,
        sources: [],
      };
      node.columns.push(col);
    }
    return col.id || `${node.id}_${colName}`;
  }

  function extractIndirectRefs(selectStmt: NormalizedSelectStatement): NormalizedColumnRef[] {
    const refs: NormalizedColumnRef[] = [];
    if (selectStmt.where) {
      refs.push(...adapter.extractColumnReferences(selectStmt.where, "where"));
    }
    if (selectStmt.having) {
      refs.push(...adapter.extractColumnReferences(selectStmt.having, "having"));
    }
    if (selectStmt.qualify) {
      refs.push(...adapter.extractColumnReferences(selectStmt.qualify, "qualify"));
    }
    if (selectStmt.groupBy) {
      refs.push(...adapter.extractColumnReferences(selectStmt.groupBy, "group_by"));
    }
    if (selectStmt.from) {
      for (const item of selectStmt.from) {
        if (item.onCondition) {
          refs.push(...adapter.extractColumnReferences(item.onCondition, "join"));
        }
        if (item.usingColumns) {
          for (const uCol of item.usingColumns) {
            refs.push({ column: uCol, context: "join" });
          }
        }
      }
    }
    return refs;
  }

  function processSubqueryNode(
    fromItem: NormalizedFromItem,
    stmtIndex: number,
  ): { subId: string; subAlias: string; subColumns: LineageColumn[] } {
    subqueryCounter++;
    const subId = `subquery_${subqueryCounter}`;
    const subAlias = fromItem.alias || `sub_${subqueryCounter}`;
    const subSelect = fromItem.subquery!;

    symbolTable.pushScope(subId, "subquery");

    const subColumns: LineageColumn[] = [];
    const subSources: string[] = [];
    const allIndirectMatches: Array<NormalizedColumnRef & { resolvedTableId?: string }> = [];

    // 1. Register sources
    if (subSelect?.from) {
      for (const item of subSelect.from) {
        if (item.type === "table") {
          const tableName = item.tableName || "unknown";
          const resolvedTableId = symbolTable.resolveTable(tableName);
          const srcId = resolvedTableId || getOrCreateTableNode(tableName, item.schemaName, item.alias).id;
          subSources.push(srcId);

          const knownCols =
            resolvedTableId && nodeMap.has(resolvedTableId)
              ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
              : [];
          symbolTable.registerTableAlias(tableName, srcId, knownCols);
          if (item.schemaName) {
            symbolTable.registerTableAlias(`${item.schemaName}.${tableName}`, srcId, knownCols);
          }
          if (item.alias) {
            symbolTable.registerTableAlias(item.alias, srcId, knownCols);
          }
        } else if (item.type === "subquery" && item.subquery) {
          const nested = processSubqueryNode(item, stmtIndex);
          subSources.push(nested.subId);
          symbolTable.registerTableAlias(
            nested.subAlias,
            nested.subId,
            nested.subColumns.map((c) => c.name),
          );
        }
      }
    }

    // 2. Extract columns
    if (subSelect?.columns) {
      subSelect.columns.forEach((col, colIdx) => {
        const colName = col.alias || col.name || `col_${colIdx + 1}`;
        const sources: ColumnReference[] = col.sourceReferences.map((ref) => {
          const res = symbolTable.resolveColumn(ref.column, ref.table);
          const tableId = res?.tableId || (ref.table ? undefined : subSources[0]) || "";
          if (tableId) {
            ensureColumnOnNode(tableId, ref.column);
          }
          return {
            tableId,
            column: ref.column,
            tableName: ref.table,
            columnName: ref.column,
          };
        });

        subColumns.push({
          id: `${subId}_col_${colIdx + 1}`,
          name: colName,
          expression: col.rawExpression !== colName ? col.rawExpression : undefined,
          sources,
        });
      });
    }

    // 3. Indirect clause dependencies
    const indirectRefs = extractIndirectRefs(subSelect);
    for (const im of indirectRefs) {
      const res = symbolTable.resolveColumn(im.column, im.table);
      const tableId = res?.tableId || (im.table ? undefined : subSources[0]) || "";
      if (tableId) {
        ensureColumnOnNode(tableId, im.column);
        allIndirectMatches.push({ ...im, resolvedTableId: tableId });
      }
    }

    const subNode: LineageNode = {
      id: subId,
      name: `Subquery (${subAlias})`,
      type: "SUBQUERY",
      columns: subColumns,
      alias: fromItem.alias,
      statementIndex: stmtIndex,
    };
    nodeMap.set(subId, subNode);

    // 4. Edges from sources -> subId
    const uniqueSubSources = Array.from(new Set(subSources));
    for (const sId of uniqueSubSources) {
      if (sId && sId !== subId) {
        const colMappings: ColumnLineageMapping[] = [];
        for (const targetCol of subColumns) {
          for (const srcRef of targetCol.sources) {
            if (srcRef.tableId === sId) {
              const srcColId = ensureColumnOnNode(sId, srcRef.column);
              colMappings.push({
                sourceColumnId: srcColId,
                targetColumnId: targetCol.id!,
                sourceColumnName: srcRef.column,
                targetColumnName: targetCol.name,
                transformation: targetCol.expression,
                isDirect: true,
                context: "select",
              });
            }
          }
        }

        for (const im of allIndirectMatches) {
          if (im.resolvedTableId === sId) {
            const srcColId = ensureColumnOnNode(sId, im.column);
            const edgeCtx = toEdgeContext(im.context);
            colMappings.push({
              sourceColumnId: srcColId,
              targetColumnId: `${subId}_clause_${im.context || "where"}`,
              sourceColumnName: im.column,
              transformation: (im.context || "WHERE").toUpperCase(),
              isDirect: false,
              context: edgeCtx,
            });
          }
        }

        edgeList.push({
          id: `edge_${sId}_to_${subId}`,
          source: sId,
          target: subId,
          sourceNodeId: sId,
          targetNodeId: subId,
          type: "table",
          label: "TRANSFORMS",
          columnLineage: colMappings,
        });
      }
    }

    symbolTable.popScope();
    return { subId, subAlias, subColumns };
  }

  // Iterate over normalized statements
  statements.forEach((stmt, stmtIdx) => {
    symbolTable.pushScope(`stmt_${stmtIdx + 1}`, "statement");

    stmtSummaries.push({
      index: stmtIdx + 1,
      type: toSummaryType(stmt.type),
      rawSql,
    });

    // 1. Process CTEs
    if (stmt.ctes && stmt.ctes.length > 0) {
      for (const cte of stmt.ctes) {
        const cteName = cte.name;
        const cteId = `cte_${cteName.toLowerCase()}`;

        symbolTable.pushScope(cteId, "cte");

        const cteColumns: LineageColumn[] = [];
        const cteSources: string[] = [];
        const allIndirectMatches: Array<NormalizedColumnRef & { resolvedTableId?: string }> = [];

        // Register sources in CTE FROM clause
        if (cte.statement.from) {
          for (const item of cte.statement.from) {
            if (item.type === "table") {
              const tableName = item.tableName || "unknown";
              const resolvedTableId = symbolTable.resolveTable(tableName);
              const srcId = resolvedTableId || getOrCreateTableNode(tableName, item.schemaName, item.alias).id;
              cteSources.push(srcId);

              const knownCols =
                resolvedTableId && nodeMap.has(resolvedTableId)
                  ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
                  : [];
              symbolTable.registerTableAlias(tableName, srcId, knownCols);
              if (item.schemaName) {
                symbolTable.registerTableAlias(`${item.schemaName}.${tableName}`, srcId, knownCols);
              }
              if (item.alias) {
                symbolTable.registerTableAlias(item.alias, srcId, knownCols);
              }
            } else if (item.type === "subquery" && item.subquery) {
              const { subId, subAlias, subColumns } = processSubqueryNode(item, stmtIdx + 1);
              cteSources.push(subId);
              symbolTable.registerTableAlias(
                subAlias,
                subId,
                subColumns.map((c) => c.name),
              );
            }
          }
        }

        // Extract projected columns
        if (cte.statement.columns) {
          cte.statement.columns.forEach((col, colIdx) => {
            const explicitAlias = cte.columnAliases?.[colIdx];
            const colName = explicitAlias || col.alias || col.name || `col_${colIdx + 1}`;
            const sources: ColumnReference[] = col.sourceReferences.map((ref) => {
              const res = symbolTable.resolveColumn(ref.column, ref.table);
              const tableId = res?.tableId || (ref.table ? undefined : cteSources[0]) || "";
              if (tableId) {
                ensureColumnOnNode(tableId, ref.column);
              }
              return {
                tableId,
                column: ref.column,
                tableName: ref.table,
                columnName: ref.column,
              };
            });

            cteColumns.push({
              id: `${cteId}_col_${colIdx + 1}`,
              name: colName,
              expression: col.rawExpression !== colName ? col.rawExpression : undefined,
              sources,
            });
          });
        }

        // Indirect dependencies
        const indirectRefs = extractIndirectRefs(cte.statement);
        for (const im of indirectRefs) {
          const res = symbolTable.resolveColumn(im.column, im.table);
          const tableId = res?.tableId || (im.table ? undefined : cteSources[0]) || "";
          if (tableId) {
            ensureColumnOnNode(tableId, im.column);
            allIndirectMatches.push({ ...im, resolvedTableId: tableId });
          }
        }

        const cteNode: LineageNode = {
          id: cteId,
          name: cteName,
          type: "CTE",
          columns: cteColumns,
          statementIndex: stmtIdx + 1,
        };
        nodeMap.set(cteId, cteNode);

        // Edges: source nodes -> CTE
        const uniqueSources = Array.from(new Set(cteSources));
        for (const srcId of uniqueSources) {
          if (srcId && srcId !== cteId) {
            const colMappings: ColumnLineageMapping[] = [];
            for (const targetCol of cteColumns) {
              for (const srcRef of targetCol.sources) {
                if (srcRef.tableId === srcId) {
                  const srcColId = ensureColumnOnNode(srcId, srcRef.column);
                  colMappings.push({
                    sourceColumnId: srcColId,
                    targetColumnId: targetCol.id!,
                    sourceColumnName: srcRef.column,
                    targetColumnName: targetCol.name,
                    transformation: targetCol.expression,
                    isDirect: true,
                    context: "select",
                  });
                }
              }
            }

            for (const im of allIndirectMatches) {
              if (im.resolvedTableId === srcId) {
                const srcColId = ensureColumnOnNode(srcId, im.column);
                const edgeCtx = toEdgeContext(im.context);
                colMappings.push({
                  sourceColumnId: srcColId,
                  targetColumnId: `${cteId}_clause_${im.context || "where"}`,
                  sourceColumnName: im.column,
                  transformation: (im.context || "WHERE").toUpperCase(),
                  isDirect: false,
                  context: edgeCtx,
                });
              }
            }

            edgeList.push({
              id: `edge_${srcId}_to_${cteId}`,
              source: srcId,
              target: cteId,
              sourceNodeId: srcId,
              targetNodeId: cteId,
              type: "table",
              label: "TRANSFORMS",
              columnLineage: colMappings,
            });
          }
        }

        symbolTable.popScope();
        symbolTable.registerTableAlias(
          cteName,
          cteId,
          cteColumns.map((c) => c.name),
        );
      }
    }

    // 2. Process Query Body (SelectStatement)
    if (stmt.selectStatement) {
      const selectStmt = stmt.selectStatement;
      const isTargeted = Boolean(
        stmt.targetTable && stmt.targetTable.tableName && stmt.targetTable.tableName !== "unknown",
      );

      const targetRawName = isTargeted
        ? stmt.targetTable!.schemaName
          ? `${stmt.targetTable!.schemaName}.${stmt.targetTable!.tableName}`
          : stmt.targetTable!.tableName
        : "Final Result";

      const targetId = isTargeted ? `table_${targetRawName.toLowerCase()}` : `final_query_${stmtIdx + 1}`;

      const targetType = isTargeted ? (stmt.type === "CREATE_VIEW" ? "VIEW" : "TABLE") : "FINAL_SELECT";

      const finalColumns: LineageColumn[] = [];
      const querySources: string[] = [];
      const allIndirectMatches: Array<NormalizedColumnRef & { resolvedTableId?: string }> = [];

      // Inspect FROM clause
      if (selectStmt.from) {
        for (const item of selectStmt.from) {
          if (item.type === "table") {
            const tableName = item.tableName || "unknown";
            const resolvedTableId = symbolTable.resolveTable(tableName);
            const srcId = resolvedTableId || getOrCreateTableNode(tableName, item.schemaName, item.alias).id;
            querySources.push(srcId);

            const knownCols =
              resolvedTableId && nodeMap.has(resolvedTableId)
                ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
                : [];
            symbolTable.registerTableAlias(tableName, srcId, knownCols);
            if (item.schemaName) {
              symbolTable.registerTableAlias(`${item.schemaName}.${tableName}`, srcId, knownCols);
            }
            if (item.alias) {
              symbolTable.registerTableAlias(item.alias, srcId, knownCols);
            }
          } else if (item.type === "subquery" && item.subquery) {
            const { subId, subAlias, subColumns } = processSubqueryNode(item, stmtIdx + 1);
            querySources.push(subId);
            symbolTable.registerTableAlias(
              subAlias,
              subId,
              subColumns.map((c) => c.name),
            );
          }
        }
      }

      // Extract columns
      if (selectStmt.columns) {
        selectStmt.columns.forEach((col, colIdx) => {
          const colName = col.alias || col.name || `col_${colIdx + 1}`;
          const sources: ColumnReference[] = col.sourceReferences.map((ref) => {
            const res = symbolTable.resolveColumn(ref.column, ref.table);
            const tableId = res?.tableId || (ref.table ? undefined : querySources[0]) || "";
            if (tableId) {
              ensureColumnOnNode(tableId, ref.column);
            }
            return {
              tableId,
              column: ref.column,
              tableName: ref.table,
              columnName: ref.column,
            };
          });

          finalColumns.push({
            id: `${targetId}_col_${colIdx + 1}`,
            name: colName,
            expression: col.rawExpression !== colName ? col.rawExpression : undefined,
            sources,
          });
        });
      }

      // Set Operations (UNION, UNION ALL)
      if (selectStmt.setOperations && selectStmt.setOperations.length > 0) {
        for (const setOp of selectStmt.setOperations) {
          const setStmt = setOp.statement;
          if (setStmt.from) {
            for (const item of setStmt.from) {
              if (item.type === "table") {
                const tableName = item.tableName || "unknown";
                const resolvedTableId = symbolTable.resolveTable(tableName);
                const srcId = resolvedTableId || getOrCreateTableNode(tableName, item.schemaName, item.alias).id;
                querySources.push(srcId);
              }
            }
          }

          if (setStmt.columns) {
            setStmt.columns.forEach((col, colIdx) => {
              const targetCol = finalColumns[colIdx];
              if (targetCol) {
                for (const ref of col.sourceReferences) {
                  const res = symbolTable.resolveColumn(ref.column, ref.table);
                  const tableId = res?.tableId || (ref.table ? undefined : querySources[querySources.length - 1]) || "";
                  if (tableId) {
                    ensureColumnOnNode(tableId, ref.column);
                    targetCol.sources.push({
                      tableId,
                      column: ref.column,
                      tableName: ref.table,
                      columnName: ref.column,
                    });
                  }
                }
              }
            });
          }
        }
      }

      // Indirect clause dependencies
      const indirectRefs = extractIndirectRefs(selectStmt);
      for (const im of indirectRefs) {
        const res = symbolTable.resolveColumn(im.column, im.table);
        const tableId = res?.tableId || (im.table ? undefined : querySources[0]) || "";
        if (tableId) {
          ensureColumnOnNode(tableId, im.column);
          allIndirectMatches.push({ ...im, resolvedTableId: tableId });
        }
      }

      const finalNode: LineageNode = {
        id: targetId,
        name: targetRawName,
        type: targetType,
        columns: finalColumns,
        statementIndex: stmtIdx + 1,
      };
      nodeMap.set(targetId, finalNode);

      // Edges to final node
      const uniqueSources = Array.from(new Set(querySources));
      for (const srcId of uniqueSources) {
        if (srcId && srcId !== targetId) {
          const colMappings: ColumnLineageMapping[] = [];
          for (const targetCol of finalColumns) {
            for (const srcRef of targetCol.sources) {
              if (srcRef.tableId === srcId) {
                const srcColId = ensureColumnOnNode(srcId, srcRef.column);
                colMappings.push({
                  sourceColumnId: srcColId,
                  targetColumnId: targetCol.id!,
                  sourceColumnName: srcRef.column,
                  targetColumnName: targetCol.name,
                  transformation: targetCol.expression,
                  isDirect: true,
                  context: "select",
                });
              }
            }
          }

          for (const im of allIndirectMatches) {
            if (im.resolvedTableId === srcId) {
              const srcColId = ensureColumnOnNode(srcId, im.column);
              const edgeCtx = toEdgeContext(im.context);
              colMappings.push({
                sourceColumnId: srcColId,
                targetColumnId: `${targetId}_clause_${im.context || "where"}`,
                sourceColumnName: im.column,
                transformation: (im.context || "WHERE").toUpperCase(),
                isDirect: false,
                context: edgeCtx,
              });
            }
          }

          edgeList.push({
            id: `edge_${srcId}_to_${targetId}`,
            source: srcId,
            target: targetId,
            sourceNodeId: srcId,
            targetNodeId: targetId,
            type: "table",
            label: isTargeted ? "TARGET" : "OUTPUT",
            columnLineage: colMappings,
          });
        }
      }
    }

    symbolTable.popScope();
  });

  const nodes = Array.from(nodeMap.values());

  const baseGraph: LineageGraph = {
    nodes,
    edges: edgeList,
    statements: stmtSummaries,
    generatedAt: new Date().toISOString(),
  };

  const stitchedGraph = PipelineStitcher.stitch(baseGraph);
  const linkedGraph = ERDLinker.link(stitchedGraph, options.erdTables || []);

  return linkedGraph;
}

/**
 * End-to-end SQL Lineage parser powered by WASM sqlparser-rs and AST Normalization.
 */
export async function parseSQLLineageWasm(
  sql: string,
  dialect: SQLDialect = "mssql",
  options: ParseLineageOptions = {},
): Promise<ParseLineageResult> {
  const trimmed = sql.trim();
  if (!trimmed) {
    return {
      graph: {
        nodes: [],
        edges: [],
        generatedAt: new Date().toISOString(),
      },
      errors: [],
    };
  }

  const parseResult = await defaultWasmAdapter.parse(trimmed, dialect);
  if (parseResult.errors.length > 0) {
    return {
      graph: null,
      errors: parseResult.errors.map((e) => ({
        line: e.line,
        column: e.column,
        message: e.message,
      })),
    };
  }

  const graph = buildLineageFromNormalized(parseResult.statements, trimmed, options);
  return {
    graph,
    errors: [],
  };
}
