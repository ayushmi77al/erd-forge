import type { LineageGraph } from "../models/LineageGraph";
import type { ParseError, ParserEngine, SQLDialect } from "../types";
import { type ParseLineageOptions, type ParseLineageResult, parseSQLLineage } from "./sqlLineageParser";
import { parseSQLLineageWasm } from "./WasmLineageBuilder";

export type { ParserEngine };

export type DiscrepancyCategory =
  | "syntax_error"
  | "node_topology"
  | "edge_topology"
  | "column_mapping"
  | "runtime_fault";

export type DiscrepancyLevel = "info" | "warning" | "error";

export interface ParserDiscrepancy {
  category: DiscrepancyCategory;
  level: DiscrepancyLevel;
  summary: string;
  details?: Record<string, unknown>;
}

export interface ShadowParseMetrics {
  primaryEngine: "wasm" | "legacy";
  primaryMs: number;
  shadowEngine: "wasm" | "legacy";
  shadowMs: number;
  discrepancyCount: number;
}

export interface ShadowParseResult {
  result: ParseLineageResult;
  discrepancies: ParserDiscrepancy[];
  metrics: ShadowParseMetrics;
}

/**
 * Compares two ParseLineageResult objects and identifies structural differences.
 */
export function compareLineageResults(
  primaryResult: ParseLineageResult,
  shadowResult: ParseLineageResult,
  primaryName: "wasm" | "legacy" = "wasm",
  shadowName: "wasm" | "legacy" = "legacy",
): ParserDiscrepancy[] {
  const discrepancies: ParserDiscrepancy[] = [];

  const primaryHasErrors = primaryResult.errors.length > 0;
  const shadowHasErrors = shadowResult.errors.length > 0;

  // 1. Error discrepancy detection
  if (primaryHasErrors && !shadowHasErrors) {
    discrepancies.push({
      category: "syntax_error",
      level: "warning",
      summary: `Primary engine (${primaryName}) reported syntax error(s) while Shadow (${shadowName}) parsed cleanly.`,
      details: {
        primaryErrors: primaryResult.errors,
      },
    });
  } else if (!primaryHasErrors && shadowHasErrors) {
    discrepancies.push({
      category: "syntax_error",
      level: "info",
      summary: `Primary engine (${primaryName}) successfully parsed syntax where Shadow (${shadowName}) failed (expected differential advantage).`,
      details: {
        shadowErrors: shadowResult.errors,
      },
    });
  } else if (primaryHasErrors && shadowHasErrors) {
    if (primaryResult.errors.length !== shadowResult.errors.length) {
      discrepancies.push({
        category: "syntax_error",
        level: "info",
        summary: `Both engines reported syntax errors with differing error counts: ${primaryName} (${primaryResult.errors.length}) vs ${shadowName} (${shadowResult.errors.length}).`,
        details: {
          primaryErrors: primaryResult.errors,
          shadowErrors: shadowResult.errors,
        },
      });
    }
  }

  // 2. Graph topology comparison
  const g1 = primaryResult.graph;
  const g2 = shadowResult.graph;

  if (!g1 && g2) {
    discrepancies.push({
      category: "node_topology",
      level: "error",
      summary: `Primary engine (${primaryName}) produced no graph, whereas Shadow (${shadowName}) produced a graph with ${g2.nodes.length} nodes.`,
    });
    return discrepancies;
  }

  if (g1 && !g2) {
    discrepancies.push({
      category: "node_topology",
      level: "info",
      summary: `Primary engine (${primaryName}) produced a graph with ${g1.nodes.length} nodes, whereas Shadow (${shadowName}) produced no graph.`,
    });
    return discrepancies;
  }

  if (!g1 && !g2) {
    return discrepancies;
  }

  // Both graphs exist: compare nodes
  const nodes1Map = new Map(g1!.nodes.map((n) => [n.name.toLowerCase().trim(), n]));
  const nodes2Map = new Map(g2!.nodes.map((n) => [n.name.toLowerCase().trim(), n]));

  const missingInPrimary = [...nodes2Map.keys()].filter((name) => !nodes1Map.has(name));
  const extraInPrimary = [...nodes1Map.keys()].filter((name) => !nodes2Map.has(name));

  if (g1!.nodes.length !== g2!.nodes.length || missingInPrimary.length > 0 || extraInPrimary.length > 0) {
    discrepancies.push({
      category: "node_topology",
      level: missingInPrimary.length > 0 ? "warning" : "info",
      summary: `Node topology difference: ${primaryName} (${g1!.nodes.length} nodes) vs ${shadowName} (${g2!.nodes.length} nodes).`,
      details: {
        missingInPrimary,
        extraInPrimary,
      },
    });
  }

  // 3. Compare edges
  const getNodeName = (graph: LineageGraph, id: string): string => {
    const node = graph.nodes.find((n) => n.id === id);
    return node ? node.name.toLowerCase().trim() : id.toLowerCase();
  };

  const getEdgeSignature = (graph: LineageGraph, edge: (typeof graph.edges)[0]): string => {
    const src = getNodeName(graph, edge.source);
    const tgt = getNodeName(graph, edge.target);
    return `${src}->${tgt}`;
  };

  const edges1Set = new Set(g1!.edges.map((e) => getEdgeSignature(g1!, e)));
  const edges2Set = new Set(g2!.edges.map((e) => getEdgeSignature(g2!, e)));

  const missingInPrimaryEdges = [...edges2Set].filter((sig) => !edges1Set.has(sig));
  const extraInPrimaryEdges = [...edges1Set].filter((sig) => !edges2Set.has(sig));

  if (g1!.edges.length !== g2!.edges.length || missingInPrimaryEdges.length > 0 || extraInPrimaryEdges.length > 0) {
    discrepancies.push({
      category: "edge_topology",
      level: missingInPrimaryEdges.length > 0 ? "warning" : "info",
      summary: `Edge topology difference: ${primaryName} (${g1!.edges.length} edges) vs ${shadowName} (${g2!.edges.length} edges).`,
      details: {
        missingInPrimaryEdges,
        extraInPrimaryEdges,
      },
    });
  }

  // 4. Compare columns for common nodes
  const colDifferences: Record<string, { primaryCount: number; shadowCount: number }> = {};
  for (const [name, node1] of nodes1Map) {
    const node2 = nodes2Map.get(name);
    if (node2 && (node1.columns?.length || 0) !== (node2.columns?.length || 0)) {
      colDifferences[name] = {
        primaryCount: node1.columns?.length || 0,
        shadowCount: node2.columns?.length || 0,
      };
    }
  }

  if (Object.keys(colDifferences).length > 0) {
    discrepancies.push({
      category: "column_mapping",
      level: "info",
      summary: `Column count differences detected in ${Object.keys(colDifferences).length} common table/CTE node(s).`,
      details: { colDifferences },
    });
  }

  return discrepancies;
}

export interface ShadowParseOptions {
  wasmFn?: (sql: string, dialect: SQLDialect, options?: ParseLineageOptions) => Promise<ParseLineageResult>;
  legacyFn?: (sql: string, dialect: SQLDialect, options?: ParseLineageOptions) => ParseLineageResult;
}

/**
 * Executes both primary and shadow engines concurrently, compares results,
 * provides fault-tolerant fallback if primary crashes, and returns telemetry.
 */
export async function executeShadowParse(
  sql: string,
  dialect: SQLDialect,
  options?: ParseLineageOptions,
  primaryEngine: "wasm" | "legacy" = "wasm",
  customFns?: ShadowParseOptions,
): Promise<ShadowParseResult> {
  const shadowEngine: "wasm" | "legacy" = primaryEngine === "wasm" ? "legacy" : "wasm";

  const getNow = (): number => {
    return typeof globalThis !== "undefined" && (globalThis as any).performance?.now
      ? (globalThis as any).performance.now()
      : Date.now();
  };

  const runWasm = async (): Promise<{ result: ParseLineageResult; durationMs: number }> => {
    const start = getNow();
    const fn = customFns?.wasmFn || parseSQLLineageWasm;
    const res = await fn(sql, dialect, options);
    const end = getNow();
    return { result: res, durationMs: end - start };
  };

  const runLegacy = async (): Promise<{ result: ParseLineageResult; durationMs: number }> => {
    const start = getNow();
    const fn = customFns?.legacyFn || parseSQLLineage;
    const res = fn(sql, dialect, options);
    const end = getNow();
    return { result: res, durationMs: end - start };
  };

  const wasmPromise = runWasm();
  const legacyPromise = runLegacy();

  const [wasmSettled, legacySettled] = await Promise.allSettled([wasmPromise, legacyPromise]);

  const primarySettled = primaryEngine === "wasm" ? wasmSettled : legacySettled;
  const shadowSettled = shadowEngine === "wasm" ? wasmSettled : legacySettled;

  const discrepancies: ParserDiscrepancy[] = [];
  let finalResult: ParseLineageResult;
  let primaryMs = 0;
  let shadowMs = 0;

  // Evaluate primary engine
  if (primarySettled.status === "fulfilled") {
    finalResult = primarySettled.value.result;
    primaryMs = primarySettled.value.durationMs;
  } else {
    // Primary crashed!
    const err = primarySettled.reason;
    discrepancies.push({
      category: "runtime_fault",
      level: "error",
      summary: `Primary engine (${primaryEngine}) encountered an uncaught runtime fault: ${err instanceof Error ? err.message : String(err)}`,
      details: { error: String(err) },
    });

    // Attempt fallback to shadow
    if (shadowSettled.status === "fulfilled") {
      finalResult = shadowSettled.value.result;
    } else {
      finalResult = {
        graph: null,
        errors: [{ line: 1, column: 1, message: `All parser engines failed: ${String(err)}` }],
      };
    }
  }

  // Evaluate shadow engine
  if (shadowSettled.status === "fulfilled") {
    shadowMs = shadowSettled.value.durationMs;
    // If primary was also fulfilled, perform differential comparison
    if (primarySettled.status === "fulfilled") {
      const diffs = compareLineageResults(
        primarySettled.value.result,
        shadowSettled.value.result,
        primaryEngine,
        shadowEngine,
      );
      discrepancies.push(...diffs);
    }
  } else {
    const err = shadowSettled.reason;
    discrepancies.push({
      category: "runtime_fault",
      level: "warning",
      summary: `Shadow engine (${shadowEngine}) encountered an uncaught runtime fault: ${err instanceof Error ? err.message : String(err)}`,
      details: { error: String(err) },
    });
  }

  return {
    result: finalResult,
    discrepancies,
    metrics: {
      primaryEngine,
      primaryMs: Math.round(primaryMs * 100) / 100,
      shadowEngine,
      shadowMs: Math.round(shadowMs * 100) / 100,
      discrepancyCount: discrepancies.length,
    },
  };
}
