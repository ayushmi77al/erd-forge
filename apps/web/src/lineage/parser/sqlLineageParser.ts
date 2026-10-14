import nodeSqlParser from 'node-sql-parser';
import { LineageGraph, SQLStatementSummary } from '../models/LineageGraph';
import { LineageNode, LineageColumn, ColumnReference } from '../models/LineageNode';
import { LineageEdge, ColumnLineageMapping } from '../models/LineageEdge';
import type { SQLDialect, ParseError } from '../../stores/lineageStore';
import { SymbolTable } from './SymbolTable';
import { stringifyASTExpr, walkExpression, extractClauseDependencies, extractColumnName, ColumnRefMatch } from './ASTWalker';
import { PipelineStitcher } from '../graph/PipelineStitcher';
import { ERDLinker, ERDTableSummary } from '../graph/ERDLinker';

const Parser = (nodeSqlParser as any).Parser || (nodeSqlParser as any).default?.Parser || nodeSqlParser;

function mapDialect(dialect: SQLDialect): string {
  switch (dialect) {
    case 'mssql':
      return 'transactsql';
    case 'postgresql':
      return 'postgresql';
    case 'mysql':
      return 'mysql';
    case 'sqlite':
      return 'sqlite';
    case 'oracle':
      return 'transactsql';
    case 'bigquery':
      return 'bigquery';
    case 'redshift':
      return 'redshift';
    case 'snowflake':
      return 'snowflake';
    case 'databricks':
      return 'hive'; // node-sql-parser doesn't natively have a databricks config, but hive/spark covers its syntax well
    default:
      return 'transactsql';
  }
}

export interface ParseLineageOptions {
  erdTables?: ERDTableSummary[];
}

export interface ParseLineageResult {
  graph: LineageGraph | null;
  errors: ParseError[];
}

/**
 * Parses SQL queries using node-sql-parser, SymbolTable, and ASTWalker.
 * Constructs an entity- and column-level LineageGraph with pipeline stitching and ERD linking.
 */
export function parseSQLLineage(
  sql: string,
  dialect: SQLDialect = 'mssql',
  options: ParseLineageOptions = {}
): ParseLineageResult {
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

  const parser = new Parser();
  const dbDialect = mapDialect(dialect);

  let ast: any;
  try {
    ast = parser.astify(trimmed, { database: dbDialect });
  } catch (err: any) {
    // Attempt fallback to transactsql if a specific dialect failed
    if (dbDialect !== 'transactsql') {
      try {
        ast = parser.astify(trimmed, { database: 'transactsql' });
      } catch {
        // preserve original error
      }
    }

    if (!ast) {
      const message = err.message || 'Syntax error in SQL query';
      const lineMatch = message.match(/line (\d+)/i) || message.match(/at line (\d+)/i);
      const colMatch = message.match(/col (\d+)/i) || message.match(/column (\d+)/i);

      const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
      const column = colMatch ? parseInt(colMatch[1], 10) : 1;

      return {
        graph: null,
        errors: [{ line, column, message }],
      };
    }
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  const nodeMap = new Map<string, LineageNode>();
  const edgeList: LineageEdge[] = [];
  const stmtSummaries: SQLStatementSummary[] = [];

  const symbolTable = new SymbolTable();
  let subqueryCounter = 0;

  // Helper to ensure base table node exists
  function getOrCreateTableNode(tableName: string, dbName?: string, alias?: string): LineageNode {
    const rawName = tableName.trim();
    const id = `table_${rawName.toLowerCase()}`;
    if (!nodeMap.has(id)) {
      const node: LineageNode = {
        id,
        name: rawName,
        type: 'TABLE',
        columns: [],
        alias: alias || undefined,
      };
      nodeMap.set(id, node);
    }
    const existing = nodeMap.get(id)!;
    if (alias && !existing.alias) existing.alias = alias;
    return existing;
  }

  // Helper to register column on source node if not present
  function ensureColumnOnNode(nodeId: string, colName: string): string {
    if (!colName || typeof colName !== 'string') return '';
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

  interface SelectBranch {
    ast: any;
    setOp?: string;
  }

  function collectSelectBranches(rootAst: any): SelectBranch[] {
    const branches: SelectBranch[] = [];
    let curr = rootAst;
    while (curr && typeof curr === 'object') {
      branches.push({ ast: curr, setOp: curr.set_op });
      curr = curr._next;
    }
    return branches;
  }

  // Helper to process a subquery in a FROM clause (derived table)
  function processSubqueryNode(
    fromItem: any,
    stmtIndex: number
  ): { subId: string; subAlias: string; subColumns: LineageColumn[] } {
    subqueryCounter++;
    const subId = `subquery_${subqueryCounter}`;
    const subAlias = fromItem.as || `sub_${subqueryCounter}`;
    const subAst = fromItem.expr?.ast;

    symbolTable.pushScope(subId, 'subquery');

    const subColumns: LineageColumn[] = [];
    const subSources: string[] = [];
    const allIndirectMatches: Array<ColumnRefMatch & { resolvedTableId?: string }> = [];

    const branches = collectSelectBranches(subAst);
    branches.forEach((branch, branchIdx) => {
      symbolTable.pushScope(`${subId}_b${branchIdx + 1}`, 'subquery');
      const bAst = branch.ast;
      const branchSources: string[] = [];

      // Register sources inside this branch of subquery
      if (bAst?.from && Array.isArray(bAst.from)) {
        bAst.from.forEach((subFrom: any) => {
          if (subFrom.table) {
            const resolvedTableId = symbolTable.resolveTable(subFrom.table);
            const srcId = resolvedTableId || getOrCreateTableNode(subFrom.table, subFrom.db, subFrom.as).id;
            branchSources.push(srcId);
            subSources.push(srcId);
            const knownCols = resolvedTableId && nodeMap.has(resolvedTableId)
              ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
              : [];
            symbolTable.registerTableAlias(subFrom.table, srcId, knownCols);
            if (subFrom.as) {
              symbolTable.registerTableAlias(subFrom.as, srcId, knownCols);
            }
          } else if (subFrom.expr && subFrom.expr.ast) {
            const nested = processSubqueryNode(subFrom, stmtIndex);
            branchSources.push(nested.subId);
            subSources.push(nested.subId);
            symbolTable.registerTableAlias(nested.subAlias, nested.subId, nested.subColumns.map((c) => c.name));
          }
        });
      }

      // Extract columns inside subquery branch
      if (bAst?.columns && Array.isArray(bAst.columns)) {
        bAst.columns.forEach((sc: any, scIdx: number) => {
          const scColName = extractColumnName(sc.expr?.column);
          const scName = sc.as || scColName || (sc.expr?.value !== undefined ? String(sc.expr.value) : (sc.expr?.name ? sc.expr.name : `col_${scIdx + 1}`));
          const scExpr = stringifyASTExpr(sc.expr);
          const matches = walkExpression(sc.expr, 'select', true);

          const sources: ColumnReference[] = matches.map((m) => {
            const res = symbolTable.resolveColumn(m.column, m.table);
            const tableId = res?.tableId || (m.table ? undefined : branchSources[0]) || '';
            if (tableId) {
              ensureColumnOnNode(tableId, m.column);
            }
            return {
              tableId,
              column: m.column,
              tableName: m.table,
              columnName: m.column,
            };
          });

          if (branchIdx === 0) {
            subColumns.push({
              id: `${subId}_col_${scIdx + 1}`,
              name: scName,
              expression: scExpr !== scName ? scExpr : undefined,
              sources,
            });
          } else {
            const targetCol = subColumns[scIdx];
            if (targetCol) {
              targetCol.sources.push(...sources);
            } else {
              subColumns.push({
                id: `${subId}_col_${scIdx + 1}`,
                name: scName,
                expression: scExpr !== scName ? scExpr : undefined,
                sources,
              });
            }
          }
        });
      }

      // Extract indirect dependencies inside subquery branch
      const subIndirectMatches = bAst ? extractClauseDependencies(bAst) : [];
      subIndirectMatches.forEach((im) => {
        const res = symbolTable.resolveColumn(im.column, im.table);
        const tableId = res?.tableId || (im.table ? undefined : branchSources[0]) || '';
        if (tableId) {
          ensureColumnOnNode(tableId, im.column);
          allIndirectMatches.push({ ...im, resolvedTableId: tableId });
        }
      });

      symbolTable.popScope();
    });

    const subNode: LineageNode = {
      id: subId,
      name: `Subquery (${subAlias})`,
      type: 'SUBQUERY',
      columns: subColumns,
      alias: fromItem.as,
      statementIndex: stmtIndex,
    };
    nodeMap.set(subId, subNode);

    // Create edges from subSources -> subId (STILL IN SUBQUERY SCOPE!)
    const uniqueSubSources = Array.from(new Set(subSources));
    uniqueSubSources.forEach((sId) => {
      if (sId && sId !== subId) {
        const colMappings: ColumnLineageMapping[] = [];
        subColumns.forEach((targetCol) => {
          targetCol.sources.forEach((srcRef) => {
            if (srcRef.tableId === sId) {
              const srcColId = ensureColumnOnNode(sId, srcRef.column);
              colMappings.push({
                sourceColumnId: srcColId,
                targetColumnId: targetCol.id!,
                sourceColumnName: srcRef.column,
                targetColumnName: targetCol.name,
                transformation: targetCol.expression,
                isDirect: true,
                context: 'select',
              });
            }
          });
        });

        allIndirectMatches.forEach((im) => {
          if (im.resolvedTableId === sId) {
            const srcColId = ensureColumnOnNode(sId, im.column);
            colMappings.push({
              sourceColumnId: srcColId,
              targetColumnId: `${subId}_clause_${im.context}`,
              sourceColumnName: im.column,
              transformation: im.context.toUpperCase(),
              isDirect: false,
              context: im.context,
            });
          }
        });

        edgeList.push({
          id: `edge_${sId}_to_${subId}`,
          source: sId,
          target: subId,
          sourceNodeId: sId,
          targetNodeId: subId,
          type: 'table',
          label: 'TRANSFORMS',
          columnLineage: colMappings,
        });
      }
    });

    // Pop scope only after edges are created
    symbolTable.popScope();

    return { subId, subAlias, subColumns };
  }

  // Process statements
  statements.forEach((stmt: any, stmtIdx: number) => {
    if (!stmt || typeof stmt !== 'object') return;

    symbolTable.pushScope(`stmt_${stmtIdx + 1}`, 'statement');

    stmtSummaries.push({
      index: stmtIdx + 1,
      type: (stmt.type?.toUpperCase() as any) || 'SELECT',
      rawSql: trimmed,
    });

    // 1. Process CTEs (Common Table Expressions: `WITH cte_name AS (...)`)
    if (Array.isArray(stmt.with)) {
      stmt.with.forEach((cte: any) => {
        const cteName = cte.name?.value || cte.name || 'CTE';
        const cteId = `cte_${cteName.toLowerCase()}`;

        symbolTable.pushScope(cteId, 'cte');

        const cteAst = cte.stmt?.ast || cte.stmt;
        const cteColumns: LineageColumn[] = [];
        const cteSources: string[] = [];
        const allIndirectMatches: Array<ColumnRefMatch & { resolvedTableId?: string }> = [];

        const branches = collectSelectBranches(cteAst);
        branches.forEach((branch, branchIdx) => {
          symbolTable.pushScope(`${cteId}_b${branchIdx + 1}`, 'cte');
          const bAst = branch.ast;
          const branchSources: string[] = [];

          // Register tables in CTE's FROM clause for this branch
          if (bAst?.from && Array.isArray(bAst.from)) {
            bAst.from.forEach((fromItem: any) => {
              if (fromItem.table) {
                const resolvedTableId = symbolTable.resolveTable(fromItem.table);
                const srcId = resolvedTableId || getOrCreateTableNode(fromItem.table, fromItem.db, fromItem.as).id;
                branchSources.push(srcId);
                cteSources.push(srcId);
                const knownCols = resolvedTableId && nodeMap.has(resolvedTableId)
                  ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
                  : [];
                symbolTable.registerTableAlias(fromItem.table, srcId, knownCols);
                if (fromItem.as) {
                  symbolTable.registerTableAlias(fromItem.as, srcId, knownCols);
                }
              } else if (fromItem.expr && fromItem.expr.ast) {
                const { subId, subAlias, subColumns } = processSubqueryNode(fromItem, stmtIdx + 1);
                branchSources.push(subId);
                cteSources.push(subId);
                symbolTable.registerTableAlias(subAlias, subId, subColumns.map((c) => c.name));
              }
            });
          }

          // Extract projected columns
          if (bAst?.columns && Array.isArray(bAst.columns)) {
            bAst.columns.forEach((col: any, colIdx: number) => {
              const rawColName = extractColumnName(col.expr?.column);
              const colName = col.as || rawColName || (col.expr?.value !== undefined ? String(col.expr.value) : `col_${colIdx + 1}`);
              const colExpr = stringifyASTExpr(col.expr);
              const matches = walkExpression(col.expr, 'select', true);

              const sources: ColumnReference[] = matches.map((m) => {
                const res = symbolTable.resolveColumn(m.column, m.table);
                const tableId = res?.tableId || (m.table ? undefined : branchSources[0]) || '';
                if (tableId) {
                  ensureColumnOnNode(tableId, m.column);
                }
                return {
                  tableId,
                  column: m.column,
                  tableName: m.table,
                  columnName: m.column,
                };
              });

              if (branchIdx === 0) {
                cteColumns.push({
                  id: `${cteId}_col_${colIdx + 1}`,
                  name: colName,
                  expression: colExpr !== colName ? colExpr : undefined,
                  sources,
                });
              } else {
                const targetCol = cteColumns[colIdx];
                if (targetCol) {
                  targetCol.sources.push(...sources);
                } else {
                  cteColumns.push({
                    id: `${cteId}_col_${colIdx + 1}`,
                    name: colName,
                    expression: colExpr !== colName ? colExpr : undefined,
                    sources,
                  });
                }
              }
            });
          }

          // Extract indirect clause dependencies for CTE branch
          const branchIndirect = bAst ? extractClauseDependencies(bAst) : [];
          branchIndirect.forEach((im) => {
            const res = symbolTable.resolveColumn(im.column, im.table);
            const tableId = res?.tableId || (im.table ? undefined : branchSources[0]) || '';
            if (tableId) {
              ensureColumnOnNode(tableId, im.column);
              allIndirectMatches.push({ ...im, resolvedTableId: tableId });
            }
          });

          symbolTable.popScope();
        });

        const cteNode: LineageNode = {
          id: cteId,
          name: cteName,
          type: 'CTE',
          columns: cteColumns,
          statementIndex: stmtIdx + 1,
        };
        nodeMap.set(cteId, cteNode);

        // Connect source nodes -> CTE (STILL IN CTE SCOPE!)
        const uniqueSources = Array.from(new Set(cteSources));
        uniqueSources.forEach((srcId) => {
          if (srcId && srcId !== cteId) {
            const colMappings: ColumnLineageMapping[] = [];
            cteColumns.forEach((targetCol) => {
              targetCol.sources.forEach((srcRef) => {
                if (srcRef.tableId === srcId) {
                  const srcColId = ensureColumnOnNode(srcId, srcRef.column);
                  colMappings.push({
                    sourceColumnId: srcColId,
                    targetColumnId: targetCol.id!,
                    sourceColumnName: srcRef.column,
                    targetColumnName: targetCol.name,
                    transformation: targetCol.expression,
                    isDirect: true,
                    context: 'select',
                  });
                }
              });
            });

            // Include indirect references
            allIndirectMatches.forEach((im) => {
              if (im.resolvedTableId === srcId) {
                const srcColId = ensureColumnOnNode(srcId, im.column);
                colMappings.push({
                  sourceColumnId: srcColId,
                  targetColumnId: `${cteId}_clause_${im.context}`,
                  sourceColumnName: im.column,
                  transformation: im.context.toUpperCase(),
                  isDirect: false,
                  context: im.context,
                });
              }
            });

            edgeList.push({
              id: `edge_${srcId}_to_${cteId}`,
              source: srcId,
              target: cteId,
              sourceNodeId: srcId,
              targetNodeId: cteId,
              type: 'table',
              label: 'TRANSFORMS',
              columnLineage: colMappings,
            });
          }
        });

        // Register CTE in parent statement scope only after edges are fully constructed
        symbolTable.popScope();
        symbolTable.registerTableAlias(cteName, cteId, cteColumns.map((c) => c.name));
      });
    }

    // 2. Process Main / Final Statement
    if (stmt.type === 'select') {
      const finalId = `final_query_${stmtIdx + 1}`;
      const finalColumns: LineageColumn[] = [];
      const querySources: string[] = [];
      const allIndirectMatches: Array<ColumnRefMatch & { resolvedTableId?: string }> = [];

      const branches = collectSelectBranches(stmt);
      branches.forEach((branch, branchIdx) => {
        symbolTable.pushScope(`${finalId}_b${branchIdx + 1}`, 'statement');
        const bAst = branch.ast;
        const branchSources: string[] = [];

        // Inspect FROM clause
        if (Array.isArray(bAst.from)) {
          bAst.from.forEach((fromItem: any) => {
            if (fromItem.table) {
              const resolvedTableId = symbolTable.resolveTable(fromItem.table);
              const srcId = resolvedTableId || getOrCreateTableNode(fromItem.table, fromItem.db, fromItem.as).id;
              branchSources.push(srcId);
              querySources.push(srcId);
              const knownCols = resolvedTableId && nodeMap.has(resolvedTableId)
                ? nodeMap.get(resolvedTableId)!.columns.map((c) => c.name)
                : [];
              symbolTable.registerTableAlias(fromItem.table, srcId, knownCols);
              if (fromItem.as) {
                symbolTable.registerTableAlias(fromItem.as, srcId, knownCols);
              }
            } else if (fromItem.expr && fromItem.expr.ast) {
              const { subId, subAlias, subColumns } = processSubqueryNode(fromItem, stmtIdx + 1);
              branchSources.push(subId);
              querySources.push(subId);
              symbolTable.registerTableAlias(subAlias, subId, subColumns.map((c) => c.name));
            }
          });
        }

        // Extract columns
        if (Array.isArray(bAst.columns)) {
          bAst.columns.forEach((col: any, colIdx: number) => {
            const rawColName = extractColumnName(col.expr?.column);
            const colName = col.as || rawColName || (col.expr?.value !== undefined ? String(col.expr.value) : `col_${colIdx + 1}`);
            const colExpr = stringifyASTExpr(col.expr);
            const matches = walkExpression(col.expr, 'select', true);

            const sources: ColumnReference[] = matches.map((m) => {
              const res = symbolTable.resolveColumn(m.column, m.table);
              const tableId = res?.tableId || (m.table ? undefined : branchSources[0]) || '';
              if (tableId) {
                ensureColumnOnNode(tableId, m.column);
              }
              return {
                tableId,
                column: m.column,
                tableName: m.table,
                columnName: m.column,
              };
            });

            if (branchIdx === 0) {
              finalColumns.push({
                id: `${finalId}_col_${colIdx + 1}`,
                name: colName,
                expression: colExpr !== colName ? colExpr : undefined,
                sources,
              });
            } else {
              const targetCol = finalColumns[colIdx];
              if (targetCol) {
                targetCol.sources.push(...sources);
              } else {
                finalColumns.push({
                  id: `${finalId}_col_${colIdx + 1}`,
                  name: colName,
                  expression: colExpr !== colName ? colExpr : undefined,
                  sources,
                });
              }
            }
          });
        }

        // Extract indirect clause dependencies (WHERE, JOIN ON, GROUP BY, ORDER BY, HAVING)
        const indirectMatches = bAst ? extractClauseDependencies(bAst) : [];
        indirectMatches.forEach((im) => {
          const res = symbolTable.resolveColumn(im.column, im.table);
          const tableId = res?.tableId || (im.table ? undefined : branchSources[0]) || '';
          if (tableId) {
            ensureColumnOnNode(tableId, im.column);
            allIndirectMatches.push({ ...im, resolvedTableId: tableId });
          }
        });

        symbolTable.popScope();
      });

      const finalNode: LineageNode = {
        id: finalId,
        name: 'Final Result',
        type: 'FINAL_SELECT',
        columns: finalColumns,
        statementIndex: stmtIdx + 1,
      };
      nodeMap.set(finalId, finalNode);

      // Edges to Final Result
      const uniqueSources = Array.from(new Set(querySources));
      uniqueSources.forEach((srcId) => {
        if (srcId && srcId !== finalId) {
          const colMappings: ColumnLineageMapping[] = [];
          finalColumns.forEach((targetCol) => {
            targetCol.sources.forEach((srcRef) => {
              if (srcRef.tableId === srcId) {
                const srcColId = ensureColumnOnNode(srcId, srcRef.column);
                colMappings.push({
                  sourceColumnId: srcColId,
                  targetColumnId: targetCol.id!,
                  sourceColumnName: srcRef.column,
                  targetColumnName: targetCol.name,
                  transformation: targetCol.expression,
                  isDirect: true,
                  context: 'select',
                });
              }
            });
          });

          // Include indirect references
          allIndirectMatches.forEach((im) => {
            if (im.resolvedTableId === srcId) {
              const srcColId = ensureColumnOnNode(srcId, im.column);
              colMappings.push({
                sourceColumnId: srcColId,
                targetColumnId: `${finalId}_clause_${im.context}`,
                sourceColumnName: im.column,
                transformation: im.context.toUpperCase(),
                isDirect: false,
                context: im.context,
              });
            }
          });

          edgeList.push({
            id: `edge_${srcId}_to_${finalId}`,
            source: srcId,
            target: finalId,
            sourceNodeId: srcId,
            targetNodeId: finalId,
            type: 'table',
            label: 'OUTPUT',
            columnLineage: colMappings,
          });
        }
      });
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

  // 1. Pipeline stitching for cross-statement dependencies
  const stitchedGraph = PipelineStitcher.stitch(baseGraph);

  // 2. ERD reconciliation (linking known tables vs phantom CTEs/temp tables)
  const linkedGraph = ERDLinker.link(stitchedGraph, options.erdTables || []);

  return {
    graph: linkedGraph,
    errors: [],
  };
}
