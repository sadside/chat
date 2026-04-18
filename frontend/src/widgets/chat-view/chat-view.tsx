import { useMemo } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useAutoScroll } from '@/shared/hooks/use-auto-scroll';
import { useStreamStore } from '@/shared/store/stream-store';
import { MessageBubble } from './message-bubble';
import { EmptyState } from './empty-state';
import type { Message } from '@/entities/message/types';

interface ChatViewProps {
  messages: Message[];
  onRegenerate?: (() => void) | undefined;
  onExamplePrompt?: ((prompt: string) => void) | undefined;
}

function formatDividerDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export function ChatView({ messages, onRegenerate, onExamplePrompt }: ChatViewProps) {
  const stream = useStreamStore();
  const isStreaming = stream.status === 'streaming' || stream.status === 'stopping';

  // Build display list: real messages + optimistic overlay
  const displayMessages: (Message | '__divider__')[] = useMemo(() => {
    const result: (Message | '__divider__')[] = [];
    let prevDate: Date | null = null;

    const allMessages: Message[] = [...messages];

    // Append optimistic user message if streaming and not yet in messages list
    if (isStreaming && stream.optimisticUserMessage) {
      const alreadyExists = messages.some(
        (m) => m.role === 'user' && m.content === stream.optimisticUserMessage!.content
      );
      if (!alreadyExists) {
        allMessages.push({
          id: stream.optimisticUserMessage.id,
          chat_id: stream.chatId ?? '',
          role: 'user',
          content: stream.optimisticUserMessage.content,
          aborted: false,
          created_at: stream.optimisticUserMessage.created_at,
        });
      }
    }

    // Append streaming assistant message
    if ((isStreaming || stream.status === 'done') && stream.assistantMessageId) {
      const alreadyExists = messages.some((m) => m.id === stream.assistantMessageId);
      if (!alreadyExists) {
        allMessages.push({
          id: stream.assistantMessageId,
          chat_id: stream.chatId ?? '',
          role: 'assistant',
          content: stream.assistantContent,
          aborted: stream.aborted,
          created_at: new Date().toISOString(),
        });
      }
    }

    for (const msg of allMessages) {
      const msgDate = new Date(msg.created_at);
      if (!prevDate || !isSameDay(prevDate, msgDate)) {
        result.push('__divider__');
        prevDate = msgDate;
      }
      result.push(msg);
    }

    return result;
  }, [messages, isStreaming, stream]);

  const { anchorRef } = useAutoScroll([displayMessages.length, stream.assistantContent]);

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState {...(onExamplePrompt ? { onPromptClick: onExamplePrompt } : {})} />;
  }

  const lastAssistantIndex = [...displayMessages]
    .reverse()
    .findIndex((m) => m !== '__divider__' && (m as Message).role === 'assistant');
  const lastAssistantId =
    lastAssistantIndex !== -1
      ? (displayMessages[displayMessages.length - 1 - lastAssistantIndex] as Message).id
      : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
        {displayMessages.map((item, idx) => {
          if (item === '__divider__') {
            // Find the next message to get its date
            const nextMsg = displayMessages.slice(idx + 1).find((m) => m !== '__divider__') as
              | Message
              | undefined;
            return (
              <div key={`divider-${idx}`} className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {nextMsg ? formatDividerDate(nextMsg.created_at) : ''}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }

          const msg = item as Message;
          const isStreamingThis =
            isStreaming && msg.id === stream.assistantMessageId && msg.role === 'assistant';

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              streaming={isStreamingThis}
              showRegenerateButton={msg.id === lastAssistantId && !isStreaming}
              {...(onRegenerate ? { onRegenerate } : {})}
            />
          );
        })}

        {stream.status === 'error' && stream.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {stream.error}
          </div>
        )}

        <div ref={anchorRef} className="h-1" aria-hidden="true" />
      </div>
    </div>
  );
}
