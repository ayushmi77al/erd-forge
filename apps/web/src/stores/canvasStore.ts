import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type DisplayMode = 'full' | 'compact' | 'name-only';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasState {
  viewport: Viewport;
  selection: string[];
  activeSheetId: string | null;
  displayMode: DisplayMode;
}

interface CanvasActions {
  setViewport: (viewport: Viewport) => void;
  setSelection: (selection: string[]) => void;
  setActiveSheetId: (sheetId: string | null) => void;
  setDisplayMode: (mode: DisplayMode) => void;
}

export type CanvasSlice = CanvasState & CanvasActions;

export const useCanvasStore = create<CanvasSlice>()(
  immer((set) => ({
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: [],
    activeSheetId: null,
    displayMode: 'full',

    setViewport: (viewport) => set((state) => {
      state.viewport = viewport;
    }),
    
    setSelection: (selection) => set((state) => {
      state.selection = selection;
    }),
    
    setActiveSheetId: (sheetId) => set((state) => {
      state.activeSheetId = sheetId;
    }),
    
    setDisplayMode: (mode) => set((state) => {
      state.displayMode = mode;
    })
  }))
);
