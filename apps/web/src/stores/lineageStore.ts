import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { LineageGraph } from '../lineage/models/LineageGraph';
import { parseSQLLineage } from '../lineage/parser/sqlLineageParser';

export type SQLDialect = 'mssql' | 'postgresql' | 'mysql' | 'oracle' | 'sqlite' | 'bigquery' | 'redshift' | 'snowflake' | 'databricks';
export type LineageViewMode = 'table' | 'column';

export interface ParseError {
  line?: number;
  column?: number;
  message: string;
}

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
  const initResult = parseSQLLineage(DEFAULT_SAMPLE_SQL, 'mssql');
  initialGraph = initResult.graph;
  initialErrors = initResult.errors;
} catch {
  // Graceful fallback
}

interface LineageState {
  sql: string;
  dialect: SQLDialect;
  graph: LineageGraph | null;
  parseErrors: ParseError[];
  isParsing: boolean;
  viewMode: LineageViewMode;
  layoutDirection: 'LR' | 'TB';
  cardDisplayMode: 'full' | 'compact';
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
  setGraph: (graph: LineageGraph | null) => void;
  setParseErrors: (errors: ParseError[]) => void;
  setIsParsing: (isParsing: boolean) => void;
  setViewMode: (mode: LineageViewMode) => void;
  setLayoutDirection: (dir: 'LR' | 'TB') => void;
  setCardDisplayMode: (mode: 'full' | 'compact') => void;
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
    dialect: 'mssql',
    graph: initialGraph,
    parseErrors: initialErrors,
    isParsing: false,
    viewMode: 'table',
    layoutDirection: 'LR',
    cardDisplayMode: 'full',
    isSQLEditorOpen: true,
    isInspectorOpen: true,
    activeSampleId: 'ecommerce-cte',
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
  }))
);
