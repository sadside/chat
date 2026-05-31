import { useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  useStreamStore,
  setActiveController,
  getActiveController,
  abortActiveStream,
} from '@/shared/store/stream-store';
import { chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { getApiBase } from '@/shared/config/env';
import { clientLogger, newTraceId } from '@/shared/logger';
import { toast } from '@/shared/ui/toast';
import { useSelectedModel } from '@/features/select-model';
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
 *
 * If a previous stream is in-flight (any chat), it gets aborted before the
 * new one starts. Late onmessage callbacks from the previous stream are
 * dropped via a chatId guard.
 */
export function startMessageStream(options: {
  chatId: string;
  content: string;
  qc: QueryClient;
}): Promise<void> {
  const { chatId, content, qc } = options;
  if (!content.trim()) return Promise.resolve();
  if (content.length > MAX_CONTENT_LENGTH) {
    return Promise.reject(new Error(`Message too long (max ${MAX_CONTENT_LENGTH} chars)`));
  }

  const traceId = newTraceId();
  clientLogger.log('info', 'user.message_send', {
    traceId,
    chatId,
    contentLen: content.length,
  });

  const store = useStreamStore.getState();
  if (store.status === 'streaming') return Promise.resolve();

  // Cancel any previous in-flight stream (different chat or same chat).
  abortActiveStream();
  const controller = new AbortController();
  setActiveController(controller);

  store.startStream(chatId, content);

  const isStillActive = () => useStreamStore.getState().chatId === chatId;

  const refreshMessages = () => {
    qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    return qc
      .invalidateQueries({ queryKey: messageKeys.list(chatId) })
      .then(() => useStreamStore.getState().reset())
      .catch(() => useStreamStore.getState().reset());
  };

  const scheduleChatListRefresh = () => {
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    }, 1500);
  };

  const model = useSelectedModel.getState().selectedModel;
  const url =
    `${getApiBase()}/chats/${chatId}/messages` +
    (model ? `?model=${encodeURIComponent(model)}` : '');

  return fetchEventSource(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId },
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
      // Stale-stream guard: a late callback may arrive after navigation
      // switched the overlay to a different chat — drop it so we don't
      // clobber the new chat's data.
      if (useStreamStore.getState().chatId !== chatId) return;

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
          if (isStillActive()) {
            void refreshMessages();
            scheduleChatListRefresh();
          }
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
        if (isStillActive()) {
          void refreshMessages();
          scheduleChatListRefresh();
        }
      }
    },
  })
    .catch((err) => {
      if ((err as Error)?.name !== 'AbortError') {
        useStreamStore.getState().setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })
    .finally(() => {
      if (getActiveController() === controller) setActiveController(null);
    });
}

/** React-hook wrapper around {@link startMessageStream} for use inside a chat page. */
export function useStreamChat(chatId: string) {
  const qc = useQueryClient();
  const store = useStreamStore();

  const send = useCallback(
    async (content: string) => {
      if (store.status === 'streaming') return;
      await startMessageStream({ chatId, content, qc });
    },
    [chatId, qc, store.status],
  );

  const stop = useCallback(() => {
    if (useStreamStore.getState().status === 'streaming') {
      useStreamStore.getState().setStopping();
      abortActiveStream('user');
      toast('Генерация остановлена');
    }
  }, []);

  const retry = useCallback(async () => {
    const last = useStreamStore.getState().lastUserContent;
    if (!last) return;
    useStreamStore.getState().reset();
    await startMessageStream({ chatId, content: last, qc });
  }, [chatId, qc]);

  return {
    send,
    stop,
    retry,
    isStreaming: store.status === 'streaming' || store.status === 'stopping',
    status: store.status,
  };
}
