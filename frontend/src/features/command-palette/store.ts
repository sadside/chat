import { create } from 'zustand';

interface PaletteState {
  open: boolean;
  query: string;
  toggle: () => void;
  setOpen: (v: boolean) => void;
  setQuery: (q: string) => void;
}

export const usePalette = create<PaletteState>((set) => ({
  open: false,
  query: '',
  toggle: () => set((s) => ({ open: !s.open, query: '' })),
  setOpen: (v) => set({ open: v, query: '' }),
  setQuery: (q) => set({ query: q }),
}));
