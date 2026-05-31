import { useMemo, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAutoScroll } from '@/shared/hooks/use-auto-scroll';
import { useStreamStore } from '@/shared/store/stream-store';
import { useSearchInChat } from '@/features/search-in-chat';
import { MessageBubble } from './message-bubble';
import { EmptyState } from './empty-state';
import { GenerationProgress } from './generation-progress';
import { ChatSearchBar } from './search-bar';
import type { Message } from '@/entities/message/types';

interface ChatViewProps {
  messages: Message[];
  chatId: string;
  onRegenerate?: (() => void) | undefined;
  onExamplePrompt?: ((prompt: string) => void) | undefined;
  onEditMessage?: ((messageId: string, content: string) => void) | undefined;
}

function formatDividerDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'd MMMM yyyy', { locale: ru });
}

export function ChatView({
  messages,
  chatId,
  onRegenerate,
  onExamplePrompt,
  onEditMessage,
}: ChatViewProps) {
  const stream = useStreamStore();
  const isStreaming = stream.status === 'streaming' || stream.status === 'stopping';
  const [query, setQuery] = useState('');
  const matchedIds = useSearchInChat(messages, query);
  const filterActive = query.trim().length > 0;

  // Build display list: real messages + optimistic overlay
  const displayMessages: (Message | '__divider__')[] = useMemo(() => {
    const result: (Message | '__divider__')[] = [];
    let prevDate: Date | null = null;

    const allMessages: Message[] = [...messages];

    // The overlay is relevant whenever we have an active stream for THIS
    // chat — including the short window between `assistant_done` and the
    // messages refetch. Using `chatId` + any non-idle status guards against
    // rendering overlay data from a stream that belongs to a different chat.
    const overlayActive =
      stream.chatId === chatId && stream.status !== 'idle';

    // Append optimistic user message until the real row shows up in messages.
    // Dedupe by id — after user_message event we adopt the server-assigned id
    // so the optimistic bubble and the refetched real row share the same key.
    if (overlayActive && stream.optimisticUserMessage) {
      const alreadyExists = messages.some(
        (m) => m.id === stream.optimisticUserMessage!.id,
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

    // Append streaming / just-finished assistant message.
    if (overlayActive && stream.assistantMessageId) {
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
  }, [messages, isStreaming, stream, chatId]);

  const { anchorRef } = useAutoScroll([
    displayMessages.length,
    stream.assistantContent.length,
    stream.status,
  ]);

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState {...(onExamplePrompt ? { onPromptClick: onExamplePrompt } : {})} />;
  }

  const hasEnoughForSearch = messages.length >= 4;

  const lastAssistantIndex = [...displayMessages]
    .reverse()
    .findIndex((m) => m !== '__divider__' && (m as Message).role === 'assistant');
  const lastAssistantId =
    lastAssistantIndex !== -1
      ? (displayMessages[displayMessages.length - 1 - lastAssistantIndex] as Message).id
      : null;

  return (
    <div className="flex-1 overflow-y-auto">
      {hasEnoughForSearch && (
        <ChatSearchBar
          value={query}
          onChange={setQuery}
          resultCount={filterActive ? matchedIds.size : null}
        />
      )}
      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-8">
        {displayMessages.map((item, idx) => {
          if (item === '__divider__') {
            // Find the next message to get its date
            const nextMsg = displayMessages.slice(idx + 1).find((m) => m !== '__divider__') as
              | Message
              | undefined;
            const dividerKey = nextMsg
              ? `divider-${new Date(nextMsg.created_at).toDateString()}`
              : 'divider-end';
            return (
              <div key={dividerKey} className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {nextMsg ? formatDividerDate(nextMsg.created_at) : ''}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }

          const msg = item as Message;
          if (filterActive && !matchedIds.has(msg.id)) return null;
          const isStreamingThis =
            isStreaming && msg.id === stream.assistantMessageId && msg.role === 'assistant';

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              streaming={isStreamingThis}
              showRegenerateButton={msg.id === lastAssistantId && !isStreaming}
              highlight={filterActive ? query : undefined}
              {...(onRegenerate ? { onRegenerate } : {})}
              {...(onEditMessage
                ? { onEdit: (c: string) => onEditMessage(msg.id, c) }
                : {})}
            />
          );
        })}

        {stream.status === 'error' && stream.error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {stream.error}
          </div>
        )}

        <GenerationProgress />
        <div ref={anchorRef} className="h-1" aria-hidden="true" />
      </div>
    </div>
  );
}
