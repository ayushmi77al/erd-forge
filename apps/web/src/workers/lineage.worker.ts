import { type DialectInput, init as initWasmParser, parse as parseWasmSQL } from "@guanmingchiu/sqlparser-ts";
import { expose } from "comlink";
import { executeShadowParse, type ShadowParseResult } from "../lineage/parser/ShadowRolloutComparator";
import { type ParseLineageOptions, type ParseLineageResult, parseSQLLineage } from "../lineage/parser/sqlLineageParser";
import { parseSQLLineageWasm } from "../lineage/parser/WasmLineageBuilder";
import type { SQLDialect } from "../stores/lineageStore";

let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasmParser();
  }
  return wasmInitPromise;
}

const api = {
  async initWasm(): Promise<boolean> {
    await ensureWasmInitialized();
    return true;
  },

  async parseWasmSpike(sql: string, dialect: DialectInput = "generic"): Promise<any> {
    await ensureWasmInitialized();
    return parseWasmSQL(sql, dialect);
  },

  parseSQL(sql: string, dialect: SQLDialect, options?: ParseLineageOptions): ParseLineageResult {
    return parseSQLLineage(sql, dialect, options);
  },

  async parseSQLWasm(sql: string, dialect: SQLDialect, options?: ParseLineageOptions): Promise<ParseLineageResult> {
    return parseSQLLineageWasm(sql, dialect, options);
  },

  async parseSQLShadow(
    sql: string,
    dialect: SQLDialect,
    options?: ParseLineageOptions,
    primaryEngine: "wasm" | "legacy" = "wasm",
  ): Promise<ShadowParseResult> {
    return executeShadowParse(sql, dialect, options, primaryEngine);
  },
};

export type LineageWorkerAPI = typeof api;

expose(api);
