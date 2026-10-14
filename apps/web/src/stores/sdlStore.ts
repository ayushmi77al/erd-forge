import { create } from 'zustand';
import { SDLProgram } from '../types/sdl';
import { SDLError } from './editorStore';
import { SDLParser } from '../parsers/sdl/SDLParser';

const initialSdlText = `Table users {\n  id integer [pk]\n  username varchar\n  created_at timestamp\n}\n\nTable posts {\n  id integer [pk]\n  title varchar\n  body text\n  user_id integer\n}\n\nRef: posts.user_id > users.id\n`;
const initialParse = SDLParser.parse(initialSdlText);

interface SdlState {
  sdlText: string;
  ast: SDLProgram | null;
  lastValidAst: SDLProgram | null;
  error: string | null;
  errors: SDLError[];
  isStale: boolean;
  isSaving: boolean;
  setSdlText: (text: string) => void;
  setAst: (ast: SDLProgram | null, error?: string | null, errors?: SDLError[]) => void;
  setParseResult: (result: { ast: SDLProgram | null; errors: SDLError[] }) => void;
  saveToFile: () => Promise<void>;
}

export const useSdlStore = create<SdlState>((set, get) => ({
  sdlText: initialSdlText,
  ast: initialParse.ast,
  lastValidAst: initialParse.ast,
  error: null,
  errors: [],
  isStale: false,
  isSaving: false,
  setSdlText: (text) => {
    const parseResult = SDLParser.parse(text);
    get().setParseResult(parseResult);
    set({ sdlText: text });
  },
  setParseResult: (result: { ast: SDLProgram | null; errors: SDLError[] }) => {
    const current = get();
    const hasErrors = result.errors.length > 0;
    const primaryError = result.errors[0]?.message ?? null;

    if (!hasErrors) {
      set({
        ast: result.ast,
        lastValidAst: result.ast,
        errors: [],
        error: null,
        isStale: false,
      });
      return;
    }

    // When there are syntax errors while typing, do NOT vanish the existing schema view!
    if (result.ast && result.ast.statements.length > 0) {
      // Resilient parse found some valid statements
      const currentTableNames = new Set(
        result.ast.statements
          .filter((s) => s.type === 'Table')
          .map((s) => (s as any).name)
      );

      const preservedStatements = [...result.ast.statements];

      // If an existing table was temporarily broken while user was editing it,
      // preserve its previous valid version from lastValidAst so it doesn't vanish.
      if (current.lastValidAst) {
        for (const prevStmt of current.lastValidAst.statements) {
          if (prevStmt.type === 'Table' && !currentTableNames.has((prevStmt as any).name)) {
            const regex = new RegExp(`\\bTable\\s+${(prevStmt as any).name}\\b`);
            if (regex.test(current.sdlText)) {
              preservedStatements.push(prevStmt);
            }
          }
        }
      }

      set({
        ast: { type: 'Program', statements: preservedStatements },
        errors: result.errors,
        error: primaryError,
        isStale: true,
      });
    } else {
      // All statements failed or text is incomplete in first statement:
      // Keep existing ast / lastValidAst so view does not completely vanish!
      const fallbackAst = current.ast || current.lastValidAst || null;
      set({
        ast: fallbackAst,
        errors: result.errors,
        error: primaryError,
        isStale: !!fallbackAst,
      });
    }
  },
  setAst: (ast, error = null, errors = []) => {
    get().setParseResult({
      ast,
      errors: errors.length > 0 ? errors : (error ? [{ line: 1, column: 1, message: error }] : []),
    });
  },
  saveToFile: async () => {
    const { sdlText } = get();
    const blob = new Blob([sdlText], { type: 'text/plain' });

    if ('showSaveFilePicker' in window) {
      try {
        set({ isSaving: true });
        const handle = await window.showSaveFilePicker({
          suggestedName: 'schema.erdforge',
          types: [{ description: 'ERD Forge Schema', accept: { 'text/plain': ['.erdforge', '.sdl'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to save file:', err);
      } finally {
        set({ isSaving: false });
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schema.erdforge';
      a.click();
      URL.revokeObjectURL(url);
    }
  },
}));
