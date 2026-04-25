import { useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useStreamStore } from '@/shared/store/stream-store';
import { chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { getApiBase } from '@/shared/config/env';
import { clientLogger, newTraceId } from '@/shared/logger';
import type {
  SseAssistantStartEvent,
  SseDeltaEvent,
  SseAssistantDoneEvent,
  SseErrorEvent,
} from '@/entities/message/types';

export function useRegenerateMessage(chatId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const store = useStreamStore();

  const regenerate = useCallback(async () => {
    if (store.status === 'streaming') return;

    const traceId = newTraceId();
    clientLogger.log('info', 'user.regenerate', {
      traceId,
      chatId,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    // Clear stream store and indicate streaming with no optimistic user msg
    store.startStream(chatId, '');
    useStreamStore.setState((s) => { s.optimisticUserMessage = null; });

    try {
      await fetchEventSource(`${getApiBase()}/chats/${chatId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId },
        credentials: 'include',
        signal: controller.signal,
        openWhenHidden: true,

        onopen: async (res) => {
          if (!res.ok) throw new Error(`Regenerate SSE failed: ${res.status}`);
        },

        onmessage: (ev) => {
          switch (ev.event) {
            case 'assistant_start': {
              const d: SseAssistantStartEvent = JSON.parse(ev.data);
              store.setAssistantId(d.id);
              break;
            }
            case 'delta': {
              const d: SseDeltaEvent = JSON.parse(ev.data);
              store.appendDelta(d.text);
              break;
            }
            case 'assistant_done': {
              const d: SseAssistantDoneEvent = JSON.parse(ev.data);
              store.finishStream(d.content, d.aborted);
              setTimeout(() => {
                qc.invalidateQueries({ queryKey: messageKeys.list(chatId) });
                qc.invalidateQueries({ queryKey: chatKeys.list() });
                store.reset();
              }, 1500);
              break;
            }
            case 'error': {
              const d: SseErrorEvent = JSON.parse(ev.data);
              store.setError(d.message);
              break;
            }
          }
        },

        onerror: (err) => {
          store.setError(err instanceof Error ? err.message : 'Regenerate error');
          throw err;
        },

        onclose: () => {
          if (store.status === 'streaming' || store.status === 'stopping') {
            store.finishStream(store.assistantContent, true);
            setTimeout(() => {
              qc.invalidateQueries({ queryKey: messageKeys.list(chatId) });
              qc.invalidateQueries({ queryKey: chatKeys.list() });
              store.reset();
            }, 1500);
          }
        },
      });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        store.setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  }, [chatId, store, qc]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      useStreamStore.setState((s) => { s.status = 'stopping'; });
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return { regenerate, stop, isStreaming: store.status === 'streaming' || store.status === 'stopping' };
}
