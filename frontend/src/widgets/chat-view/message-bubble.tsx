import { Copy, Check, RefreshCw } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';
import { cn } from '@/shared/lib/utils';
import type { Message } from '@/entities/message/types';

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean | undefined;
  onRegenerate?: (() => void) | undefined;
  showRegenerateButton?: boolean | undefined;
}

export function MessageBubble({
  message,
  streaming = false,
  onRegenerate,
  showRegenerateButton = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { copy, copied } = useCopyToClipboard();

  return (
    // Mount-only fade-in via Tailwind (animate-in runs exactly once when the
    // element enters the DOM; subsequent re-renders during streaming deltas
    // do NOT replay it).
    <div
      className={cn(
        'group flex gap-3',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold select-none',
        isUser
          ? 'bg-[--color-secondary] text-[--color-secondary-foreground]'
          : 'bg-gradient-to-br from-[--color-primary] to-[--color-accent-alt] text-white'
      )}>
        {isUser ? 'Я' : '⊙'}
      </div>

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start', 'min-w-0 flex-1')}>
        <div
          className={cn(
            'relative text-sm',
            isUser
              ? [
                  'rounded-2xl rounded-tr-sm px-4 py-2.5',
                  'bg-[color-mix(in_oklch,var(--color-primary)_15%,transparent)]',
                  'border border-[--color-primary]/20',
                  'max-w-[min(68ch,85%)]',
                ].join(' ')
              : [
                  'text-foreground max-w-full',
                ].join(' '),
            message.aborted && !isUser && 'opacity-70'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} streaming={streaming} />
          )}

          {message.aborted && !isUser && (
            <span className="mt-1 block text-xs text-muted-foreground">
              — Остановлено
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => copy(message.content)}
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Копировать сообщение"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {showRegenerateButton && !isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Сгенерировать снова"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
