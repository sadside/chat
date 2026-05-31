import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectModelState {
  selectedModel: string | null;
  setSelectedModel: (id: string | null) => void;
}

export const useSelectedModel = create<SelectModelState>()(
  persist(
    (set) => ({
      selectedModel: null,
      setSelectedModel: (id) => set({ selectedModel: id }),
    }),
    { name: 'nova-selected-model' },
  ),
);
