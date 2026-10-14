import { create } from 'zustand';
import { CommandManager } from '../core/commands/CommandManager';

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
}

interface HistoryActions {
  syncWithManager: (manager: CommandManager) => void;
}

export type HistorySlice = HistoryState & HistoryActions;

export const useHistoryStore = create<HistorySlice>()((set) => ({
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,

  syncWithManager: (manager) => set({
    canUndo: manager.canUndo,
    canRedo: manager.canRedo,
    undoDescription: manager.undoDescription,
    redoDescription: manager.redoDescription,
  })
}));
