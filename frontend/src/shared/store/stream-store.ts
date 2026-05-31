import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type StreamStatus = 'idle' | 'streaming' | 'stopping' | 'done' | 'error';

export interface StreamState {
  chatId: string | null;
  status: StreamStatus;
  // Optimistic user message (shown immediately before SSE user_message arrives)
  optimisticUserMessage: {
    id: string;
    content: string;
    created_at: string;
  } | null;
  // In-flight assistant message
  assistantMessageId: string | null;
  assistantContent: string;
  aborted: boolean;
  error: string | null;
  // Remembered for the Retry button after an error.
  lastUserContent: string | null;

  // Actions
  startStream: (chatId: string, optimisticContent: string) => void;
  setAssistantId: (id: string) => void;
  replaceOptimisticUserId: (realId: string) => void;
  appendDelta: (text: string) => void;
  finishStream: (finalContent: string, aborted: boolean) => void;
  setStopping: () => void;
  setError: (message: string) => void;
  reset: () => void;
}

const INITIAL: Omit<StreamState, keyof Pick<StreamState,
  'startStream' | 'setAssistantId' | 'replaceOptimisticUserId' | 'appendDelta' | 'finishStream' | 'setStopping' | 'setError' | 'reset'
>> = {
  chatId: null,
  status: 'idle',
  optimisticUserMessage: null,
  assistantMessageId: null,
  assistantContent: '',
  aborted: false,
  error: null,
  lastUserContent: null,
};

export const useStreamStore = create<StreamState>()(
  immer((set) => ({
    ...INITIAL,

    startStream(chatId, optimisticContent) {
      set((s) => {
        s.chatId = chatId;
        s.status = 'streaming';
        s.optimisticUserMessage = {
          id: `optimistic-${Date.now()}`,
          content: optimisticContent,
          created_at: new Date().toISOString(),
        };
        s.assistantMessageId = null;
        s.assistantContent = '';
        s.aborted = false;
        s.error = null;
        // Empty string is the "regenerate" sentinel from the regenerate
        // hook — don't overwrite a real prior message with it.
        if (optimisticContent) s.lastUserContent = optimisticContent;
      });
    },

    setAssistantId(id) {
      set((s) => {
        s.assistantMessageId = id;
      });
    },

    replaceOptimisticUserId(realId) {
      set((s) => {
        if (s.optimisticUserMessage) s.optimisticUserMessage.id = realId;
      });
    },

    appendDelta(text) {
      set((s) => {
        s.assistantContent += text;
      });
    },

    finishStream(finalContent, aborted) {
      set((s) => {
        s.status = 'done';
        s.assistantContent = finalContent;
        s.aborted = aborted;
      });
    },

    setStopping() {
      set((s) => {
        if (s.status === 'streaming') s.status = 'stopping';
      });
    },

    setError(message) {
      set((s) => {
        s.status = 'error';
        s.error = message;
      });
    },

    reset() {
      set((s) => {
        Object.assign(s, INITIAL);
      });
    },
  }))
);

// Module-level singleton: tracks the in-flight stream's AbortController so
// a *new* stream can cancel the previous one when the user navigates between
// chats mid-stream. Kept outside zustand state because AbortController is not
// serializable and we don't want it triggering re-renders.
let _activeController: AbortController | null = null;

export function setActiveController(c: AbortController | null): void {
  _activeController = c;
}

export function getActiveController(): AbortController | null {
  return _activeController;
}

export function abortActiveStream(reason: string = 'superseded'): void {
  if (_activeController) {
    try {
      _activeController.abort(reason);
    } catch {
      /* noop */
    }
    _activeController = null;
  }
}
