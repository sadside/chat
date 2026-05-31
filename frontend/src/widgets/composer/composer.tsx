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
        'composer-root relative flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3',
        'shadow-soft transition-all duration-200',
        'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/15',
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
        <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {pendingCommand.label}
          <button
            type="button"
            onClick={() => setPendingCommand(null)}
            aria-label="Очистить команду"
            className="rounded p-0.5 hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className={cn(
          'w-full resize-none bg-transparent text-sm leading-6 outline-none',
          'placeholder:text-muted-foreground',
          tooLong && 'text-destructive'
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
          <span className="ml-3 text-xs text-destructive">
            {value.length}/{MAX_LENGTH} — слишком длинное
          </span>
        )}
        <span className="flex-1" />

        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8 rounded-lg transition-transform active:scale-95"
            onClick={onStop}
            aria-label="Остановить генерацию"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <button
            type="button"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
              'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'
            )}
            disabled={!value.trim() || disabled || tooLong}
            onClick={handleSend}
            aria-label="Отправить сообщение"
          >
            <Send className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>
    </div>
  );
}
