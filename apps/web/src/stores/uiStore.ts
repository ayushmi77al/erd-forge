import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { StorageEngineType } from "../storage/StorageAdapter";
import type { TabRole } from "../storage/TabLockCoordinator";

export type Theme = "system" | "light" | "dark";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  return theme;
}
export type ModalType = "settings" | "import" | "export" | "shortcuts" | "tab-conflict" | null;
export type ViewMode = "sdl" | "split" | "canvas";
export type AppMode = "schema" | "lineage";

export interface StorageStatus {
  engine: StorageEngineType;
  isFallback: boolean;
  error?: string;
}

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
  layoutDirection: "LR" | "TB";
  storageStatus: StorageStatus;
  tabRole: TabRole;
  conflictLeaderId: string | null;
  showTabRevokedBanner: boolean;
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
  triggerAutoLayout: (direction?: "LR" | "TB") => void;
  setStorageStatus: (status: StorageStatus) => void;
  setTabRole: (role: TabRole) => void;
  setTabConflict: (isOpen: boolean, leaderId?: string | null) => void;
  setShowTabRevokedBanner: (show: boolean) => void;
}

export type UISlice = UIState & UIActions;

export const useUIStore = create<UISlice>()(
  immer((set) => ({
    leftPanelOpen: true,
    rightPanelOpen: false,
    viewMode: "split",
    appMode: "schema",
    activeModal: null,
    theme: "dark",
    isOnboardingCompleted: false,
    selectedTable: null,
    layoutEpoch: 0,
    layoutDirection: "LR",
    storageStatus: {
      engine: "none",
      isFallback: false,
    },
    tabRole: "unlocked",
    conflictLeaderId: null,
    showTabRevokedBanner: false,

    setTabRole: (role) =>
      set((state) => {
        state.tabRole = role;
      }),

    setTabConflict: (isOpen, leaderId = null) =>
      set((state) => {
        state.conflictLeaderId = leaderId;
        state.activeModal = isOpen ? "tab-conflict" : null;
      }),

    setShowTabRevokedBanner: (show) =>
      set((state) => {
        state.showTabRevokedBanner = show;
      }),

    setStorageStatus: (status) =>
      set((state) => {
        state.storageStatus = status;
      }),

    toggleLeftPanel: () =>
      set((state) => {
        state.leftPanelOpen = !state.leftPanelOpen;
      }),

    toggleRightPanel: () =>
      set((state) => {
        state.rightPanelOpen = !state.rightPanelOpen;
      }),

    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode;
      }),

    setAppMode: (mode) =>
      set((state) => {
        state.appMode = mode;
      }),

    setActiveModal: (modal) =>
      set((state) => {
        state.activeModal = modal;
      }),

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
      }),

    completeOnboarding: () =>
      set((state) => {
        state.isOnboardingCompleted = true;
      }),

    setSelectedTable: (tableName) =>
      set((state) => {
        state.selectedTable = tableName;
      }),

    triggerAutoLayout: (direction) =>
      set((state) => {
        if (direction) {
          state.layoutDirection = direction;
        }
        state.layoutEpoch += 1;
      }),
  })),
);
