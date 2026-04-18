// frontend/src/shared/ui/toast.tsx
// Minimal imperative toast — avoids Radix Toast Provider complexity.
// Exposes a `toast(message, variant?)` singleton used across the app.
import { create } from 'zustand';

export type ToastVariant = 'default' | 'destructive';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (message: string, variant?: ToastVariant) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, variant = 'default') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper — call from anywhere. */
export function toast(message: string, variant: ToastVariant = 'default') {
  useToastStore.getState().push(message, variant);
}
