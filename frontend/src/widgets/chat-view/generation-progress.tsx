import { useEffect, useState } from 'react';
import { useStreamStore } from '@/shared/store/stream-store';

/**
 * Live progress strip rendered below the streaming assistant bubble.
 * Shows elapsed time, accumulated character count, and chars-per-second.
 * Self-cleans the interval when streaming ends.
 */
export function GenerationProgress() {
  const startedAt = useStreamStore((s) => s.startedAt);
  const content = useStreamStore((s) => s.assistantContent);
  const status = useStreamStore((s) => s.status);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (status !== 'streaming') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);

  if (!startedAt || status !== 'streaming') return null;

  const elapsed = Math.max(0.1, (now - startedAt) / 1000);
  const chars = content.length;
  const rate = chars / elapsed;

  return (
    <div
      className="mt-1 text-[11px] text-muted-foreground tabular-nums"
      aria-live="polite"
    >
      {elapsed.toFixed(1)} c · {chars} симв · {rate.toFixed(0)} симв/с
    </div>
  );
}
