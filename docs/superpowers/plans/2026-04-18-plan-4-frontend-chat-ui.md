# Plan 4 — Frontend Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Nova chat UI on top of the Plan 3a foundation and Plan 3b auth. Implement sidebar chat list with search, full chat view with Markdown + Shiki highlighting, streaming composer with Stop, Regenerate, Create/Rename/Delete/Export chat, optimistic SSE streaming via Zustand, smooth autoscroll, mobile-responsive layout, and animated message entry. Reach ≥55 tests total (18+ new).

**Architecture:** Feature-Sliced Design layered over the Plan 3a scaffold. `entities/` owns TanStack Query definitions and TypeScript types. `features/` owns use-case hooks (`model.ts`) and mutations (`api.ts`). `widgets/` composes entities + features into rendered UI blocks. `pages/` are thin route compositions. SSE streaming bypasses TanStack Query and writes directly into a Zustand `streamStore`; after `assistant_done` TQ is invalidated with a 1500 ms delay. `useStreamChat` is the single entry point for the SSE state machine, built on `@microsoft/fetch-event-source` + `AbortController`. Client-side fuzzy search uses `fuse.js` over cached `useChatsQuery` data, debounced 300 ms.

**Tech Stack (all already installed by Plan 3a):** React 18 · TypeScript 5 strict · TanStack Router · TanStack Query 5 · Zustand 5 + immer · shadcn/ui · Tailwind CSS 4 · Motion · react-markdown + remark-gfm · rehype-pretty-code + Shiki · @microsoft/fetch-event-source · ky · lucide-react · fuse.js (new dep) · Vitest 2 · @testing-library/react

---

## Assumptions

- Plan 3a merged: `frontend/` scaffold exists with `shared/api/client.ts`, `shared/store/`, `shared/ui/`, `shared/lib/utils.ts`, `shared/config/env.ts`, `app/providers/`, `app/router.tsx`, Vitest + jsdom configured.
- Plan 3b merged: `features/auth-login/` exists, `pages/auth.page.tsx` exists, `shared/store/auth-store.ts` populated with `user` + `clearUser`, `__root.tsx` has auth redirect guard, `app/providers/` wraps `QueryClientProvider + ThemeProvider`.
- Backend (Plans 1 + 2) is running at `VITE_API_URL`; all chat + message endpoints are available.
- Do NOT rewrite any Plan 3a/3b files — make surgical additions only.

---

## Task 1: Install fuse.js and declare shared types

**Files:**
- Edit: `frontend/package.json` — add `fuse.js`
- Create: `frontend/src/entities/chat/types.ts`
- Create: `frontend/src/entities/message/types.ts`
- Create: `frontend/src/entities/chat/index.ts`
- Create: `frontend/src/entities/message/index.ts`

- [ ] **Step 1.1: Add fuse.js to package.json**

Edit `frontend/package.json` dependencies section, adding after the existing entries:

```json
"fuse.js": "^7.0.0"
```

Then run:
```bash
cd frontend && npm install
```

- [ ] **Step 1.2: Create `frontend/src/entities/chat/types.ts`**

```typescript
export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCreateResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatUpdatePayload {
  title: string;
}
```

- [ ] **Step 1.3: Create `frontend/src/entities/message/types.ts`**

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  aborted: boolean;
  created_at: string;
}

export interface SendMessagePayload {
  content: string;
}

// SSE event shapes
export interface SseUserMessageEvent {
  id: string;
  role: 'user';
  content: string;
  created_at: string;
}

export interface SseAssistantStartEvent {
  id: string;
}

export interface SseDeltaEvent {
  text: string;
}

export interface SseAssistantDoneEvent {
  id: string;
  content: string;
  aborted: boolean;
}

export interface SseErrorEvent {
  code: string;
  message: string;
}

export type SseEventData =
  | { event: 'user_message'; data: SseUserMessageEvent }
  | { event: 'assistant_start'; data: SseAssistantStartEvent }
  | { event: 'delta'; data: SseDeltaEvent }
  | { event: 'assistant_done'; data: SseAssistantDoneEvent }
  | { event: 'error'; data: SseErrorEvent };
```

- [ ] **Step 1.4: Create `frontend/src/entities/chat/index.ts`**

```typescript
export * from './types';
export * from './queries';
```

- [ ] **Step 1.5: Create `frontend/src/entities/message/index.ts`**

```typescript
export * from './types';
export * from './queries';
```

---

## Task 2: TanStack Query hooks for chats and messages

**Files:**
- Create: `frontend/src/entities/chat/queries.ts`
- Create: `frontend/src/entities/message/queries.ts`

- [ ] **Step 2.1: Create `frontend/src/entities/chat/queries.ts`**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Chat } from './types';

export const chatKeys = {
  all: ['chats'] as const,
  list: () => [...chatKeys.all, 'list'] as const,
  detail: (id: string) => [...chatKeys.all, 'detail', id] as const,
};

export function useChatsQuery() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get('chats').json<Chat[]>(),
    staleTime: 30_000,
  });
}

export function useChatQuery(id: string) {
  return useQuery({
    queryKey: chatKeys.detail(id),
    queryFn: () => api.get(`chats/${id}`).json<Chat>(),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useInvalidateChats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: chatKeys.list() });
}
```

- [ ] **Step 2.2: Create `frontend/src/entities/message/queries.ts`**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Message } from './types';

export const messageKeys = {
  all: ['messages'] as const,
  list: (chatId: string) => [...messageKeys.all, chatId] as const,
};

export function useMessagesQuery(chatId: string) {
  return useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => api.get(`chats/${chatId}/messages`).json<Message[]>(),
    enabled: Boolean(chatId),
    staleTime: 0,
  });
}

export function useInvalidateMessages(chatId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: messageKeys.list(chatId) });
}
```

---

## Task 3: Streaming Zustand store

**Files:**
- Create: `frontend/src/shared/store/stream-store.ts`

- [ ] **Step 3.1: Create `frontend/src/shared/store/stream-store.ts`**

This store holds ephemeral in-flight SSE state. It is the single source of truth for the streaming UI — TanStack Query is never written during the stream.

```typescript
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

  // Actions
  startStream: (chatId: string, optimisticContent: string) => void;
  setAssistantId: (id: string) => void;
  appendDelta: (text: string) => void;
  finishStream: (finalContent: string, aborted: boolean) => void;
  setError: (message: string) => void;
  reset: () => void;
}

const INITIAL: Omit<StreamState, keyof Pick<StreamState,
  'startStream' | 'setAssistantId' | 'appendDelta' | 'finishStream' | 'setError' | 'reset'
>> = {
  chatId: null,
  status: 'idle',
  optimisticUserMessage: null,
  assistantMessageId: null,
  assistantContent: '',
  aborted: false,
  error: null,
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
      });
    },

    setAssistantId(id) {
      set((s) => {
        s.assistantMessageId = id;
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
```

---

## Task 4: useStreamChat hook (SSE state machine)

**Files:**
- Create: `frontend/src/features/send-message/model.ts`
- Create: `frontend/src/features/send-message/index.ts`

- [ ] **Step 4.1: Create `frontend/src/features/send-message/model.ts`**

```typescript
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
                // After 1500ms: invalidate queries so sidebar title + message
                // list reflect the DB state (including auto-title update).
                setTimeout(() => {
                  qc.invalidateQueries({ queryKey: messageKeys.list(chatId) });
                  qc.invalidateQueries({ queryKey: chatKeys.list() });
                  store.reset();
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
```

- [ ] **Step 4.2: Create `frontend/src/features/send-message/index.ts`**

```typescript
export { useStreamChat } from './model';
```

---

## Task 5: Chat CRUD features

**Files:**
- Create: `frontend/src/features/create-chat/model.ts`
- Create: `frontend/src/features/create-chat/index.ts`
- Create: `frontend/src/features/rename-chat/model.ts`
- Create: `frontend/src/features/rename-chat/index.ts`
- Create: `frontend/src/features/delete-chat/model.ts`
- Create: `frontend/src/features/delete-chat/index.ts`
- Create: `frontend/src/features/export-chat/model.ts`
- Create: `frontend/src/features/export-chat/index.ts`
- Create: `frontend/src/features/regenerate-message/model.ts`
- Create: `frontend/src/features/regenerate-message/index.ts`

- [ ] **Step 5.1: Create `frontend/src/features/create-chat/model.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import type { Chat } from '@/entities/chat/types';

export function useCreateChat() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post('chats').json<Chat>(),
    onSuccess: (chat) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      router.navigate({ to: '/chats/$chatId', params: { chatId: chat.id } });
    },
  });
}
```

- [ ] **Step 5.2: Create `frontend/src/features/create-chat/index.ts`**

```typescript
export { useCreateChat } from './model';
```

- [ ] **Step 5.3: Create `frontend/src/features/rename-chat/model.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import type { Chat, ChatUpdatePayload } from '@/entities/chat/types';

export function useRenameChat() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`chats/${id}`, { json: { title } satisfies ChatUpdatePayload }).json<Chat>(),

    onMutate: async ({ id, title }) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      qc.setQueryData<Chat[]>(chatKeys.list(), (old) =>
        old?.map((c) => (c.id === id ? { ...c, title } : c)) ?? []
      );
      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(chatKeys.list(), ctx.previous);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
```

- [ ] **Step 5.4: Create `frontend/src/features/rename-chat/index.ts`**

```typescript
export { useRenameChat } from './model';
```

- [ ] **Step 5.5: Create `frontend/src/features/delete-chat/model.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from '@tanstack/react-router';
import { api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';

export function useDeleteChat() {
  const qc = useQueryClient();
  const router = useRouter();

  // Try to read the current chatId param; may not exist on home page.
  let currentChatId: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const params = useParams({ from: '/chats/$chatId' });
    currentChatId = params.chatId;
  } catch {
    currentChatId = undefined;
  }

  return useMutation({
    mutationFn: (id: string) => api.delete(`chats/${id}`),

    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.removeQueries({ queryKey: chatKeys.detail(id) });
      if (currentChatId === id) {
        router.navigate({ to: '/' });
      }
    },
  });
}
```

- [ ] **Step 5.6: Create `frontend/src/features/delete-chat/index.ts`**

```typescript
export { useDeleteChat } from './model';
```

- [ ] **Step 5.7: Create `frontend/src/features/export-chat/model.ts`**

```typescript
import { useCallback } from 'react';
import { api } from '@/shared/api/client';

export function useExportChat() {
  const exportChat = useCallback(async (id: string, title: string) => {
    const blob = await api.get(`chats/${id}/export`).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9\-_ ]/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  return { exportChat };
}
```

- [ ] **Step 5.8: Create `frontend/src/features/export-chat/index.ts`**

```typescript
export { useExportChat } from './model';
```

- [ ] **Step 5.9: Create `frontend/src/features/regenerate-message/model.ts`**

```typescript
import { useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useStreamStore } from '@/shared/store/stream-store';
import { chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { getApiBase } from '@/shared/config/env';
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

    const controller = new AbortController();
    abortRef.current = controller;

    // Clear stream store and indicate streaming with no optimistic user msg
    store.startStream(chatId, '');
    useStreamStore.setState((s) => { s.optimisticUserMessage = null; });

    try {
      await fetchEventSource(`${getApiBase()}/chats/${chatId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
```

- [ ] **Step 5.10: Create `frontend/src/features/regenerate-message/index.ts`**

```typescript
export { useRegenerateMessage } from './model';
```

---

## Task 6: Client-side search feature

**Files:**
- Create: `frontend/src/features/search-chats/model.ts`
- Create: `frontend/src/features/search-chats/index.ts`

- [ ] **Step 6.1: Create `frontend/src/features/search-chats/model.ts`**

```typescript
import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useChatsQuery } from '@/entities/chat/queries';
import type { Chat } from '@/entities/chat/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearchChats() {
  const { data: chats = [] } = useChatsQuery();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const fuse = useMemo(
    () =>
      new Fuse<Chat>(chats, {
        keys: ['title'],
        threshold: 0.4,
        includeScore: true,
      }),
    [chats]
  );

  const results: Chat[] = useMemo(() => {
    if (!debouncedQuery.trim()) return chats;
    return fuse.search(debouncedQuery).map((r) => r.item);
  }, [debouncedQuery, fuse, chats]);

  const clearQuery = useCallback(() => setQuery(''), []);

  return { query, setQuery, results, clearQuery, isFiltering: Boolean(debouncedQuery.trim()) };
}
```

- [ ] **Step 6.2: Create `frontend/src/features/search-chats/index.ts`**

```typescript
export { useSearchChats } from './model';
```

---

## Task 7: Shared hooks — useAutoScroll and useClipboard

**Files:**
- Create: `frontend/src/shared/hooks/use-auto-scroll.ts`
- Edit: `frontend/src/shared/hooks/use-clipboard.ts` — create if not present

- [ ] **Step 7.1: Create `frontend/src/shared/hooks/use-auto-scroll.ts`**

```typescript
import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns a ref to attach to the bottom sentinel element.
 * Scrolls the container to the sentinel when `deps` change,
 * but ONLY if the sentinel is already near the viewport (user hasn't
 * scrolled up). Uses IntersectionObserver to track visibility.
 */
export function useAutoScroll(deps: unknown[]) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        nearBottomRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if ((nearBottomRef.current || force) && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Scroll whenever deps change (new delta, new message)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToBottom(); }, deps);

  return { anchorRef, scrollToBottom };
}
```

- [ ] **Step 7.2: Create `frontend/src/shared/hooks/use-clipboard.ts`**

If this file already exists from Plan 3b, skip creation and verify it exports `useCopyToClipboard`. Otherwise create:

```typescript
import { useState, useCallback } from 'react';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelay);
      } catch {
        // fallback: exec command for older Safari
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelay);
      }
    },
    [resetDelay]
  );

  return { copy, copied };
}
```

---

## Task 8: Markdown message renderer

**Files:**
- Create: `frontend/src/shared/ui/markdown-content.tsx`
- Edit: `frontend/src/styles/globals.css` — add streaming cursor animation

- [ ] **Step 8.1: Create `frontend/src/shared/ui/markdown-content.tsx`**

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';

interface MarkdownContentProps {
  content: string;
  /** Append a blinking cursor at the end (for in-flight streaming) */
  streaming?: boolean;
}

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const code = String(children).trimEnd();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="relative group">
      <button
        onClick={() => copy(code)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                   rounded p-1 bg-muted hover:bg-muted/80"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className={className}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, streaming }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypePrettyCode,
            {
              theme: {
                dark: 'github-dark',
                light: 'github-light',
              },
              keepBackground: true,
            },
          ],
        ]}
        components={{
          // Override pre to inject the copy button wrapper
          pre: ({ children, ...props }) => (
            <CodeBlock {...props}>{children}</CodeBlock>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span
          className="inline-block w-[0.5ch] h-[1.1em] bg-current align-text-bottom ml-px
                     animate-[blink_1s_step-end_infinite]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: Add streaming cursor keyframe to `frontend/src/styles/globals.css`**

Append inside the existing `@layer base` (or at the end of the file if no such layer):

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

---

## Task 9: Composer widget

**Files:**
- Create: `frontend/src/widgets/composer/composer.tsx`
- Create: `frontend/src/widgets/composer/index.ts`

- [ ] **Step 9.1: Create `frontend/src/widgets/composer/composer.tsx`**

```tsx
import React, { useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const MAX_ROWS = 8;
const MAX_LENGTH = 32_000;

interface ComposerProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Message Nova…',
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState('');

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
    onSend(trimmed);
    setValue('');
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const tooLong = value.length > MAX_LENGTH;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl border bg-background px-4 py-3 shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring',
        disabled && 'opacity-50'
      )}
    >
      <textarea
        ref={textareaRef}
        className={cn(
          'w-full resize-none bg-transparent text-sm leading-6 outline-none',
          'placeholder:text-muted-foreground',
          tooLong && 'text-destructive'
        )}
        placeholder={placeholder}
        rows={1}
        value={value}
        disabled={disabled || isStreaming}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Message input"
        maxLength={MAX_LENGTH + 200} // allow slight over to show warning
      />

      <div className="flex items-center justify-between">
        {tooLong && (
          <span className="text-xs text-destructive">
            {value.length}/{MAX_LENGTH} — message too long
          </span>
        )}
        <span className="flex-1" />

        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={onStop}
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-8 w-8"
            disabled={!value.trim() || disabled || tooLong}
            onClick={handleSend}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2: Create `frontend/src/widgets/composer/index.ts`**

```typescript
export { Composer } from './composer';
```

---

## Task 10: Chat view widget (message list + streaming)

**Files:**
- Create: `frontend/src/widgets/chat-view/message-bubble.tsx`
- Create: `frontend/src/widgets/chat-view/chat-view.tsx`
- Create: `frontend/src/widgets/chat-view/empty-state.tsx`
- Create: `frontend/src/widgets/chat-view/index.ts`

- [ ] **Step 10.1: Create `frontend/src/widgets/chat-view/message-bubble.tsx`**

```tsx
import { motion } from 'motion/react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { useCopyToClipboard } from '@/shared/hooks/use-clipboard';
import { cn } from '@/shared/lib/utils';
import type { Message } from '@/entities/message/types';

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
  showRegenerateButton?: boolean;
}

export function MessageBubble({
  message,
  streaming = false,
  onRegenerate,
  showRegenerateButton = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { copy, copied } = useCopyToClipboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex flex-col gap-1',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[min(85%,680px)] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
          message.aborted && !isUser && 'opacity-70'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} streaming={streaming} />
        )}

        {message.aborted && !isUser && (
          <span className="mt-1 block text-xs text-muted-foreground">
            — Stopped
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => copy(message.content)}
          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy message"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>

        {showRegenerateButton && !isUser && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Regenerate response"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 10.2: Create `frontend/src/widgets/chat-view/empty-state.tsx`**

```tsx
import { Sparkles } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  'Explain async/await in JavaScript in simple terms',
  'Write a Python function to parse a CSV file',
  'What is the difference between REST and GraphQL?',
  'Give me a recipe for chocolate chip cookies',
];

interface EmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Welcome to Nova</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Start a conversation. Ask anything.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-md">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick?.(prompt)}
            className="rounded-xl border bg-muted/50 px-4 py-3 text-left text-sm
                       hover:bg-muted transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10.3: Create `frontend/src/widgets/chat-view/chat-view.tsx`**

```tsx
import React, { useMemo } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useAutoScroll } from '@/shared/hooks/use-auto-scroll';
import { useStreamStore } from '@/shared/store/stream-store';
import { MessageBubble } from './message-bubble';
import { EmptyState } from './empty-state';
import type { Message } from '@/entities/message/types';

interface ChatViewProps {
  messages: Message[];
  onRegenerate?: () => void;
  onExamplePrompt?: (prompt: string) => void;
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
    return <EmptyState onPromptClick={onExamplePrompt} />;
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
              onRegenerate={onRegenerate}
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
```

- [ ] **Step 10.4: Create `frontend/src/widgets/chat-view/index.ts`**

```typescript
export { ChatView } from './chat-view';
export { EmptyState } from './empty-state';
export { MessageBubble } from './message-bubble';
```

---

## Task 11: Sidebar widget

**Files:**
- Create: `frontend/src/widgets/sidebar/chat-list-item.tsx`
- Create: `frontend/src/widgets/sidebar/sidebar.tsx`
- Edit: `frontend/src/widgets/sidebar/index.ts` — replace placeholder export

- [ ] **Step 11.1: Create `frontend/src/widgets/sidebar/chat-list-item.tsx`**

```tsx
import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { MoreHorizontal, Pencil, Trash2, Download, Check, X } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import type { Chat } from '@/entities/chat/types';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, title: string) => void;
}

export function ChatListItem({
  chat,
  isActive,
  onRename,
  onDelete,
  onExport,
}: ChatListItemProps) {
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditTitle(chat.title);
    setEditMode(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const t = editTitle.trim();
    if (t && t !== chat.title) onRename(chat.id, t);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditTitle(chat.title);
    setEditMode(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
        'cursor-pointer'
      )}
    >
      {editMode ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="flex-1 bg-transparent outline-none text-sm"
            maxLength={200}
            autoFocus
          />
          <button onClick={commitEdit} aria-label="Confirm rename">
            <Check className="h-3.5 w-3.5 text-green-500" />
          </button>
          <button onClick={cancelEdit} aria-label="Cancel rename">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <Link
            to="/chats/$chatId"
            params={{ chatId: chat.id }}
            className="flex-1 truncate"
          >
            {chat.title}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5
                           hover:bg-background/80"
                onClick={(e) => e.preventDefault()}
                aria-label="Chat options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={startEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(chat.id, chat.title)}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(chat.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 11.2: Create `frontend/src/widgets/sidebar/sidebar.tsx`**

```tsx
import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useParams } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { ChatListItem } from './chat-list-item';
import { useSearchChats } from '@/features/search-chats';
import { useCreateChat } from '@/features/create-chat';
import { useRenameChat } from '@/features/rename-chat';
import { useDeleteChat } from '@/features/delete-chat';
import { useExportChat } from '@/features/export-chat';

export function Sidebar() {
  const { query, setQuery, results, clearQuery, isFiltering } = useSearchChats();
  const createChat = useCreateChat();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const { exportChat } = useExportChat();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  let currentChatId: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const params = useParams({ from: '/chats/$chatId' });
    currentChatId = params.chatId;
  } catch {
    currentChatId = undefined;
  }

  return (
    <nav className="flex h-full flex-col gap-2 px-2 py-3">
      {/* New chat button */}
      <Button
        onClick={() => createChat.mutate()}
        disabled={createChat.isPending}
        className="w-full justify-start gap-2"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        New chat
      </Button>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 pr-8 h-8 text-sm"
          placeholder="Search chats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFiltering && (
          <button
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {results.length === 0 && isFiltering && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No chats found</p>
        )}
        {results.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === currentChatId}
            onRename={(id, title) => renameChat.mutate({ id, title })}
            onDelete={(id) => setDeleteTarget({ id, title: chat.title })}
            onExport={exportChat}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted along with all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteChat.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
```

- [ ] **Step 11.3: Edit `frontend/src/widgets/sidebar/index.ts`**

Replace the placeholder export with:

```typescript
export { Sidebar } from './sidebar';
```

- [ ] **Step 11.4: Add missing shadcn/ui primitives**

Create `frontend/src/shared/ui/dropdown-menu.tsx` with a minimal Radix DropdownMenu wrapper:

```tsx
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/shared/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'transition-colors focus:bg-accent focus:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
```

Create `frontend/src/shared/ui/alert-dialog.tsx`:

```tsx
import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/shared/lib/utils';
import { buttonVariants } from '@/shared/ui/button';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
        'gap-4 border bg-background p-6 shadow-lg duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        'sm:rounded-lg',
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
```

Add Radix deps to `frontend/package.json` (if not already present — Plan 3a may not have included these):

```json
"@radix-ui/react-dropdown-menu": "^2.1.2",
"@radix-ui/react-alert-dialog": "^1.1.2"
```

Run `npm install` from `frontend/`.

---

## Task 12: Pages — home (/) and chat (/chats/$chatId)

**Files:**
- Edit: `frontend/src/pages/index.tsx` — replace welcome stub with working home page
- Create: `frontend/src/pages/chats.$chatId.tsx`
- Edit: `frontend/src/shared/config/env.ts` — add `getApiBase` export if missing

- [ ] **Step 12.1: Verify `frontend/src/shared/config/env.ts` exports `getApiBase`**

Read the file. If it already exports a `getApiBase` function, skip. Otherwise, add:

```typescript
export function getApiBase(): string {
  return import.meta.env.VITE_API_URL as string ?? 'http://localhost:8080/api/v1';
}
```

- [ ] **Step 12.2: Edit `frontend/src/pages/index.tsx`**

Replace the entire contents (the "Nova is ready" stub from Plan 3a) with the home page that supports sending a first message (creating a chat on the fly):

```tsx
import { useState, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import { useQueryClient } from '@tanstack/react-query';
import { Composer } from '@/widgets/composer';
import { EmptyState } from '@/widgets/chat-view';
import { useStreamStore } from '@/shared/store/stream-store';
import type { Chat } from '@/entities/chat/types';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const stream = useStreamStore();

  const handleSend = useCallback(
    async (content: string) => {
      setCreating(true);
      try {
        const chat = await api.post('chats').json<Chat>();
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        // Navigate first, then the chat page will trigger the send
        await router.navigate({
          to: '/chats/$chatId',
          params: { chatId: chat.id },
          state: { pendingMessage: content },
        });
      } finally {
        setCreating(false);
      }
    },
    [router, qc]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <EmptyState onPromptClick={(p) => handleSend(p)} />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pb-[env(safe-area-inset-bottom,0.5rem)]">
        <Composer
          onSend={handleSend}
          disabled={creating || stream.status === 'streaming'}
          placeholder="Start a new conversation…"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 12.3: Create `frontend/src/pages/chats.$chatId.tsx`**

```tsx
import { useEffect } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMessagesQuery } from '@/entities/message/queries';
import { ChatView } from '@/widgets/chat-view';
import { Composer } from '@/widgets/composer';
import { useStreamChat } from '@/features/send-message';
import { useRegenerateMessage } from '@/features/regenerate-message';
import { Skeleton } from '@/shared/ui/skeleton';

export const Route = createFileRoute('/chats/$chatId')({
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const router = useRouter();
  // @ts-expect-error TanStack Router state typing
  const pendingMessage: string | undefined = router.state.location.state?.pendingMessage;

  const { data: messages = [], isLoading } = useMessagesQuery(chatId);
  const { send, stop, isStreaming, status } = useStreamChat(chatId);
  const { regenerate } = useRegenerateMessage(chatId);

  // Send pending message from home page navigation
  useEffect(() => {
    if (pendingMessage && !isStreaming) {
      send(pendingMessage);
      // Clear state to prevent re-send on HMR / re-render
      router.navigate({
        to: '/chats/$chatId',
        params: { chatId },
        replace: true,
        state: {},
      });
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className={`h-12 ${i % 2 === 0 ? 'w-3/4 self-end' : 'w-2/3'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatView
        messages={messages}
        onRegenerate={regenerate}
        onExamplePrompt={(p) => send(p)}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pb-[env(safe-area-inset-bottom,0.5rem)]">
        <Composer
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={status === 'error'}
        />
        {status === 'error' && (
          <p className="mt-1 text-xs text-destructive text-center">
            Failed to send message. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 12.4: Add Skeleton to shared/ui if missing**

If `frontend/src/shared/ui/skeleton.tsx` does not exist (check first), create it:

```tsx
import { cn } from '@/shared/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
```

---

## Task 13: Wire Sidebar into AppShell

**Files:**
- Edit: `frontend/src/pages/__root.tsx` — replace `SidebarPlaceholder` with `Sidebar`

- [ ] **Step 13.1: Edit `frontend/src/pages/__root.tsx`**

Read the current `__root.tsx`. Locate the import and usage of `SidebarPlaceholder` (or equivalent). Replace the import with `Sidebar` from `@/widgets/sidebar` and swap the JSX. All other layout/auth logic remains untouched.

Change:
```tsx
import { SidebarPlaceholder } from '@/widgets/sidebar/sidebar-placeholder';
// ...
<SidebarPlaceholder />
```

To:
```tsx
import { Sidebar } from '@/widgets/sidebar';
// ...
<Sidebar />
```

(If the import path or component name differs slightly in your Plan 3b output, match accordingly — this is a surgical swap.)

---

## Task 14: Topbar — show current chat title

**Files:**
- Edit: `frontend/src/widgets/topbar/topbar.tsx` — display active chat title

- [ ] **Step 14.1: Edit `frontend/src/widgets/topbar/topbar.tsx`**

Read the current file. Add a `chatTitle` prop (or use `useChatQuery` internally). Example surgical addition — add inside the topbar component:

```tsx
import { useChatQuery } from '@/entities/chat/queries';
import { useParams } from '@tanstack/react-router';

// Inside the Topbar component (read current structure and insert appropriately):
let title = 'Nova';
try {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { chatId } = useParams({ from: '/chats/$chatId' });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data } = useChatQuery(chatId);
  if (data?.title) title = data.title;
} catch {
  // Not on a chat route
}
```

Display `title` in the topbar heading element where the current static text or empty content is.

---

## Task 15: Tests — unit + component

**Files:**
- Create: `frontend/src/features/send-message/__tests__/stream-store.test.ts`
- Create: `frontend/src/features/search-chats/__tests__/use-search-chats.test.ts`
- Create: `frontend/src/widgets/composer/__tests__/composer.test.tsx`
- Create: `frontend/src/widgets/chat-view/__tests__/chat-view.test.tsx`
- Create: `frontend/src/widgets/sidebar/__tests__/sidebar.test.tsx`
- Create: `frontend/src/shared/hooks/__tests__/use-auto-scroll.test.ts`
- Create: `frontend/src/test/sse-factory.ts`

- [ ] **Step 15.1: Create `frontend/src/test/sse-factory.ts`**

A fake `fetchEventSource` implementation for tests:

```typescript
import type { EventSourceMessage } from '@microsoft/fetch-event-source';

export interface FakeSseScript {
  event: string;
  data: unknown;
}

/**
 * Creates a jest/vitest-compatible mock for fetchEventSource that
 * plays through `script` synchronously (or with microtask delays).
 */
export function createFakeEventSource(script: FakeSseScript[]) {
  return async (
    _url: string,
    opts: {
      onopen?: (r: Response) => Promise<void>;
      onmessage?: (ev: EventSourceMessage) => void;
      onerror?: (err: unknown) => void;
      onclose?: () => void;
    }
  ) => {
    await opts.onopen?.(new Response(null, { status: 200 }));
    for (const item of script) {
      opts.onmessage?.({
        event: item.event,
        data: JSON.stringify(item.data),
        id: '',
        retry: undefined,
      });
      await Promise.resolve(); // yield to allow state updates
    }
    opts.onclose?.();
  };
}
```

- [ ] **Step 15.2: Create `frontend/src/features/send-message/__tests__/stream-store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useStreamStore } from '@/shared/store/stream-store';

describe('stream-store', () => {
  beforeEach(() => {
    useStreamStore.getState().reset();
  });

  it('starts in idle state', () => {
    expect(useStreamStore.getState().status).toBe('idle');
  });

  it('startStream sets chatId and optimistic message', () => {
    useStreamStore.getState().startStream('chat-1', 'Hello');
    const state = useStreamStore.getState();
    expect(state.chatId).toBe('chat-1');
    expect(state.status).toBe('streaming');
    expect(state.optimisticUserMessage?.content).toBe('Hello');
  });

  it('appendDelta accumulates content', () => {
    useStreamStore.getState().startStream('chat-1', 'q');
    useStreamStore.getState().appendDelta('Hello ');
    useStreamStore.getState().appendDelta('world');
    expect(useStreamStore.getState().assistantContent).toBe('Hello world');
  });

  it('finishStream transitions to done', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().finishStream('Final answer', false);
    const s = useStreamStore.getState();
    expect(s.status).toBe('done');
    expect(s.assistantContent).toBe('Final answer');
    expect(s.aborted).toBe(false);
  });

  it('setError transitions to error', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().setError('LLM_UNAVAILABLE');
    expect(useStreamStore.getState().status).toBe('error');
    expect(useStreamStore.getState().error).toBe('LLM_UNAVAILABLE');
  });

  it('reset returns to idle', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().reset();
    expect(useStreamStore.getState().status).toBe('idle');
    expect(useStreamStore.getState().chatId).toBeNull();
  });
});
```

- [ ] **Step 15.3: Create `frontend/src/features/search-chats/__tests__/use-search-chats.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchChats } from '../model';
import type { Chat } from '@/entities/chat/types';

// Mock useChatsQuery
vi.mock('@/entities/chat/queries', () => ({
  useChatsQuery: () => ({
    data: [
      { id: '1', title: 'JavaScript basics', created_at: '', updated_at: '' },
      { id: '2', title: 'Python async', created_at: '', updated_at: '' },
      { id: '3', title: 'React patterns', created_at: '', updated_at: '' },
    ] satisfies Chat[],
  }),
}));

describe('useSearchChats', () => {
  it('returns all chats when query is empty', () => {
    const { result } = renderHook(() => useSearchChats());
    expect(result.current.results).toHaveLength(3);
    expect(result.current.isFiltering).toBe(false);
  });

  it('filters chats by title', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSearchChats());
    act(() => { result.current.setQuery('python'); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.results.length).toBeLessThan(3);
    vi.useRealTimers();
  });

  it('clearQuery resets results', () => {
    const { result } = renderHook(() => useSearchChats());
    act(() => { result.current.setQuery('python'); });
    act(() => { result.current.clearQuery(); });
    expect(result.current.query).toBe('');
    expect(result.current.isFiltering).toBe(false);
  });
});
```

- [ ] **Step 15.4: Create `frontend/src/widgets/composer/__tests__/composer.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '../composer';

describe('Composer', () => {
  it('renders textarea and send button', () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.getByLabelText('Message input')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('send button disabled when empty', () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('calls onSend with trimmed content on button click', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, '  Hello world  ');
    await userEvent.click(screen.getByLabelText('Send message'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('calls onSend on Enter, not on Shift+Enter', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    onSend.mockClear();
    await userEvent.type(textarea, 'Line1{Shift>}{Enter}{/Shift}Line2');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows Stop button while streaming', () => {
    render(<Composer onSend={vi.fn()} onStop={vi.fn()} isStreaming />);
    expect(screen.getByLabelText('Stop generation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  });

  it('calls onStop when Stop clicked', async () => {
    const onStop = vi.fn();
    render(<Composer onSend={vi.fn()} onStop={onStop} isStreaming />);
    await userEvent.click(screen.getByLabelText('Stop generation'));
    expect(onStop).toHaveBeenCalled();
  });

  it('clears textarea after send', async () => {
    render(<Composer onSend={vi.fn()} />);
    const textarea = screen.getByLabelText('Message input');
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(screen.getByLabelText('Send message'));
    expect(textarea).toHaveValue('');
  });
});
```

- [ ] **Step 15.5: Create `frontend/src/widgets/chat-view/__tests__/chat-view.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatView } from '../chat-view';
import type { Message } from '@/entities/message/types';

// Stub IntersectionObserver
const observeMock = vi.fn();
const disconnectMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation((cb) => ({
    observe: observeMock,
    disconnect: disconnectMock,
    unobserve: vi.fn(),
  })));
});

const userMsg: Message = {
  id: 'u1', chat_id: 'c1', role: 'user',
  content: 'Hello', aborted: false, created_at: new Date().toISOString(),
};
const assistantMsg: Message = {
  id: 'a1', chat_id: 'c1', role: 'assistant',
  content: 'Hi there', aborted: false, created_at: new Date().toISOString(),
};

describe('ChatView', () => {
  it('shows empty state when no messages', () => {
    render(<ChatView messages={[]} />);
    expect(screen.getByText('Welcome to Nova')).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    render(<ChatView messages={[userMsg, assistantMsg]} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('shows regenerate button on last assistant message', () => {
    render(<ChatView messages={[userMsg, assistantMsg]} onRegenerate={vi.fn()} />);
    // The regen button appears on hover — it's in DOM but opacity-0
    expect(screen.getByLabelText('Regenerate response')).toBeInTheDocument();
  });
});
```

- [ ] **Step 15.6: Create `frontend/src/shared/hooks/__tests__/use-auto-scroll.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoScroll } from '../use-auto-scroll';

const disconnectMock = vi.fn();
const observeMock = vi.fn();
let intersectionCallback: IntersectionObserverCallback;

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation((cb) => {
    intersectionCallback = cb;
    return { observe: observeMock, disconnect: disconnectMock, unobserve: vi.fn() };
  }));
});

describe('useAutoScroll', () => {
  it('returns anchorRef and scrollToBottom', () => {
    const { result } = renderHook(() => useAutoScroll([]));
    expect(result.current.anchorRef).toBeDefined();
    expect(typeof result.current.scrollToBottom).toBe('function');
  });

  it('observes the anchor element on mount', () => {
    renderHook(() => useAutoScroll([]));
    // IntersectionObserver constructor was called
    expect(IntersectionObserver).toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useAutoScroll([]));
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 15.7: Create `frontend/src/widgets/sidebar/__tests__/sidebar.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { Sidebar } from '../sidebar';
import type { Chat } from '@/entities/chat/types';

// Mock hooks
vi.mock('@/features/search-chats', () => ({
  useSearchChats: () => ({
    query: '',
    setQuery: vi.fn(),
    results: [
      { id: 'c1', title: 'Test Chat', created_at: '', updated_at: '' },
    ] as Chat[],
    clearQuery: vi.fn(),
    isFiltering: false,
  }),
}));
vi.mock('@/features/create-chat', () => ({
  useCreateChat: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/rename-chat', () => ({
  useRenameChat: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/delete-chat', () => ({
  useDeleteChat: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/export-chat', () => ({
  useExportChat: () => ({ exportChat: vi.fn() }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Sidebar', () => {
  it('renders New chat button', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByText('New chat')).toBeInTheDocument();
  });

  it('renders chat list item', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByText('Test Chat')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByPlaceholderText('Search chats…')).toBeInTheDocument();
  });
});
```

---

## Task 16: End-to-end smoke test and final package install check

**Files:**
- No new source files — validate existing test suite + install state

- [ ] **Step 16.1: Install any missing Radix peer deps**

```bash
cd frontend && npm install
```

Verify these are in `node_modules`:
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-alert-dialog`
- `fuse.js`
- `date-fns`

If `date-fns` is missing (used in `chat-view.tsx` for date formatting), add it:
```bash
cd frontend && npm install date-fns
```

- [ ] **Step 16.2: TypeScript check**

```bash
cd frontend && npm run typecheck
```

Expected: 0 errors. If errors appear, fix them without changing behaviour. Common issues:
- Missing `@types/` packages → add to devDependencies
- Strict null checks on optional hook params → add `?? undefined` guards
- `motion/react` import alias → check that `motion` package exports `motion/react`; if not, use `import { motion } from 'motion/react'` or `'framer-motion'` equivalent.

- [ ] **Step 16.3: Run full test suite**

```bash
cd frontend && npm test
```

Expected: ≥55 tests passing (18+ from this plan + ≥37 from Plans 3a + 3b).

If any test fails:
1. Check for missing mocks (TanStack Router's `useParams` inside non-route components — mock with `vi.mock('@tanstack/react-router', ...)`)
2. Check for missing `@testing-library/user-event` — install if absent: `npm install -D @testing-library/user-event`

- [ ] **Step 16.4: Lint check**

```bash
cd frontend && npm run lint
```

Fix any errors. Common: unused imports in generated UI code, `react-hooks/exhaustive-deps` warnings on intentional single-run effects (suppress with eslint-disable comment at site, not globally).

- [ ] **Step 16.5: Manual smoke test**

```bash
cd frontend && npm run dev
```

Verify:
1. `/` loads with welcome screen + example prompts
2. Click "New chat" → navigates to `/chats/<id>`
3. Type a message + Enter → optimistic bubble appears, streaming cursor blinks, response streams in
4. Stop button aborts; partial response shown with "— Stopped"
5. Regenerate button appears under last assistant message; click → new stream starts
6. Sidebar: search filters chats; rename via context menu updates title optimistically; delete shows confirm dialog
7. Export downloads a `.md` file
8. Toggle dark/light theme → no flash, Shiki code blocks switch theme

---

## Spec Coverage Table

| Spec section | Feature | Covered by Task |
|---|---|---|
| §5 Frontend stack | All deps installed | Plan 3a (pre-req) |
| §5 SSE UX — optimistic user message | `startStream` adds optimistic bubble | Task 3, 4 |
| §5 SSE UX — delta appending | `appendDelta` + `MarkdownContent streaming` | Task 3, 4, 8 |
| §5 SSE UX — blinking cursor | CSS `blink` keyframe + `streaming` prop | Task 8 |
| §5 SSE UX — autoscroll (IntersectionObserver) | `useAutoScroll` | Task 7 |
| §5 SSE UX — Stop (AbortController) | `useStreamChat.stop()` + `useRegenerateMessage.stop()` | Task 4, 5 |
| §5 SSE UX — title_update via invalidate + 1500ms delay | setTimeout invalidate after `assistant_done` | Task 4 |
| §4 A — Auto-title | Client invalidates chats after 1500ms; backend updates title | Task 4, 5 |
| §4 B — Regenerate | `useRegenerateMessage` + button in `MessageBubble` | Task 5, 10 |
| §4 D — Client search | `useSearchChats` + fuse.js | Task 6, 11 |
| §4 G — Export | `useExportChat` + GET /chats/{id}/export | Task 5, 11 |
| §6 SSE events: user_message, assistant_start, delta, assistant_done, error | Full switch in `useStreamChat` | Task 4 |
| §6 aborted flag | Shown as "— Stopped" in bubble | Task 10 |
| Mobile: safe-area padding | `pb-[env(safe-area-inset-bottom)]` on composer | Task 12 |
| Mobile: drawer sidebar | Provided by Plan 3a `ui-store.ts` + topbar hamburger | Plan 3a |
| Markdown + GFM | `react-markdown` + `remark-gfm` | Task 8 |
| Shiki code highlighting | `rehype-pretty-code` github-light/dark | Task 8 |
| Copy button on messages | `useCopyToClipboard` in `MessageBubble` | Task 7, 10 |
| Date dividers | `isSameDay` grouping in `ChatView` | Task 10 |
| Delete confirm dialog | `AlertDialog` in `Sidebar` | Task 11 |
| Rename optimistic update | `useRenameChat` onMutate | Task 5 |
| Max message length guard | `MAX_LENGTH` check in `Composer` | Task 9 |

---

## Self-Review

**Architecture decisions:**

1. **SSE state lives in Zustand, not TanStack Query.** TQ is optimised for request/response; writing thousands of delta mutations into it per stream would cause excessive re-renders. Zustand + immer gives O(1) appends and a single subscription per streaming component.

2. **`useParams` try/catch in non-route components.** `useDeleteChat` and `Sidebar` need to know the current chatId to conditionally navigate on deletion. TanStack Router throws if `from` doesn't match. The try/catch is the idiomatic escape hatch here.

3. **1500 ms invalidate delay for title.** The backend generates titles in a fire-and-forget `asyncio.create_task`. The 1500 ms delay gives it time to write to DB before the client refetches `useChatsQuery`. This is explicitly called out in the spec (§5 "Title update not via SSE").

4. **`date-fns` for date dividers.** Lightweight, tree-shakable, and used only for `isToday` / `isYesterday` / `isSameDay` / `format`. No full moment.js overhead.

5. **`fuse.js` over InstantSearch.** Client-side fuzzy search on `title` only. The chat list is bounded (~hundreds), so Fuse is more than sufficient and needs no server round-trips.

**Risks:**

1. **`rehype-pretty-code` SSR / Shiki WASM.** In a Vite SPA (no SSR) this is fine, but Shiki initialises lazily and the first code block render may be slow. If this is a problem, pre-warm Shiki in a `useEffect` on app mount.

2. **`motion/react` import path.** The `motion` package v11 exports via `motion/react` sub-path. If the version installed by Plan 3a is older (v10 or Framer Motion v10), the import path differs. Verify with `npm list motion` and adjust imports if needed.

3. **`useParams` inside `Sidebar` / `useDeleteChat` outside a route component.** If TanStack Router's `useParams` throws when used outside the matching route (not just returns undefined), the try/catch is essential. Test this during smoke testing step.

---

## Execution Footer

```
Conventional commit: feat(frontend): add full chat UI — sidebar, chat view, streaming, CRUD features
Branch: feat/plan-4-frontend-chat-ui
Prereqs: Plan 3a merged, Plan 3b merged, Backend (Plans 1+2) running
Test target: ≥55 total (18+ new from this plan)
Build check: npm run typecheck && npm run lint && npm test
```
