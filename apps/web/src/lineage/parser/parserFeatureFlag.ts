import type { ParserEngine } from "./ShadowRolloutComparator";

export const PARSER_ENGINE_STORAGE_KEY = "erd-forge-parser-engine";

/**
 * Resolves the initial parser engine preference in order:
 * 1. URL Query parameter (`?parserEngine=` or `?lineageParser=`)
 * 2. Stored user preference in localStorage
 * 3. Default: "wasm"
 */
export function getInitialParserEngine(): ParserEngine {
  if (typeof window !== "undefined") {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryParam = searchParams.get("parserEngine") || searchParams.get("lineageParser");
      if (queryParam === "legacy" || queryParam === "wasm" || queryParam === "shadow") {
        return queryParam;
      }

      const stored = localStorage.getItem(PARSER_ENGINE_STORAGE_KEY);
      if (stored === "legacy" || stored === "wasm" || stored === "shadow") {
        return stored;
      }
    } catch {
      // Ignore security errors or SSR contexts
    }
  }

  return "wasm";
}

/**
 * Persists the parser engine preference to localStorage if available.
 */
export function persistParserEngine(engine: ParserEngine): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PARSER_ENGINE_STORAGE_KEY, engine);
    } catch {
      // Ignore quota/security errors
    }
  }
}
