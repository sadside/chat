// frontend/src/shared/ui/sonner.tsx
// Renders the active toasts from useToastStore in a fixed overlay.
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useToastStore } from '@/shared/ui/toast';
import { cn } from '@/shared/lib/utils';

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'flex min-w-[280px] items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              t.variant === 'destructive'
                ? 'border-red-500/30 bg-red-950 text-red-200'
                : 'border-[--color-border] bg-[--color-background] text-[--color-foreground]'
            )}
          >
            <span>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
