import { useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useStreamStore } from '@/shared/store/stream-store';
import { chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { getApiBase } from '@/shared/config/env';
import type {
  SseUserMessageEvent,
  SseAssistantStartEvent,
  SseDeltaEvent,
  SseAssistantDoneEvent,
  SseErrorEvent,
} from '@/entities/message/types';

const MAX_CONTENT_LENGTH = 32_000;

export function useStreamChat(chatId: string) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const store = useStreamStore();

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Message too long (max ${MAX_CONTENT_LENGTH} chars)`);
      }
      if (store.status === 'streaming') return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      store.startStream(chatId, content);

      try {
        await fetchEventSource(`${getApiBase()}/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          credentials: 'include',
          signal: controller.signal,
          openWhenHidden: true,

          onopen: async (response) => {
            if (!response.ok) {
              throw new Error(`SSE open failed: ${response.status}`);
            }
          },

          onmessage: (ev) => {
            switch (ev.event) {
              case 'user_message': {
                // Server confirmed the user message — the optimistic one is now
                // backed. We don't need to do anything; on done we invalidate.
                const _data: SseUserMessageEvent = JSON.parse(ev.data);
                void _data;
                break;
              }
              case 'assistant_start': {
                const data: SseAssistantStartEvent = JSON.parse(ev.data);
                store.setAssistantId(data.id);
                break;
              }
              case 'delta': {
                const data: SseDeltaEvent = JSON.parse(ev.data);
                store.appendDelta(data.text);
                break;
              }
              case 'assistant_done': {
                const data: SseAssistantDoneEvent = JSON.parse(ev.data);
                store.finishStream(data.content, data.aborted);
                // Messages are already persisted on the server — refetch
                // immediately and reset the streaming overlay only after the
                // refetch resolves, so the UI never flashes empty.
                qc.invalidateQueries({ queryKey: messageKeys.list(chatId) })
                  .then(() => store.reset())
                  .catch(() => store.reset());
                // Auto-title generation runs in the background; give it ~1.5s
                // to update chat.title before refreshing the sidebar.
                setTimeout(() => {
                  qc.invalidateQueries({ queryKey: chatKeys.list() });
                }, 1500);
                break;
              }
              case 'error': {
                const data: SseErrorEvent = JSON.parse(ev.data);
                store.setError(data.message);
                break;
              }
            }
          },

          onerror: (err) => {
            store.setError(err instanceof Error ? err.message : 'Stream error');
            throw err; // stop retrying
          },

          onclose: () => {
            // If stream closed without assistant_done (abort), finalize.
            if (store.status === 'streaming' || store.status === 'stopping') {
              store.finishStream(store.assistantContent, true);
              qc.invalidateQueries({ queryKey: messageKeys.list(chatId) })
                .then(() => store.reset())
                .catch(() => store.reset());
              setTimeout(() => {
                qc.invalidateQueries({ queryKey: chatKeys.list() });
              }, 1500);
            }
          },
        });
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          store.setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    },
    [chatId, store, qc]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      useStreamStore.setState((s) => { s.status = 'stopping'; });
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    send,
    stop,
    isStreaming: store.status === 'streaming' || store.status === 'stopping',
    status: store.status,
  };
}
