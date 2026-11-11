import type { SDLError } from "@erd-forge/parser-sdl";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type { SDLError };

interface EditorState {
  sdlText: string;
  parseErrors: SDLError[];
  cursorLine: number;
}

interface EditorActions {
  setSdlText: (text: string) => void;
  setParseErrors: (errors: SDLError[]) => void;
  setCursorLine: (line: number) => void;
}

export type EditorSlice = EditorState & EditorActions;

export const useEditorStore = create<EditorSlice>()(
  immer((set) => ({
    sdlText: "",
    parseErrors: [],
    cursorLine: 1,

    setSdlText: (text) =>
      set((state) => {
        state.sdlText = text;
      }),

    setParseErrors: (errors) =>
      set((state) => {
        state.parseErrors = errors;
      }),

    setCursorLine: (line) =>
      set((state) => {
        state.cursorLine = line;
      }),
  })),
);
