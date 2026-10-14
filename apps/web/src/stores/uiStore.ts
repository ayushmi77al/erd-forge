import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type Theme = 'system' | 'light' | 'dark';
export type ModalType = 'settings' | 'import' | 'export' | 'shortcuts' | null;
export type ViewMode = 'sdl' | 'split' | 'canvas';
export type AppMode = 'schema' | 'lineage';

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  viewMode: ViewMode;
  appMode: AppMode;
  activeModal: ModalType;
  theme: Theme;
  isOnboardingCompleted: boolean;
  selectedTable: string | null;
  layoutEpoch: number;
  layoutDirection: 'LR' | 'TB';
}

interface UIActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setViewMode: (mode: ViewMode) => void;
  setAppMode: (mode: AppMode) => void;
  setActiveModal: (modal: ModalType) => void;
  setTheme: (theme: Theme) => void;
  completeOnboarding: () => void;
  setSelectedTable: (tableName: string | null) => void;
  triggerAutoLayout: (direction?: 'LR' | 'TB') => void;
}

export type UISlice = UIState & UIActions;

export const useUIStore = create<UISlice>()(
  immer((set) => ({
    leftPanelOpen: true,
    rightPanelOpen: false,
    viewMode: 'split',
    appMode: 'schema',
    activeModal: null,
    theme: 'system',
    isOnboardingCompleted: false,
    selectedTable: null,
    layoutEpoch: 0,
    layoutDirection: 'LR',

    toggleLeftPanel: () => set((state) => {
      state.leftPanelOpen = !state.leftPanelOpen;
    }),
    
    toggleRightPanel: () => set((state) => {
      state.rightPanelOpen = !state.rightPanelOpen;
    }),

    setViewMode: (mode) => set((state) => {
      state.viewMode = mode;
    }),

    setAppMode: (mode) => set((state) => {
      state.appMode = mode;
    }),

    
    setActiveModal: (modal) => set((state) => {
      state.activeModal = modal;
    }),
    
    setTheme: (theme) => set((state) => {
      state.theme = theme;
    }),
    
    completeOnboarding: () => set((state) => {
      state.isOnboardingCompleted = true;
    }),

    setSelectedTable: (tableName) => set((state) => {
      state.selectedTable = tableName;
    }),

    triggerAutoLayout: (direction) => set((state) => {
      if (direction) {
        state.layoutDirection = direction;
      }
      state.layoutEpoch += 1;
    }),
  }))
);
