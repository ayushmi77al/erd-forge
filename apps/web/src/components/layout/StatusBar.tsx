import React from 'react';
import { useSdlStore } from '../../stores/sdlStore';
import { useUIStore } from '../../stores/uiStore';
import { useLineageStore } from '../../stores/lineageStore';
import { SDLTable } from '../../types/sdl';
import styles from './StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const appMode = useUIStore((s) => s.appMode);

  // ERD Mode state
  const ast = useSdlStore((s) => s.ast);
  const error = useSdlStore((s) => s.error);
  const errors = useSdlStore((s) => s.errors);
  const isStale = useSdlStore((s) => s.isStale);
  const primaryError = errors[0] ?? null;

  // Lineage Mode state
  const graph = useLineageStore((s) => s.graph);
  const dialect = useLineageStore((s) => s.dialect);
  const parseErrors = useLineageStore((s) => s.parseErrors);
  const isParsing = useLineageStore((s) => s.isParsing);

  const tables = (ast?.statements.filter((s) => s.type === 'Table') as SDLTable[]) || [];
  const totalCols = tables.reduce((sum, t) => sum + t.columns.length, 0);

  if (appMode === 'lineage') {
    const lineageError = parseErrors[0] ?? null;
    return (
      <div className={styles.statusBar}>
        <div className={styles.left}>
          {lineageError ? (
            <span style={{ color: 'var(--color-error)' }}>
              ❌ Line {lineageError.line || 1}: {lineageError.message}
            </span>
          ) : isParsing ? (
            <span style={{ color: 'var(--color-brand-400)' }}>
              🔄 Analyzing SQL pipeline...
            </span>
          ) : (
            <span style={{ color: 'var(--color-success)' }}>
              ✅ SQL Lineage ready
            </span>
          )}
        </div>
        <div className={styles.right}>
          <span className={styles.item}>Dialect: {dialect.toUpperCase()}</span>
          <span className={styles.item}>{graph?.nodes.length || 0} entities</span>
          <span className={styles.item}>{graph?.edges.length || 0} flow edges</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        {error ? (
          <span style={{ color: 'var(--color-error)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>❌ Line {primaryError?.line || '?'}: {primaryError?.message || error}</span>
            {isStale && (
              <span className={styles.preservedPill} title="Previous valid diagram is kept active on canvas">
                Diagram preserved
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--color-success)' }}>✅ SDL valid</span>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.item}>{tables.length} tables</span>
        <span className={styles.item}>{totalCols} columns</span>
        <span className={styles.item}>{isStale ? 'Preserving diagram' : 'Saved'}</span>
      </div>
    </div>
  );
};
