import { motion } from 'motion/react';
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
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex flex-col gap-1',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[min(85%,680px)] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
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
            — Stopped
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => copy(message.content)}
          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy message"
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
            aria-label="Regenerate response"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
