import React, { useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Send, Square, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { ModelPicker } from './model-picker';
import { SlashPopover, type SlashCommand } from '@/features/slash-commands';
import { useDraft } from '@/features/draft-saver/useDraft';

const MAX_ROWS = 8;
const MAX_LENGTH = 32_000;

interface ComposerProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Persist textarea content under `nova-draft-<draftKey>` in localStorage. */
  draftKey?: string;
}

export function Composer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Спросите Nova…',
  draftKey,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState('');
  const [pendingCommand, setPendingCommand] = React.useState<SlashCommand | null>(null);

  const { clear: clearDraft } = useDraft(draftKey ?? '__noop__', value, setValue);

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
    const finalContent = pendingCommand ? pendingCommand.apply(trimmed) : trimmed;
    onSend(finalContent);
    setValue('');
    setPendingCommand(null);
    if (draftKey) clearDraft();
  }, [value, isStreaming, disabled, onSend, pendingCommand, draftKey, clearDraft]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Let the slash popover handle Enter while it's open.
        if (!pendingCommand && value.startsWith('/')) return;
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, pendingCommand, value]
  );

  const tooLong = value.length > MAX_LENGTH;
  const slashOpen = !pendingCommand && value.startsWith('/');
  const slashQuery = slashOpen ? value.slice(1) : '';

  const pickCommand = (cmd: SlashCommand) => {
    setPendingCommand(cmd);
    setValue('');
  };

  return (
    <div
      data-tour="composer"
      className={cn(
        'composer-root relative flex flex-col gap-1 rounded-2xl border border-[--color-border] bg-[--color-card] px-4 py-3 shadow-sm',
        'focus-within:ring-2 focus-within:ring-[--color-ring]/40',
        disabled && 'opacity-50'
      )}
    >
      {slashOpen && (
        <SlashPopover
          query={slashQuery}
          onPick={pickCommand}
          onClose={() => setValue('')}
        />
      )}

      {pendingCommand && (
        <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-[--color-primary]/10 px-2 py-0.5 text-xs font-medium text-[--color-primary]">
          {pendingCommand.label}
          <button
            type="button"
            onClick={() => setPendingCommand(null)}
            aria-label="Очистить команду"
            className="rounded p-0.5 hover:bg-[--color-primary]/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className={cn(
          'w-full resize-none bg-transparent text-sm leading-6 outline-none',
          'placeholder:text-[--color-muted-foreground]',
          tooLong && 'text-[--color-destructive]'
        )}
        placeholder={pendingCommand ? 'Введите аргумент команды…' : placeholder}
        rows={1}
        value={value}
        disabled={disabled || isStreaming}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Поле ввода сообщения"
        maxLength={MAX_LENGTH + 200}
      />

      <div className="flex items-center justify-between">
        <ModelPicker />
        {tooLong && (
          <span className="ml-3 text-xs text-[--color-destructive]">
            {value.length}/{MAX_LENGTH} — слишком длинное
          </span>
        )}
        <span className="flex-1" />

        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8 rounded-full transition-transform active:scale-95"
            onClick={onStop}
            aria-label="Остановить генерацию"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-8 w-8 rounded-full transition-transform hover:scale-105 active:scale-95"
            disabled={!value.trim() || disabled || tooLong}
            onClick={handleSend}
            aria-label="Отправить сообщение"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
