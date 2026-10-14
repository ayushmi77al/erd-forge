import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ERDForgeProject } from '../core/models';
import { CommandManager } from '../core/commands/CommandManager';
import { Command } from '../core/commands/Command';
import { useHistoryStore } from './historyStore';

export const commandManager = new CommandManager();

interface ProjectState {
  project: ERDForgeProject | null;
  isLoading: boolean;
}

interface ProjectActions {
  setProject: (project: ERDForgeProject) => void;
  setProjectName: (name: string) => void;
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

export type ProjectSlice = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectSlice>()(
  immer((set, get) => ({
    project: null,
    isLoading: true,

    setProject: (project) => set((state) => {
      state.project = project;
      state.isLoading = false;
    }),

    setProjectName: (name) => set((state) => {
      if (state.project) {
        state.project.name = name;
        state.project.updatedAt = new Date().toISOString();
      }
    }),

    executeCommand: (command) => {
      set((state) => {
        if (state.project) {
          commandManager.push(command);
          command.execute(state.project);
        }
      });
      useHistoryStore.getState().syncWithManager(commandManager);
    },

    undo: () => {
      set((state) => {
        if (state.project) {
          const cmd = commandManager.undo();
          if (cmd) {
            cmd.undo(state.project);
          }
        }
      });
      useHistoryStore.getState().syncWithManager(commandManager);
    },

    redo: () => {
      set((state) => {
        if (state.project) {
          const cmd = commandManager.redo();
          if (cmd) {
            cmd.execute(state.project);
          }
        }
      });
      useHistoryStore.getState().syncWithManager(commandManager);
    },
  }))
);
