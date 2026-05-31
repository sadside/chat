import { useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
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
import { useSelectedModel } from '@/features/select-model';
import type {
  SseUserMessageEvent,
  SseAssistantStartEvent,
  SseDeltaEvent,
  SseAssistantDoneEvent,
  SseErrorEvent,
} from '@/entities/message/types';

export function useEditMessage(chatId: string) {
  const qc = useQueryClient();

  const edit = useCallback(
    async (messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed) return;

      const traceId = newTraceId();
      clientLogger.log('info', 'user.message_edit', {
        traceId,
        chatId,
        messageId,
        contentLen: trimmed.length,
      });

      abortActiveStream();
      const controller = new AbortController();
      setActiveController(controller);

      const store = useStreamStore.getState();
      store.startStream(chatId, trimmed);

      const isStillActive = () => useStreamStore.getState().chatId === chatId;

      const refresh = () => {
        qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        return qc
          .invalidateQueries({ queryKey: messageKeys.list(chatId) })
          .then(() => useStreamStore.getState().reset())
          .catch(() => useStreamStore.getState().reset());
      };

      const model = useSelectedModel.getState().selectedModel;
      const url =
        `${getApiBase()}/chats/${chatId}/messages/${messageId}/edit` +
        (model ? `?model=${encodeURIComponent(model)}` : '');

      try {
        await fetchEventSource(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId },
          body: JSON.stringify({ content: trimmed }),
          credentials: 'include',
          signal: controller.signal,
          openWhenHidden: true,

          onopen: async (res) => {
            if (!res.ok) throw new Error(`Edit SSE failed: ${res.status}`);
          },

          onmessage: (ev) => {
            if (useStreamStore.getState().chatId !== chatId) return;
            switch (ev.event) {
              case 'user_message': {
                const d: SseUserMessageEvent = JSON.parse(ev.data);
                useStreamStore.getState().replaceOptimisticUserId(d.id);
                break;
              }
              case 'assistant_start': {
                const d: SseAssistantStartEvent = JSON.parse(ev.data);
                useStreamStore.getState().setAssistantId(d.id);
                break;
              }
              case 'delta': {
                const d: SseDeltaEvent = JSON.parse(ev.data);
                useStreamStore.getState().appendDelta(d.text);
                break;
              }
              case 'assistant_done': {
                const d: SseAssistantDoneEvent = JSON.parse(ev.data);
                useStreamStore.getState().finishStream(d.content, d.aborted);
                if (isStillActive()) void refresh();
                break;
              }
              case 'error': {
                const d: SseErrorEvent = JSON.parse(ev.data);
                useStreamStore.getState().setError(d.message);
                break;
              }
            }
          },

          onerror: (err) => {
            useStreamStore.getState().setError(
              err instanceof Error ? err.message : 'Edit error',
            );
            throw err;
          },

          onclose: () => {
            const s = useStreamStore.getState();
            if (s.status === 'streaming' || s.status === 'stopping') {
              s.finishStream(s.assistantContent, true);
              if (isStillActive()) void refresh();
            }
          },
        });
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          useStreamStore.getState().setError(
            err instanceof Error ? err.message : 'Unknown error',
          );
        }
      } finally {
        if (getActiveController() === controller) setActiveController(null);
      }
    },
    [chatId, qc],
  );

  return { edit };
}
