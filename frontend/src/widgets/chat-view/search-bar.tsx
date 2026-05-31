import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';

interface TriggerProps {
  onClick: () => void;
}

/** Subtle floating button that reveals the in-chat search field. */
export function ChatSearchTrigger({ onClick }: TriggerProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Поиск по чату"
      className="glass absolute right-4 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground shadow-soft transition-colors hover:text-foreground"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

interface BarProps {
  value: string;
  onChange: (v: string) => void;
  resultCount: number | null;
  onClose: () => void;
}

/** Floating, animated search field — appears on demand, centered at the top. */
export function ChatSearchBar({ value, onChange, resultCount, onClose }: BarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong absolute left-1/2 top-3 z-10 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-border px-4 py-2 shadow-pop"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск по сообщениям…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Поиск по чату"
        />
        {value && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {resultCount ?? 0}
          </span>
        )}
        <button
          onClick={onClose}
          aria-label="Закрыть поиск"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
