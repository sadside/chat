import { NovaAvatar } from '@/shared/ui/nova-avatar';

/**
 * Shown between assistant_start and the first delta. Disappears as soon as
 * tokens start flowing.
 */
export function ThinkingIndicator() {
  return (
    <div className="flex w-full items-start gap-3">
      <NovaAvatar />
      <div className="flex items-center gap-1.5 pt-1 text-sm text-[--color-muted-foreground]">
        <span>Думаю</span>
        <span className="inline-flex gap-0.5">
          <span
            className="h-1 w-1 animate-bounce rounded-full bg-[--color-muted-foreground]"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-1 w-1 animate-bounce rounded-full bg-[--color-muted-foreground]"
            style={{ animationDelay: '120ms' }}
          />
          <span
            className="h-1 w-1 animate-bounce rounded-full bg-[--color-muted-foreground]"
            style={{ animationDelay: '240ms' }}
          />
        </span>
      </div>
    </div>
  );
}
