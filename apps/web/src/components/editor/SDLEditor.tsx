import React, { useRef, useEffect, useCallback } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { lintGutter } from '@codemirror/lint';
import { AlertCircle, CheckCircle2, CornerDownRight } from 'lucide-react';
import { sdlAutocomplete } from './sdl-language/autocomplete';
import { sdlLinter } from './sdl-language/linter';
import { useSdlStore } from '../../stores/sdlStore';
import styles from './SDLEditor.module.css';

interface SDLEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const SDLEditor: React.FC<SDLEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isExternalUpdate = useRef(false);

  const errors = useSdlStore((s) => s.errors);
  const primaryError = errors[0] ?? null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
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
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--color-text-primary)",
          },
          ".cm-gutters": {
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
            border: "none",
            borderRight: "1px solid var(--color-border-subtle)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "var(--color-surface-overlay)",
          },
          "&.cm-focused .cm-cursor": {
            borderLeftColor: "var(--color-brand-400)",
          },
          "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "rgba(99, 102, 241, 0.35) !important",
          },
          "::selection, .cm-content ::selection": {
            backgroundColor: "rgba(99, 102, 241, 0.35) !important",
            color: "#ffffff !important",
          },
        }, { dark: true })
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
              <AlertCircle size={12} />
              Line {primaryError.line} Error
            </span>
          ) : (
            <span className={styles.validBadge}>
              <CheckCircle2 size={12} />
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleJumpToError();
            }
          }}
        >
          <div className={styles.errorBadge}>
            <AlertCircle size={12} />
            <span>Line {primaryError.line}</span>
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

