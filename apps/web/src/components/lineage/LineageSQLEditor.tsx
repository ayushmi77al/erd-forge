import React, { useRef, useEffect, useCallback, useState } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { 
  EditorView, 
  lineNumbers, 
  highlightActiveLineGutter, 
  highlightSpecialChars, 
  drawSelection, 
  dropCursor, 
  rectangularSelection, 
  crosshairCursor, 
  highlightActiveLine, 
  keymap 
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { AlertCircle, Copy, Check, CornerDownRight, Code2, ChevronDown, Sparkles, Database } from 'lucide-react';
import { useLineageStore, SQLDialect } from '../../stores/lineageStore';
import { SAMPLE_QUERIES } from '../../lineage/constants/sampleQueries';
import styles from './LineageSQLEditor.module.css';

const DIALECT_OPTIONS: { value: SQLDialect; label: string }[] = [
  { value: 'mssql', label: 'SQL Server' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'databricks', label: 'Databricks' },
];

interface LineageSQLEditorProps {
  onAnalyze?: () => void;
}

export const LineageSQLEditor: React.FC<LineageSQLEditorProps> = ({ onAnalyze }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdate = useRef(false);

  const sql = useLineageStore((s) => s.sql);
  const setSQL = useLineageStore((s) => s.setSQL);
  const dialect = useLineageStore((s) => s.dialect);
  const setDialect = useLineageStore((s) => s.setDialect);
  const parseErrors = useLineageStore((s) => s.parseErrors);
  const activeSampleId = useLineageStore((s) => s.activeSampleId);
  const loadSampleQuery = useLineageStore((s) => s.loadSampleQuery);

  const [copied, setCopied] = useState(false);
  const [isDialectOpen, setIsDialectOpen] = useState(false);
  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  const dialectRef = useRef<HTMLDivElement>(null);
  const samplesRef = useRef<HTMLDivElement>(null);

  const primaryError = parseErrors[0] || null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialectRef.current && !dialectRef.current.contains(event.target as Node)) {
        setIsDialectOpen(false);
      }
      if (samplesRef.current && !samplesRef.current.contains(event.target as Node)) {
        setIsSamplesOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDialectOpen(false);
        setIsSamplesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectDialect = (d: SQLDialect) => {
    setDialect(d);
    setIsDialectOpen(false);
  };

  const handleSelectSample = (sampleId: string) => {
    const found = SAMPLE_QUERIES.find((sq) => sq.id === sampleId);
    if (found) {
      loadSampleQuery(found.id);
      setSQL(found.sql);
      setDialect(found.dialect);
    }
    setIsSamplesOpen(false);
  };

  const onAnalyzeRef = useRef(onAnalyze);
  useEffect(() => {
    onAnalyzeRef.current = onAnalyze;
  }, [onAnalyze]);

  // Initialize CodeMirror 6
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: sql,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (onAnalyzeRef.current) {
                onAnalyzeRef.current();
                return true;
              }
              return false;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            setSQL(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: 'transparent',
            color: 'var(--color-text-primary)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          },
          '.cm-content': {
            padding: '8px 0',
            caretColor: 'var(--color-brand-400)',
          },
          '.cm-cursor, &.cm-focused .cm-cursor': {
            borderLeftColor: 'var(--color-brand-400)',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            border: 'none',
            borderRight: '1px solid var(--color-border-subtle)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--color-surface-overlay)',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgba(99, 102, 241, 0.35) !important',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(99, 102, 241, 0.25) !important',
          },
          '::selection, .cm-content ::selection': {
            backgroundColor: 'rgba(99, 102, 241, 0.35) !important',
            color: '#ffffff !important',
          },
        }, { dark: true }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes (e.g., loading samples or saved queries) into editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === sql) return;

    isExternalUpdate.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: sql,
        },
        annotations: [Transaction.addToHistory.of(false)],
      });
    } finally {
      isExternalUpdate.current = false;
    }
  }, [sql]);

  // Jump to error line if clicked
  const handleJumpToError = useCallback(() => {
    const view = viewRef.current;
    if (!view || !primaryError) return;

    const lineNum = Math.min(Math.max(1, primaryError.line || 1), view.state.doc.lines);
    const lineObj = view.state.doc.line(lineNum);
    const col = Math.max(1, primaryError.column || 1);
    const pos = Math.min(lineObj.from + col - 1, lineObj.to);

    view.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    view.focus();
  }, [primaryError]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Code2 size={15} style={{ color: 'var(--color-brand-400)' }} />
          <span>SQL Query Editor</span>
          
          {/* Dialect Custom Dropdown */}
          <div className={styles.dropdownContainer} ref={dialectRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${isDialectOpen ? styles.open : ''}`}
              onClick={() => {
                setIsDialectOpen(!isDialectOpen);
                setIsSamplesOpen(false);
              }}
              title="Select SQL Dialect"
              aria-haspopup="listbox"
              aria-expanded={isDialectOpen}
            >
              <Database size={12} style={{ color: 'var(--color-brand-400)' }} />
              <span className={styles.dropdownTriggerText}>
                {DIALECT_OPTIONS.find((d) => d.value === dialect)?.label || dialect}
              </span>
              <ChevronDown size={12} className={styles.dropdownTriggerIcon} />
            </button>

            {isDialectOpen && (
              <div className={styles.dropdownMenu} role="listbox">
                {DIALECT_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="option"
                    aria-selected={dialect === item.value}
                    className={`${styles.dropdownItem} ${dialect === item.value ? styles.active : ''}`}
                    onClick={() => handleSelectDialect(item.value)}
                  >
                    <span>{item.label}</span>
                    {dialect === item.value && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Sample Queries Custom Dropdown */}
          <div className={styles.dropdownContainer} ref={samplesRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${isSamplesOpen ? styles.open : ''}`}
              onClick={() => {
                setIsSamplesOpen(!isSamplesOpen);
                setIsDialectOpen(false);
              }}
              title="Load Predefined Sample Query"
              aria-haspopup="listbox"
              aria-expanded={isSamplesOpen}
            >
              <Sparkles size={12} style={{ color: 'var(--color-brand-400)' }} />
              <span className={styles.dropdownTriggerText}>
                {SAMPLE_QUERIES.find((sq) => sq.id === activeSampleId)?.title || 'Samples...'}
              </span>
              <ChevronDown size={12} className={styles.dropdownTriggerIcon} />
            </button>

            {isSamplesOpen && (
              <div className={`${styles.dropdownMenu} ${styles.samplesMenu}`} role="listbox">
                {SAMPLE_QUERIES.map((sq) => (
                  <button
                    key={sq.id}
                    type="button"
                    role="option"
                    aria-selected={activeSampleId === sq.id}
                    className={`${styles.dropdownItem} ${activeSampleId === sq.id ? styles.active : ''}`}
                    onClick={() => handleSelectSample(sq.id)}
                  >
                    <span className={styles.sampleItemTitle}>{sq.title}</span>
                    {activeSampleId === sq.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            className={styles.headerBtn} 
            onClick={handleCopy} 
            title="Copy SQL to Clipboard"
            type="button"
          >
            {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {primaryError && (
        <div
          className={styles.errorBanner}
          onClick={handleJumpToError}
          title="Click to jump to syntax error line"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleJumpToError();
            }
          }}
        >
          <div className={styles.errorBadge}>
            <AlertCircle size={13} />
            <span>Line {primaryError.line || 1}</span>
          </div>
          <span className={styles.errorMessage}>{primaryError.message}</span>
          <span className={styles.jumpHint}>
            <CornerDownRight size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
            Jump
          </span>
        </div>
      )}

      <div className={styles.editorWrapper} ref={editorRef} />
    </div>
  );
};
