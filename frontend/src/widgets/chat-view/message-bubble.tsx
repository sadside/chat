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
  highlight?: string | undefined;
}

function highlightText(text: string, query: string | undefined) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={i}
        className="rounded px-0.5 bg-yellow-200/60 dark:bg-yellow-500/40"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function MessageBubble({
  message,
  streaming = false,
  onRegenerate,
  showRegenerateButton = false,
  highlight,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { copy, copied } = useCopyToClipboard();

  return (
    // Mount-only fade-in via Tailwind. `animate-in` fires exactly once when
    // the element enters the DOM and does not replay during streaming deltas.
    <div
      className={cn(
        'group flex w-full',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-1 min-w-0',
          isUser ? 'items-end max-w-[min(68ch,85%)]' : 'items-start max-w-full flex-1'
        )}
      >
        <div
          className={cn(
            'relative text-[15px] leading-relaxed',
            isUser
              ? [
                  'rounded-2xl rounded-tr-md px-4 py-2.5',
                  'bg-[color-mix(in_oklch,var(--color-primary)_14%,transparent)]',
                  'border border-[--color-primary]/15',
                  'text-foreground',
                ].join(' ')
              : 'text-foreground w-full',
            message.aborted && !isUser && 'opacity-70'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">
              {highlight ? highlightText(message.content, highlight) : message.content}
            </p>
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
