import type { ERDTableSummary } from "./graph/ERDLinker";
import type { LineageGraph } from "./models/LineageGraph";

export type SQLDialect =
  | "generic"
  | "mssql"
  | "postgresql"
  | "mysql"
  | "oracle"
  | "sqlite"
  | "bigquery"
  | "redshift"
  | "snowflake"
  | "databricks";

export type ParserEngine = "legacy" | "wasm" | "shadow";

export interface ParseError {
  line?: number;
  column?: number;
  message: string;
}

export interface ParseLineageOptions {
  erdTables?: ERDTableSummary[];
}

export interface ParseLineageResult {
  graph: LineageGraph | null;
  errors: ParseError[];
}
