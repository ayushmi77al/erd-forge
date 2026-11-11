import { EditorView } from "@codemirror/view";

export interface EditorThemeOptions {
  dark: boolean;
  fontSize?: string;
  fontFamily?: string;
  contentPadding?: string;
}

/** Creates a CodeMirror 6 theme bound cleanly to ERD Forge CSS custom properties. */
export function createEditorTheme(options: EditorThemeOptions) {
  const { dark, fontSize, fontFamily, contentPadding } = options;

  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "transparent",
        color: "var(--color-text-primary)",
        ...(fontSize ? { fontSize } : {}),
        ...(fontFamily ? { fontFamily } : {}),
      },
      ...(contentPadding
        ? {
            ".cm-content": {
              padding: contentPadding,
              caretColor: "var(--color-brand-400)",
            },
          }
        : {}),
      ".cm-gutters": {
        backgroundColor: "var(--color-surface-raised)",
        color: "var(--color-text-muted)",
        border: "none",
        borderRight: "1px solid var(--color-border-subtle)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--color-surface-overlay)",
      },
      ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--color-text-primary) 4%, transparent)",
      },
      ".cm-cursor, &.cm-focused .cm-cursor": {
        borderLeftColor: "var(--color-brand-400)",
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, &.cm-focused .cm-selectionBackground":
        {
          backgroundColor: "color-mix(in srgb, var(--color-brand-500) 28%, transparent) !important",
        },
      ".cm-selectionMatch": {
        backgroundColor: "color-mix(in srgb, var(--color-brand-400) 20%, transparent) !important",
      },
      "::selection, .cm-content ::selection": {
        backgroundColor: "color-mix(in srgb, var(--color-brand-500) 28%, transparent) !important",
        color: "var(--color-text-primary) !important",
      },
    },
    { dark },
  );
}
