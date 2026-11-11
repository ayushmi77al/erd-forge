import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInitialParserEngine,
  PARSER_ENGINE_STORAGE_KEY,
  persistParserEngine,
} from "../../src/lineage/parser/parserFeatureFlag";
import {
  compareLineageResults,
  executeShadowParse,
  type ParserDiscrepancy,
  type ShadowParseResult,
} from "../../src/lineage/parser/ShadowRolloutComparator";
import { parseSQLLineage } from "../../src/lineage/parser/sqlLineageParser";
import { parseSQLLineageWasm } from "../../src/lineage/parser/WasmLineageBuilder";
import { useLineageStore } from "../../src/stores/lineageStore";

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

describe("T2.5: Shadow Rollout Feature Flag & Differential Telemetry", () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal("localStorage", storageMock);
    vi.stubGlobal("window", {
      location: { search: "" },
      localStorage: storageMock,
    });
    vi.restoreAllMocks();
  });

  describe("Feature Flag & Configuration Persistence", () => {
    it("defaults to 'wasm' engine when no query param or localStorage exists", () => {
      expect(getInitialParserEngine()).toBe("wasm");
    });

    it("reads engine preference from localStorage", () => {
      localStorage.setItem(PARSER_ENGINE_STORAGE_KEY, "shadow");
      expect(getInitialParserEngine()).toBe("shadow");

      localStorage.setItem(PARSER_ENGINE_STORAGE_KEY, "legacy");
      expect(getInitialParserEngine()).toBe("legacy");
    });

    it("persists engine preference to localStorage", () => {
      persistParserEngine("shadow");
      expect(localStorage.getItem(PARSER_ENGINE_STORAGE_KEY)).toBe("shadow");

      persistParserEngine("wasm");
      expect(localStorage.getItem(PARSER_ENGINE_STORAGE_KEY)).toBe("wasm");
    });

    it("updates store state and persists to storage via setParserEngine action", () => {
      const store = useLineageStore.getState();
      expect(store.parserEngine).toBeDefined();

      store.setParserEngine("shadow");
      expect(useLineageStore.getState().parserEngine).toBe("shadow");
      expect(localStorage.getItem(PARSER_ENGINE_STORAGE_KEY)).toBe("shadow");

      store.setParserEngine("wasm");
      expect(useLineageStore.getState().parserEngine).toBe("wasm");
      expect(localStorage.getItem(PARSER_ENGINE_STORAGE_KEY)).toBe("wasm");
    });
  });

  describe("compareLineageResults Differential Comparator", () => {
    it("returns zero discrepancies for identical graphs", () => {
      const mockResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            {
              id: "1",
              name: "orders",
              type: "TABLE" as const,
              columns: [
                { name: "id", sources: [] },
                { name: "amount", sources: [] },
              ],
            },
            { id: "2", name: "output", type: "FINAL_SELECT" as const, columns: [{ name: "id", sources: [] }] },
          ],
          edges: [{ id: "e1", source: "1", target: "2", type: "table" as const }],
        },
        errors: [],
      };

      const diffs = compareLineageResults(mockResult, mockResult, "wasm", "legacy");
      expect(diffs).toEqual([]);
    });

    it("detects expected differential advantage when shadow has syntax errors and primary succeeds", () => {
      const wasmResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [{ id: "1", name: "events", type: "TABLE" as const, columns: [] }],
          edges: [],
        },
        errors: [],
      };
      const legacyResult = {
        graph: null,
        errors: [{ line: 1, column: 10, message: 'Expected [ \\t\\n\\r] but "Q" found.' }],
      };

      const diffs = compareLineageResults(wasmResult, legacyResult, "wasm", "legacy");
      expect(diffs.length).toBeGreaterThanOrEqual(1);

      const syntaxDiff = diffs.find((d) => d.category === "syntax_error");
      expect(syntaxDiff).toBeDefined();
      expect(syntaxDiff?.level).toBe("info");
      expect(syntaxDiff?.summary).toContain("successfully parsed syntax where Shadow (legacy) failed");
    });

    it("detects warning when primary fails syntax and shadow succeeded", () => {
      const wasmResult = {
        graph: null,
        errors: [{ line: 1, column: 5, message: "Parser error" }],
      };
      const legacyResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [{ id: "1", name: "orders", type: "TABLE" as const, columns: [] }],
          edges: [],
        },
        errors: [],
      };

      const diffs = compareLineageResults(wasmResult, legacyResult, "wasm", "legacy");
      const syntaxDiff = diffs.find((d) => d.category === "syntax_error");
      expect(syntaxDiff).toBeDefined();
      expect(syntaxDiff?.level).toBe("warning");
      expect(syntaxDiff?.summary).toContain("Primary engine (wasm) reported syntax error(s)");
    });

    it("detects node topology differences (missing or extra nodes)", () => {
      const wasmResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            { id: "w1", name: "orders", type: "TABLE" as const, columns: [] },
            { id: "w2", name: "customers", type: "TABLE" as const, columns: [] },
          ],
          edges: [],
        },
        errors: [],
      };
      const legacyResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [{ id: "l1", name: "orders", type: "TABLE" as const, columns: [] }],
          edges: [],
        },
        errors: [],
      };

      const diffs = compareLineageResults(wasmResult, legacyResult, "wasm", "legacy");
      const topoDiff = diffs.find((d) => d.category === "node_topology");
      expect(topoDiff).toBeDefined();
      expect(topoDiff?.summary).toContain("Node topology difference");
      expect(topoDiff?.details?.extraInPrimary).toContain("customers");
    });

    it("detects edge connection differences between engines", () => {
      const wasmResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            { id: "1", name: "orders", type: "TABLE" as const, columns: [] },
            { id: "2", name: "summary", type: "CTE" as const, columns: [] },
          ],
          edges: [{ id: "we1", source: "1", target: "2", type: "table" as const }],
        },
        errors: [],
      };
      const legacyResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            { id: "1", name: "orders", type: "TABLE" as const, columns: [] },
            { id: "2", name: "summary", type: "CTE" as const, columns: [] },
          ],
          edges: [],
        },
        errors: [],
      };

      const diffs = compareLineageResults(wasmResult, legacyResult, "wasm", "legacy");
      const edgeDiff = diffs.find((d) => d.category === "edge_topology");
      expect(edgeDiff).toBeDefined();
      expect(edgeDiff?.details?.extraInPrimaryEdges).toContain("orders->summary");
    });

    it("detects column count variations on common entities", () => {
      const wasmResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            {
              id: "1",
              name: "orders",
              type: "TABLE" as const,
              columns: [
                { name: "id", sources: [] },
                { name: "amount", sources: [] },
                { name: "status", sources: [] },
              ],
            },
          ],
          edges: [],
        },
        errors: [],
      };
      const legacyResult = {
        graph: {
          generatedAt: new Date().toISOString(),
          nodes: [
            {
              id: "1",
              name: "orders",
              type: "TABLE" as const,
              columns: [{ name: "id", sources: [] }],
            },
          ],
          edges: [],
        },
        errors: [],
      };

      const diffs = compareLineageResults(wasmResult, legacyResult, "wasm", "legacy");
      const colDiff = diffs.find((d) => d.category === "column_mapping");
      expect(colDiff).toBeDefined();
      expect(colDiff?.details?.colDifferences).toEqual({
        orders: { primaryCount: 3, shadowCount: 1 },
      });
    });
  });

  describe("executeShadowParse Execution & Fault Tolerance", () => {
    it("runs both parsers concurrently and measures telemetry metrics", async () => {
      const sql = `
        SELECT o.order_id, c.customer_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
      `;

      const shadowResult: ShadowParseResult = await executeShadowParse(sql, "mssql", undefined, "wasm");

      expect(shadowResult.result).toBeDefined();
      expect(shadowResult.result.graph).not.toBeNull();
      expect(shadowResult.metrics.primaryEngine).toBe("wasm");
      expect(shadowResult.metrics.shadowEngine).toBe("legacy");
      expect(shadowResult.metrics.primaryMs).toBeGreaterThanOrEqual(0);
      expect(shadowResult.metrics.shadowMs).toBeGreaterThanOrEqual(0);
      expect(typeof shadowResult.metrics.discrepancyCount).toBe("number");
    });

    it("handles modern SQL syntax (e.g. QUALIFY) seamlessly in shadow mode", async () => {
      const sql = `
        SELECT 
          user_id, 
          event_time, 
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) as rn
        FROM analytics.events
        QUALIFY rn = 1
      `;

      const shadowResult = await executeShadowParse(sql, "generic", undefined, "wasm");

      // WASM should succeed and return clean lineage
      expect(shadowResult.result.errors).toEqual([]);
      expect(shadowResult.result.graph?.nodes.some((n) => n.name.toLowerCase().includes("events"))).toBe(true);

      // Shadow comparator should report the expected syntax advantage of WASM over legacy
      const advantage = shadowResult.discrepancies.find((d) => d.category === "syntax_error" && d.level === "info");
      expect(advantage).toBeDefined();
    });

    it("gracefully falls back to shadow engine if primary engine throws an unhandled exception", async () => {
      const sql = "SELECT * FROM test_table";

      const faultInjectingWasm = vi.fn().mockRejectedValue(new Error("Simulated WASM memory crash"));
      const workingLegacy = vi.fn().mockReturnValue({
        graph: {
          nodes: [{ id: "1", name: "test_table", type: "TABLE", columns: [] }],
          edges: [],
        },
        errors: [],
      });

      const shadowResult = await executeShadowParse(sql, "postgresql", undefined, "wasm", {
        wasmFn: faultInjectingWasm,
        legacyFn: workingLegacy,
      });

      // Primary crashed, but result was safely returned from shadow fallback!
      expect(shadowResult.result.graph).not.toBeNull();
      expect(shadowResult.result.graph?.nodes[0]?.name).toBe("test_table");

      // Discrepancy caught the runtime fault
      const fault = shadowResult.discrepancies.find((d) => d.category === "runtime_fault");
      expect(fault).toBeDefined();
      expect(fault?.level).toBe("error");
      expect(fault?.summary).toContain("Simulated WASM memory crash");
    });

    it("gracefully continues with primary result if shadow engine throws an unhandled exception", async () => {
      const sql = "SELECT * FROM test_table";

      const workingWasm = vi.fn().mockResolvedValue({
        graph: {
          nodes: [{ id: "w1", name: "test_table", type: "TABLE", columns: [] }],
          edges: [],
        },
        errors: [],
      });
      const faultInjectingLegacy = vi.fn().mockImplementation(() => {
        throw new Error("Simulated legacy parser crash");
      });

      const shadowResult = await executeShadowParse(sql, "postgresql", undefined, "wasm", {
        wasmFn: workingWasm,
        legacyFn: faultInjectingLegacy,
      });

      // Primary succeeded and returned
      expect(shadowResult.result.graph?.nodes[0]?.name).toBe("test_table");

      // Warning logged for shadow crash without disturbing primary
      const fault = shadowResult.discrepancies.find((d) => d.category === "runtime_fault");
      expect(fault).toBeDefined();
      expect(fault?.level).toBe("warning");
      expect(fault?.summary).toContain("Simulated legacy parser crash");
    });
  });
});
