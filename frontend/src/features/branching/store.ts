import { create } from 'zustand';

interface State {
  /**
   * For each parent message id, which branch_index the user has selected.
   * No entry → default to the latest (max branch_index) sibling.
   */
  selected: Record<string, number>;
  select: (parentId: string, idx: number) => void;
  reset: () => void;
}

export const useBranchStore = create<State>((set) => ({
  selected: {},
  select: (parentId, idx) =>
    set((s) => ({ selected: { ...s.selected, [parentId]: idx } })),
  reset: () => set({ selected: {} }),
}));
