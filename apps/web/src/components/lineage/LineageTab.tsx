import React, { useEffect, useCallback, useMemo } from 'react';
import { LineageToolbar } from './LineageToolbar';
import { LineageSQLEditor } from './LineageSQLEditor';
import { LineageCanvas } from './LineageCanvas';
import { LineageInspector } from './LineageInspector';
import { ResizablePanel } from '../layout/ResizablePanel';
import { useLineageStore } from '../../stores/lineageStore';
import { useSdlStore } from '../../stores/sdlStore';
import { SDLTable } from '../../types/sdl';
import { wrap, Remote } from 'comlink';
import type { LineageWorkerAPI } from '../../workers/lineage.worker';
import styles from './LineageTab.module.css';

export const LineageTab: React.FC = () => {
  const sql = useLineageStore((s) => s.sql);
  const dialect = useLineageStore((s) => s.dialect);
  const graph = useLineageStore((s) => s.graph);
  const setGraph = useLineageStore((s) => s.setGraph);
  const setParseErrors = useLineageStore((s) => s.setParseErrors);
  const setIsParsing = useLineageStore((s) => s.setIsParsing);

  const isSQLEditorOpen = useLineageStore((s) => s.isSQLEditorOpen);
  const isInspectorOpen = useLineageStore((s) => s.isInspectorOpen);

  const ast = useSdlStore((s) => s.ast);
  const erdTables = useMemo(() => {
    return (ast?.statements.filter((s) => s.type === 'Table') as SDLTable[]) || [];
  }, [ast]);

  const workerRef = React.useRef<Worker | null>(null);
  const apiRef = React.useRef<Remote<LineageWorkerAPI> | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/lineage.worker.ts', import.meta.url), { type: 'module' });
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

      const result = await apiRef.current.parseSQL(sql, dialect, options);
      setGraph(result.graph);
      setParseErrors(result.errors);
    } catch (err: any) {
      console.error('Lineage parsing error:', err);
      setParseErrors([{ line: 1, column: 1, message: err?.message || 'Lineage parsing error' }]);
    } finally {
      setIsParsing(false);
    }
  }, [sql, dialect, erdTables, setIsParsing, setGraph, setParseErrors]);

  // Initial lineage analysis on mount if no graph exists
  useEffect(() => {
    if (!graph && sql) {
      handleAnalyze();
    }
  }, [graph, sql, handleAnalyze]);

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

