import { type Remote, wrap } from "comlink";
import React, { useCallback, useEffect, useMemo } from "react";
import type { ParseLineageResult } from "../../lineage/parser/sqlLineageParser";
import { useLineageStore } from "../../stores/lineageStore";
import { useSdlStore } from "../../stores/sdlStore";
import type { SDLTable } from "../../types/sdl";
import type { LineageWorkerAPI } from "../../workers/lineage.worker";
import { ResizablePanel } from "../layout/ResizablePanel";
import { LineageCanvas } from "./LineageCanvas";
import { LineageInspector } from "./LineageInspector";
import { LineageSQLEditor } from "./LineageSQLEditor";
import styles from "./LineageTab.module.css";
import { LineageToolbar } from "./LineageToolbar";

export const LineageTab: React.FC = () => {
  const sql = useLineageStore((s) => s.sql);
  const dialect = useLineageStore((s) => s.dialect);
  const parserEngine = useLineageStore((s) => s.parserEngine);
  const setGraph = useLineageStore((s) => s.setGraph);
  const setParseErrors = useLineageStore((s) => s.setParseErrors);
  const setIsParsing = useLineageStore((s) => s.setIsParsing);

  const isSQLEditorOpen = useLineageStore((s) => s.isSQLEditorOpen);
  const isInspectorOpen = useLineageStore((s) => s.isInspectorOpen);

  const ast = useSdlStore((s) => s.ast);
  const erdTables = useMemo(() => {
    return (ast?.statements.filter((s) => s.type === "Table") as SDLTable[]) || [];
  }, [ast]);

  const workerRef = React.useRef<Worker | null>(null);
  const apiRef = React.useRef<Remote<LineageWorkerAPI> | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/lineage.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    apiRef.current = wrap<LineageWorkerAPI>(worker);
    return () => {
      worker.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!apiRef.current) return;

    setIsParsing(true);
    try {
      const options = {
        erdTables: erdTables.map((t) => ({
          id: t.name,
          name: t.name,
          columns: t.columns.map((c) => ({ name: c.name, type: c.dataType })),
        })),
      };

      let result: ParseLineageResult;

      if (parserEngine === "wasm") {
        try {
          result = await apiRef.current.parseSQLWasm(sql, dialect, options);
        } catch (wasmErr) {
          console.warn("[LineageTab] WASM engine failed, falling back to legacy:", wasmErr);
          result = await apiRef.current.parseSQL(sql, dialect, options);
        }
      } else if (parserEngine === "shadow") {
        const shadowResult = await apiRef.current.parseSQLShadow(sql, dialect, options, "wasm");
        result = shadowResult.result;
        if (shadowResult.discrepancies.length > 0) {
          console.groupCollapsed(
            `%c[ERD Forge Shadow Rollout] %c${shadowResult.discrepancies.length} Discrepancy(ies) Detected`,
            "color: #38bdf8; font-weight: bold;",
            "color: #f59e0b; font-weight: bold;",
          );
          console.table(
            shadowResult.discrepancies.map((d) => ({
              category: d.category,
              level: d.level,
              summary: d.summary,
            })),
          );
          console.debug("Full shadow discrepancies & metrics:", shadowResult);
          console.groupEnd();
        } else {
          console.debug("[ERD Forge Shadow Rollout] Parity verified. Metrics:", shadowResult.metrics);
        }
      } else {
        result = await apiRef.current.parseSQL(sql, dialect, options);
      }

      setGraph(result.graph);
      setParseErrors(result.errors);
    } catch (err: any) {
      console.error("Lineage parsing error:", err);
      setParseErrors([{ line: 1, column: 1, message: err?.message || "Lineage parsing error" }]);
    } finally {
      setIsParsing(false);
    }
  }, [sql, dialect, erdTables, parserEngine, setIsParsing, setGraph, setParseErrors]);

  // Initial lineage analysis on mount or when parserEngine changes
  const isMountedRef = React.useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      if (parserEngine !== "legacy" || !useLineageStore.getState().graph) {
        handleAnalyze();
      }
      return;
    }
    handleAnalyze();
  }, [parserEngine, handleAnalyze]);

  return (
    <div className={styles.lineageContainer}>
      <LineageToolbar onAnalyze={handleAnalyze} />

      <div className={styles.workspace}>
        {/* Left: Collapsible & Resizable Query List & Editor */}
        {isSQLEditorOpen && (
          <ResizablePanel position="left" defaultWidth={380} minWidth={280} maxWidth={700}>
            <LineageSQLEditor onAnalyze={handleAnalyze} />
          </ResizablePanel>
        )}

        {/* Center: React Flow Interactive Lineage Canvas */}
        <div className={styles.canvasContainer}>
          <LineageCanvas onAnalyze={handleAnalyze} />
        </div>

        {/* Right: Collapsible & Resizable Lineage Inspector */}
        {isInspectorOpen && (
          <ResizablePanel position="right" defaultWidth={320} minWidth={240} maxWidth={500}>
            <LineageInspector />
          </ResizablePanel>
        )}
      </div>
    </div>
  );
};
