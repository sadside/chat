import { create } from 'zustand';

interface S {
  open: boolean;
  toggle: () => void;
  setOpen: (v: boolean) => void;
}

export const useGlobalSearch = create<S>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: v }),
}));
