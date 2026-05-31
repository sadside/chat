import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Renders `< N / M >` arrows for stepping through sibling assistant replies.
 * Hidden when total ≤ 1.
 */
export function BranchNav({ current, total, onPrev, onNext }: Props) {
  if (total <= 1) return null;
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-[--color-border]/60 bg-[--color-muted]/40 px-1.5 py-0.5 text-[11px] text-[--color-muted-foreground]">
      <button
        type="button"
        onClick={onPrev}
        disabled={current === 0}
        aria-label="Предыдущий вариант"
        className="rounded p-0.5 transition-colors hover:bg-[--color-muted] hover:text-[--color-foreground] disabled:opacity-30"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="min-w-[28px] text-center tabular-nums">
        {current + 1} / {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={current >= total - 1}
        aria-label="Следующий вариант"
        className="rounded p-0.5 transition-colors hover:bg-[--color-muted] hover:text-[--color-foreground] disabled:opacity-30"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
