import type { DialectName } from "@guanmingchiu/sqlparser-ts";
import type { SQLDialect } from "../types";

export type WasmDialect = DialectName;

/**
 * Validated mapping from ERD Forge's SQLDialect to @guanmingchiu/sqlparser-ts DialectName.
 * Covers all supported production dialects with strong typing.
 */
export function mapToWasmDialect(dialect: SQLDialect): WasmDialect {
  switch (dialect) {
    case "mssql":
      return "mssql";
    case "postgresql":
      return "postgresql";
    case "mysql":
      return "mysql";
    case "sqlite":
      return "sqlite";
    case "oracle":
      return "oracle";
    case "bigquery":
      return "bigquery";
    case "redshift":
      return "redshift";
    case "snowflake":
      return "snowflake";
    case "databricks":
      return "databricks";
    default:
      return "generic";
  }
}

export type StatementType =
  | "SELECT"
  | "CREATE_TABLE"
  | "CREATE_VIEW"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "MERGE"
  | "OTHER";

export type SetOperatorType = "UNION" | "UNION_ALL" | "INTERSECT" | "EXCEPT";

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS" | "NATURAL" | "NONE";

export type ClauseContext = "select" | "where" | "join" | "group_by" | "order_by" | "having" | "qualify";

export interface NormalizedColumnRef {
  table?: string;
  column: string;
  context?: ClauseContext;
}

export interface NormalizedColumn {
  /** Name or alias of the output column */
  name: string;
  /** Explicit alias if specified via AS alias */
  alias?: string;
  /** AST expression node representing the column logic */
  expr?: any;
  /** Stringified representation of the column expression */
  rawExpression?: string;
  /** Direct column references found within this projection */
  sourceReferences: NormalizedColumnRef[];
  /** True if this is a wildcard/star projection (*) */
  isStar?: boolean;
  /** Optional table prefix for scoped wildcards (e.g. `u.*` -> 'u') */
  starTablePrefix?: string;
}

export interface NormalizedFromItem {
  type: "table" | "subquery" | "function";
  tableName?: string;
  schemaName?: string;
  databaseName?: string;
  alias?: string;
  subquery?: NormalizedSelectStatement;
  functionCall?: {
    name: string;
    args: any[];
  };
  joinType?: JoinType;
  onCondition?: any;
  usingColumns?: string[];
}

export interface NormalizedSetOperation {
  operator: SetOperatorType;
  statement: NormalizedSelectStatement;
}

export interface NormalizedSelectStatement {
  columns: NormalizedColumn[];
  from: NormalizedFromItem[];
  where?: any;
  groupBy?: any[];
  having?: any;
  qualify?: any;
  orderBy?: any[];
  distinct?: boolean;
  limit?: number;
  setOperations?: NormalizedSetOperation[];
}

export interface NormalizedCTE {
  name: string;
  alias?: string;
  columnAliases?: string[];
  statement: NormalizedSelectStatement;
}

export interface NormalizedTargetTable {
  tableName: string;
  schemaName?: string;
  databaseName?: string;
  columns?: string[];
}

export interface NormalizedStatement {
  type: StatementType;
  targetTable?: NormalizedTargetTable;
  ctes: NormalizedCTE[];
  selectStatement?: NormalizedSelectStatement;
  rawAst?: any;
}

export interface NormalizedParseError {
  line?: number;
  column?: number;
  message: string;
  dialect?: string;
}

export interface NormalizedParseResult {
  statements: NormalizedStatement[];
  errors: NormalizedParseError[];
}

/**
 * Standardized interface for vendor-agnostic SQL parser adapters.
 * Both legacy node-sql-parser and modern WASM sqlparser-ts implement this contract.
 */
export interface SqlParserAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  initialize(): Promise<void>;
  parse(sql: string, dialect: SQLDialect): Promise<NormalizedParseResult> | NormalizedParseResult;
}

// ---------------------------------------------------------------------------
// Helpers & Factory Functions
// ---------------------------------------------------------------------------

export function createEmptyNormalizedSelect(): NormalizedSelectStatement {
  return {
    columns: [],
    from: [],
  };
}

export function createEmptyNormalizedStatement(type: StatementType = "SELECT"): NormalizedStatement {
  return {
    type,
    ctes: [],
    selectStatement: type === "SELECT" ? createEmptyNormalizedSelect() : undefined,
  };
}

export function isSelectStatement(stmt: NormalizedStatement): boolean {
  return stmt.type === "SELECT" && stmt.selectStatement !== undefined;
}

export function isDdlOrDml(stmt: NormalizedStatement): boolean {
  return stmt.type !== "SELECT" && stmt.type !== "OTHER";
}

/**
 * Recursively collects all base table references from a NormalizedSelectStatement,
 * descending into subqueries and set operations.
 */
export function collectAllFromTables(select: NormalizedSelectStatement): NormalizedFromItem[] {
  const tables: NormalizedFromItem[] = [];

  for (const item of select.from) {
    if (item.type === "table" && item.tableName) {
      tables.push(item);
    } else if (item.type === "subquery" && item.subquery) {
      tables.push(...collectAllFromTables(item.subquery));
    }
  }

  if (select.setOperations) {
    for (const setOp of select.setOperations) {
      tables.push(...collectAllFromTables(setOp.statement));
    }
  }

  return tables;
}

/**
 * Recursively collects all nested subqueries from FROM clauses and set operations.
 */
export function collectAllSubqueries(select: NormalizedSelectStatement): NormalizedSelectStatement[] {
  const subqueries: NormalizedSelectStatement[] = [];

  for (const item of select.from) {
    if (item.type === "subquery" && item.subquery) {
      subqueries.push(item.subquery);
      subqueries.push(...collectAllSubqueries(item.subquery));
    }
  }

  if (select.setOperations) {
    for (const setOp of select.setOperations) {
      subqueries.push(setOp.statement);
      subqueries.push(...collectAllSubqueries(setOp.statement));
    }
  }

  return subqueries;
}
