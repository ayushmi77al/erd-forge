import type { LineageGraph, ParseError, ParserEngine, SQLDialect } from "@erd-forge/lineage";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { getInitialParserEngine, persistParserEngine } from "../lineage/parser/parserFeatureFlag";
import { parseSQLLineage } from "../lineage/parser/sqlLineageParser";

export type { ParseError, ParserEngine, SQLDialect };

export type LineageViewMode = "table" | "column";

const SUPPORTED_DIALECTS: ReadonlySet<SQLDialect> = new Set([
  "mssql",
  "postgresql",
  "mysql",
  "sqlite",
  "oracle",
  "bigquery",
  "redshift",
  "snowflake",
  "databricks",
]);

/**
 * Resolves initial SQL lineage dialect from URL query parameter (`?dialect=snowflake`, etc.).
 */
export function getInitialDialect(): SQLDialect {
  if (typeof window !== "undefined") {
    try {
      const param = new URLSearchParams(window.location.search).get("dialect")?.toLowerCase();
      if (param && SUPPORTED_DIALECTS.has(param as SQLDialect)) {
        return param as SQLDialect;
      }
    } catch {
      // Ignore URL parsing issues in restricted environments
    }
  }
  return "mssql";
}

const initialDialect = getInitialDialect();

const DEFAULT_SAMPLE_SQL = `-- Multi-statement SQL Pipeline Demonstration
WITH MonthlySales AS (
  SELECT 
    o.customer_id,
    c.country,
    SUM(o.amount) AS total_amount,
    COUNT(o.order_id) AS order_count
  FROM orders o
  JOIN customers c ON o.customer_id = c.customer_id
  WHERE o.status = 'COMPLETED'
  GROUP BY o.customer_id, c.country
),
TopCustomers AS (
  SELECT 
    customer_id,
    country,
    total_amount,
    DENSE_RANK() OVER (PARTITION BY country ORDER BY total_amount DESC) as rank
  FROM MonthlySales
)
SELECT 
  tc.customer_id,
  tc.country,
  tc.total_amount,
  tc.rank
FROM TopCustomers tc
WHERE tc.rank <= 5;
`;

let initialGraph: LineageGraph | null = null;
let initialErrors: ParseError[] = [];
try {
  const initResult = parseSQLLineage(DEFAULT_SAMPLE_SQL, initialDialect);
  initialGraph = initResult.graph;
  initialErrors = initResult.errors;
} catch {
  // Graceful fallback
}

interface LineageState {
  sql: string;
  dialect: SQLDialect;
  parserEngine: ParserEngine;
  graph: LineageGraph | null;
  parseErrors: ParseError[];
  isParsing: boolean;
  viewMode: LineageViewMode;
  layoutDirection: "LR" | "TB";
  cardDisplayMode: "full" | "compact";
  isSQLEditorOpen: boolean;
  isInspectorOpen: boolean;
  activeSampleId: string | null;
  selectedNodeId: string | null;
  nodePositions: Record<string, { x: number; y: number }>;
  layoutEpoch: number;
}

interface LineageActions {
  setSQL: (sql: string) => void;
  setDialect: (dialect: SQLDialect) => void;
  setParserEngine: (engine: ParserEngine) => void;
  setGraph: (graph: LineageGraph | null) => void;
  setParseErrors: (errors: ParseError[]) => void;
  setIsParsing: (isParsing: boolean) => void;
  setViewMode: (mode: LineageViewMode) => void;
  setLayoutDirection: (dir: "LR" | "TB") => void;
  setCardDisplayMode: (mode: "full" | "compact") => void;
  toggleSQLEditor: () => void;
  toggleInspector: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setNodePosition: (id: string, pos: { x: number; y: number }) => void;
  setAllNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
  triggerAutoLayout: () => void;
  loadSampleQuery: (sampleId: string) => void;
  resetGraph: () => void;
}

export type LineageStore = LineageState & LineageActions;

export const useLineageStore = create<LineageStore>()(
  immer((set) => ({
    sql: DEFAULT_SAMPLE_SQL,
    dialect: initialDialect,
    parserEngine: getInitialParserEngine(),
    graph: initialGraph,
    parseErrors: initialErrors,
    isParsing: false,
    viewMode: "table",
    layoutDirection: "LR",
    cardDisplayMode: "full",
    isSQLEditorOpen: true,
    isInspectorOpen: true,
    activeSampleId: "ecommerce-cte",
    selectedNodeId: null,
    nodePositions: {},
    layoutEpoch: 0,

    setSQL: (sql) =>
      set((state) => {
        state.sql = sql;
      }),

    setDialect: (dialect) =>
      set((state) => {
        state.dialect = dialect;
      }),

    setParserEngine: (engine) =>
      set((state) => {
        state.parserEngine = engine;
        persistParserEngine(engine);
      }),

    setGraph: (graph) =>
      set((state) => {
        state.graph = graph;
      }),

    setParseErrors: (errors) =>
      set((state) => {
        state.parseErrors = errors;
      }),

    setIsParsing: (isParsing) =>
      set((state) => {
        state.isParsing = isParsing;
      }),

    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode;
      }),

    setLayoutDirection: (dir) =>
      set((state) => {
        state.layoutDirection = dir;
      }),

    setCardDisplayMode: (mode) =>
      set((state) => {
        state.cardDisplayMode = mode;
      }),

    toggleSQLEditor: () =>
      set((state) => {
        state.isSQLEditorOpen = !state.isSQLEditorOpen;
      }),

    toggleInspector: () =>
      set((state) => {
        state.isInspectorOpen = !state.isInspectorOpen;
      }),

    setSelectedNodeId: (id) =>
      set((state) => {
        state.selectedNodeId = id;
      }),

    setNodePosition: (id, pos) =>
      set((state) => {
        state.nodePositions[id] = pos;
      }),

    setAllNodePositions: (positions) =>
      set((state) => {
        state.nodePositions = positions;
      }),

    triggerAutoLayout: () =>
      set((state) => {
        state.layoutEpoch += 1;
      }),

    loadSampleQuery: (sampleId) => {
      // dynamically resolved or matched from sampleQueries
      set((state) => {
        state.activeSampleId = sampleId;
      });
    },
    resetGraph: () =>
      set((state) => {
        state.graph = null;
        state.parseErrors = [];
        state.nodePositions = {};
      }),
  })),
);
