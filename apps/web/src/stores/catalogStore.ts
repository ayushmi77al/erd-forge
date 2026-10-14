import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ActiveView = 'tables' | 'views' | 'domains' | 'glossary';

interface CatalogState {
  searchQuery: string;
  activeView: ActiveView;
  selectedTags: string[];
}

interface CatalogActions {
  setSearchQuery: (query: string) => void;
  setActiveView: (view: ActiveView) => void;
  setSelectedTags: (tags: string[]) => void;
}

export type CatalogSlice = CatalogState & CatalogActions;

export const useCatalogStore = create<CatalogSlice>()(
  immer((set) => ({
    searchQuery: '',
    activeView: 'tables',
    selectedTags: [],

    setSearchQuery: (query) => set((state) => {
      state.searchQuery = query;
    }),
    
    setActiveView: (view) => set((state) => {
      state.activeView = view;
    }),
    
    setSelectedTags: (tags) => set((state) => {
      state.selectedTags = tags;
    })
  }))
);
