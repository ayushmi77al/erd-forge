import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
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
import { AlertCircle, CheckCircle2, CornerDownRight } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useSdlStore } from "../../stores/sdlStore";
import { resolveTheme, useUIStore } from "../../stores/uiStore";
import { createEditorTheme } from "./editorTheme";
import styles from "./SDLEditor.module.css";
import { sdlAutocomplete } from "./sdl-language/autocomplete";
import { sdlLinter } from "./sdl-language/linter";

interface SDLEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const SDLEditor: React.FC<SDLEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const isExternalUpdate = useRef(false);

  const errors = useSdlStore((s) => s.errors);
  const primaryError = errors[0] ?? null;
  const theme = useUIStore((s) => s.theme);
  const isDark = resolveTheme(theme) === "dark";
  const initialDarkRef = useRef(isDark);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;
    const themeCompartment = themeCompartmentRef.current;

    const state = EditorState.create({
      doc: initialValueRef.current,
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
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        sdlAutocomplete(),
        sdlLinter(),
        lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        themeCompartment.of(createEditorTheme({ dark: initialDarkRef.current })),
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
  }, []);

  // Reconfigure CodeMirror base theme when dark/light mode changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(createEditorTheme({ dark: isDark })),
    });
  }, [isDark]);

  // Sync external value changes into CodeMirror
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === value) return;

    isExternalUpdate.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
        annotations: [Transaction.addToHistory.of(false)],
      });
    } finally {
      isExternalUpdate.current = false;
    }
  }, [value]);

  const handleJumpToError = useCallback(() => {
    const view = viewRef.current;
    if (!view || !primaryError) return;

    const lineNum = Math.min(Math.max(1, primaryError.line), view.state.doc.lines);
    const lineObj = view.state.doc.line(lineNum);
    const col = Math.max(1, primaryError.column || 1);
    const pos = Math.min(lineObj.from + col - 1, lineObj.to);

    view.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    view.focus();
  }, [primaryError]);

  return (
    <div className={styles.editorContainer}>
      <div className={styles.header}>
        <span>SDL Editor</span>
        <div className={styles.headerRight}>
          {primaryError ? (
            <span className={styles.errorBadgeHeader} title={primaryError.message}>
              <AlertCircle size={12} aria-hidden="true" />
              Line {primaryError.line} Error
            </span>
          ) : (
            <span className={styles.validBadge}>
              <CheckCircle2 size={12} aria-hidden="true" />
              Valid
            </span>
          )}
        </div>
      </div>

      {primaryError && (
        <div
          className={styles.errorBanner}
          onClick={handleJumpToError}
          title="Click to jump to error line in editor"
          role="button"
          tabIndex={0}
          aria-label={`Jump to SDL error on line ${primaryError.line}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleJumpToError();
            }
          }}
        >
          <div className={styles.errorBadge}>
            <AlertCircle size={12} aria-hidden="true" />
            <span>Line {primaryError.line}</span>
          </div>
          <span className={styles.errorMessage}>{primaryError.message}</span>
          <span className={styles.jumpHint}>
            <CornerDownRight size={11} className={styles.jumpIcon} aria-hidden="true" />
            Jump
          </span>
        </div>
      )}

      <div className={styles.editorWrapper} ref={editorRef} aria-label="SDL schema source editor" />
    </div>
  );
};
