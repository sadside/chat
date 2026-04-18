import React, { useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const MAX_ROWS = 8;
const MAX_LENGTH = 32_000;

interface ComposerProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Message Nova…',
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState('');

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 24;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const tooLong = value.length > MAX_LENGTH;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl border bg-background px-4 py-3 shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring',
        disabled && 'opacity-50'
      )}
    >
      <textarea
        ref={textareaRef}
        className={cn(
          'w-full resize-none bg-transparent text-sm leading-6 outline-none',
          'placeholder:text-muted-foreground',
          tooLong && 'text-destructive'
        )}
        placeholder={placeholder}
        rows={1}
        value={value}
        disabled={disabled || isStreaming}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Message input"
        maxLength={MAX_LENGTH + 200} // allow slight over to show warning
      />

      <div className="flex items-center justify-between">
        {tooLong && (
          <span className="text-xs text-destructive">
            {value.length}/{MAX_LENGTH} — message too long
          </span>
        )}
        <span className="flex-1" />

        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={onStop}
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-8 w-8"
            disabled={!value.trim() || disabled || tooLong}
            onClick={handleSend}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
