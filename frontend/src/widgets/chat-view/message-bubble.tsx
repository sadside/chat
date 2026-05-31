import { useState } from 'react';
import { Copy, Check, RefreshCw, ClipboardCopy, Pencil } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/toast';
import { cn } from '@/shared/lib/utils';
import type { Message } from '@/entities/message/types';

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean | undefined;
  onRegenerate?: (() => void) | undefined;
  showRegenerateButton?: boolean | undefined;
  highlight?: string | undefined;
  onEdit?: ((newContent: string) => void) | undefined;
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
  onEdit,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { copy, copied } = useCopyToClipboard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const startEditing = () => {
    setDraft(message.content);
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setDraft(message.content);
  };
  const saveEditing = () => {
    if (!onEdit) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content.trim()) return;
    onEdit(trimmed);
    setEditing(false);
  };

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
          {isUser && editing ? (
            <div className="flex w-full flex-col gap-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(8, draft.split('\n').length + 1)}
                className="w-full resize-none rounded-md border border-[--color-border] bg-background p-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring/60"
                aria-label="Редактирование сообщения"
              />
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEditing}>
                  Отмена
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.trim() || draft.trim() === message.content.trim()}
                  onClick={saveEditing}
                >
                  Сохранить и пересоздать
                </Button>
              </div>
            </div>
          ) : isUser ? (
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

        {/* Action row — hidden in edit mode */}
        {!editing && (
        <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isUser && onEdit && (
            <button
              onClick={startEditing}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Редактировать сообщение"
              title="Редактировать"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => copy(message.content)}
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Копировать сообщение"
            title="Копировать как текст"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {!isUser && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(message.content).then(
                  () => toast('Скопировано как Markdown'),
                  () => toast('Не удалось скопировать', 'destructive'),
                );
              }}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Копировать как Markdown"
              title="Копировать как Markdown"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
            </button>
          )}

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
        )}
      </div>
    </div>
  );
}
