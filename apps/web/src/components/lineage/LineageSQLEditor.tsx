import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { AlertCircle, Check, ChevronDown, Code2, Copy, CornerDownRight, Database, Sparkles } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_QUERIES } from "../../lineage/constants/sampleQueries";
import { type SQLDialect, useLineageStore } from "../../stores/lineageStore";
import { resolveTheme, useUIStore } from "../../stores/uiStore";
import { createEditorTheme } from "../editor/editorTheme";
import styles from "./LineageSQLEditor.module.css";

const DIALECT_OPTIONS: { value: SQLDialect; label: string }[] = [
  { value: "mssql", label: "SQL Server" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "oracle", label: "Oracle" },
  { value: "bigquery", label: "BigQuery" },
  { value: "redshift", label: "Redshift" },
  { value: "snowflake", label: "Snowflake" },
  { value: "databricks", label: "Databricks" },
];

interface LineageSQLEditorProps {
  onAnalyze?: () => void;
}

export const LineageSQLEditor: React.FC<LineageSQLEditorProps> = ({ onAnalyze }) => {
  const theme = useUIStore((s) => s.theme);
  const isDark = resolveTheme(theme) === "dark";

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef<Compartment | null>(null);
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
      if (event.key === "Escape") {
        setIsDialectOpen(false);
        setIsSamplesOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
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

  const initialSqlRef = useRef(sql);
  const initialDarkRef = useRef(isDark);
  const setSqlRef = useRef(setSQL);
  useEffect(() => {
    setSqlRef.current = setSQL;
  }, [setSQL]);

  // Initialize CodeMirror 6
  useEffect(() => {
    if (!editorRef.current) return;

    const themeCompartment = new Compartment();
    themeCompartmentRef.current = themeCompartment;

    const state = EditorState.create({
      doc: initialSqlRef.current,
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
            key: "Mod-Enter",
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
            setSqlRef.current(update.state.doc.toString());
          }
        }),
        themeCompartment.of(
          createEditorTheme({
            dark: initialDarkRef.current,
            fontSize: "0.85rem",
            fontFamily: "var(--font-mono)",
            contentPadding: "8px 0",
          }),
        ),
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
      themeCompartmentRef.current = null;
    };
  }, []);

  // Reconfigure CodeMirror theme when dark/light theme changes
  useEffect(() => {
    const view = viewRef.current;
    const compartment = themeCompartmentRef.current;
    if (!view || !compartment) return;

    view.dispatch({
      effects: compartment.reconfigure(
        createEditorTheme({
          dark: isDark,
          fontSize: "0.85rem",
          fontFamily: "var(--font-mono)",
          contentPadding: "8px 0",
        }),
      ),
    });
  }, [isDark]);

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
          <Code2 size={15} className={styles.brandIcon} aria-hidden="true" />
          <span>SQL Query Editor</span>

          {/* Dialect Custom Dropdown */}
          <div className={styles.dropdownContainer} ref={dialectRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${isDialectOpen ? styles.open : ""}`}
              onClick={() => {
                setIsDialectOpen(!isDialectOpen);
                setIsSamplesOpen(false);
              }}
              title="Select SQL Dialect"
              aria-label="Select SQL dialect"
              aria-haspopup="listbox"
              aria-expanded={isDialectOpen}
            >
              <Database size={12} className={styles.brandIcon} aria-hidden="true" />
              <span className={styles.dropdownTriggerText}>
                {DIALECT_OPTIONS.find((d) => d.value === dialect)?.label || dialect}
              </span>
              <ChevronDown size={12} className={styles.dropdownTriggerIcon} aria-hidden="true" />
            </button>

            {isDialectOpen && (
              <div className={styles.dropdownMenu} role="listbox" aria-label="SQL dialects">
                {DIALECT_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="option"
                    aria-selected={dialect === item.value}
                    className={`${styles.dropdownItem} ${dialect === item.value ? styles.active : ""}`}
                    onClick={() => handleSelectDialect(item.value)}
                  >
                    <span>{item.label}</span>
                    {dialect === item.value && <Check size={12} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sample Queries Custom Dropdown */}
          <div className={styles.dropdownContainer} ref={samplesRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${isSamplesOpen ? styles.open : ""}`}
              onClick={() => {
                setIsSamplesOpen(!isSamplesOpen);
                setIsDialectOpen(false);
              }}
              title="Load Predefined Sample Query"
              aria-label="Load sample SQL query"
              aria-haspopup="listbox"
              aria-expanded={isSamplesOpen}
            >
              <Sparkles size={12} className={styles.brandIcon} aria-hidden="true" />
              <span className={styles.dropdownTriggerText}>
                {SAMPLE_QUERIES.find((sq) => sq.id === activeSampleId)?.title || "Samples..."}
              </span>
              <ChevronDown size={12} className={styles.dropdownTriggerIcon} aria-hidden="true" />
            </button>

            {isSamplesOpen && (
              <div
                className={`${styles.dropdownMenu} ${styles.samplesMenu}`}
                role="listbox"
                aria-label="Sample SQL queries"
              >
                {SAMPLE_QUERIES.map((sq) => (
                  <button
                    key={sq.id}
                    type="button"
                    role="option"
                    aria-selected={activeSampleId === sq.id}
                    className={`${styles.dropdownItem} ${activeSampleId === sq.id ? styles.active : ""}`}
                    onClick={() => handleSelectSample(sq.id)}
                  >
                    <span className={styles.sampleItemTitle}>{sq.title}</span>
                    {activeSampleId === sq.id && <Check size={12} aria-hidden="true" />}
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
            aria-label={copied ? "Copied to clipboard" : "Copy SQL to clipboard"}
          >
            {copied ? (
              <Check size={12} className={styles.successIcon} aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
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
          aria-label={`Jump to SQL error on line ${primaryError.line || 1}: ${primaryError.message}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleJumpToError();
            }
          }}
        >
          <div className={styles.errorBadge}>
            <AlertCircle size={13} aria-hidden="true" />
            <span>Line {primaryError.line || 1}</span>
          </div>
          <span className={styles.errorMessage}>{primaryError.message}</span>
          <span className={styles.jumpHint}>
            <CornerDownRight size={11} className={styles.jumpIcon} aria-hidden="true" />
            Jump
          </span>
        </div>
      )}

      <div className={styles.editorWrapper} ref={editorRef} />
    </div>
  );
};
