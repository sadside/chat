import { useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
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

/**
 * Open an SSE stream and drive the global stream store + React-Query cache.
 *
 * Works without any hook context, so it can be invoked from a Home-page
 * submit handler *before* the user is navigated to the chat route. That
 * guarantees the chat page already sees a populated overlay on its first
 * render and never flashes an empty/welcome state.
 */
export function startMessageStream(options: {
  chatId: string;
  content: string;
  qc: QueryClient;
  signal?: AbortSignal;
}): Promise<void> {
  const { chatId, content, qc, signal } = options;
  if (!content.trim()) return Promise.resolve();
  if (content.length > MAX_CONTENT_LENGTH) {
    return Promise.reject(new Error(`Message too long (max ${MAX_CONTENT_LENGTH} chars)`));
  }

  const store = useStreamStore.getState();
  if (store.status === 'streaming') return Promise.resolve();
  store.startStream(chatId, content);

  const refreshMessages = () =>
    qc
      .invalidateQueries({ queryKey: messageKeys.list(chatId) })
      .then(() => useStreamStore.getState().reset())
      .catch(() => useStreamStore.getState().reset());

  const scheduleChatListRefresh = () => {
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    }, 1500);
  };

  return fetchEventSource(`${getApiBase()}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    credentials: 'include',
    ...(signal ? { signal } : {}),
    openWhenHidden: true,

    onopen: async (response) => {
      if (!response.ok) {
        throw new Error(`SSE open failed: ${response.status}`);
      }
    },

    onmessage: (ev) => {
      switch (ev.event) {
        case 'user_message': {
          // Adopt the server-side id so the optimistic bubble and the
          // eventually-refetched real row share the same React key and we
          // avoid an unmount/remount (which replayed the fade-in animation).
          const data: SseUserMessageEvent = JSON.parse(ev.data);
          useStreamStore.getState().replaceOptimisticUserId(data.id);
          break;
        }
        case 'assistant_start': {
          const data: SseAssistantStartEvent = JSON.parse(ev.data);
          useStreamStore.getState().setAssistantId(data.id);
          break;
        }
        case 'delta': {
          const data: SseDeltaEvent = JSON.parse(ev.data);
          useStreamStore.getState().appendDelta(data.text);
          break;
        }
        case 'assistant_done': {
          const data: SseAssistantDoneEvent = JSON.parse(ev.data);
          useStreamStore.getState().finishStream(data.content, data.aborted);
          void refreshMessages();
          scheduleChatListRefresh();
          break;
        }
        case 'error': {
          const data: SseErrorEvent = JSON.parse(ev.data);
          useStreamStore.getState().setError(data.message);
          break;
        }
      }
    },

    onerror: (err) => {
      useStreamStore.getState().setError(err instanceof Error ? err.message : 'Stream error');
      throw err; // stop retrying
    },

    onclose: () => {
      const s = useStreamStore.getState();
      if (s.status === 'streaming' || s.status === 'stopping') {
        s.finishStream(s.assistantContent, true);
        void refreshMessages();
        scheduleChatListRefresh();
      }
    },
  }).catch((err) => {
    if ((err as Error)?.name !== 'AbortError') {
      useStreamStore.getState().setError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

/** React-hook wrapper around {@link startMessageStream} for use inside a chat page. */
export function useStreamChat(chatId: string) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const store = useStreamStore();

  const send = useCallback(
    async (content: string) => {
      if (store.status === 'streaming') return;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      await startMessageStream({ chatId, content, qc, signal: controller.signal });
    },
    [chatId, qc, store.status],
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      useStreamStore.setState((s) => {
        s.status = 'stopping';
      });
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
