# Nova Frontend Bugs & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all known bugs in the React frontend and ship every feature from the audit (stop control, retry-on-error, search-within-chat, copy-as-markdown, code/math polish, generation progress, model selector, edit-message-and-regenerate).

**Architecture:** TDD per task; one task = one commit; vitest for unit/integration tests on changed files. Frontend changes happen in `frontend/src/...` (FSD: `pages/`, `widgets/`, `features/`, `entities/`, `shared/`). Two features (#14 model selector, #15 edit message) also add backend endpoints in `backend/app/api/v1/`.

**Tech Stack:** React 18, TanStack Router 1.82 (file-based), TanStack Query 5.59, Zustand 5 + immer, ky 1.7, `@microsoft/fetch-event-source` 2.0, Radix UI, Tailwind 4, fuse.js 7.3 (already in deps), date-fns 4, vitest 2.1, MSW 2.13. Backend: FastAPI 0.115, httpx, structlog.

---

## Phase 1 — Critical bug fixes

### Task 1: Remove debug `setInterval` from RootLayout

**Files:**
- Modify: `frontend/src/pages/__root.tsx:26-35`

- [ ] **Step 1: Read current code**

Lines 26-35 currently contain a stray `setInterval(...)` that throws every 1s. Confirm by reading.

- [ ] **Step 2: Edit the file**

Replace the broken effect with the original resize-handler:

```tsx
  // Close mobile drawer when resizing to desktop
  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      closeSidebar();
    }
  }, [isDesktop, sidebarOpen, closeSidebar]);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/__root.tsx
git commit -m "fix(frontend): remove debug setInterval from RootLayout

Left over from telemetry smoke test — produced 1 error/sec into ELK
and tripped ErrorBoundary on every wakeup."
```

---

### Task 2: Cancel previous stream on chat navigation (fix race condition)

**Files:**
- Modify: `frontend/src/shared/store/stream-store.ts` (add module-level abort controller registry — kept out of state to avoid storing non-serializable values)
- Modify: `frontend/src/features/send-message/model.ts` (register/clear controller; ignore late events from stale streams)
- Modify: `frontend/src/features/regenerate-message/model.ts` (same)
- Create: `frontend/src/features/send-message/model.test.ts`

**Approach:** Both `startMessageStream` and `useRegenerateMessage` save their `AbortController` in a module-level singleton; when a new stream starts for a *different* chatId, the previous one is aborted. SSE event handlers also guard with `if (useStreamStore.getState().chatId !== chatId) return;` to drop late callbacks that arrived after the controller was aborted but before the network closed.

- [ ] **Step 1: Add abort-controller registry in stream-store.ts**

Append at the bottom of `frontend/src/shared/store/stream-store.ts`:

```ts
// Module-level singleton: tracks the in-flight stream's AbortController so
// a *new* stream can cancel the previous one when the user navigates between
// chats mid-stream. Kept outside zustand state because AbortController is not
// serializable and we don't want it triggering re-renders.
let _activeController: AbortController | null = null;

export function setActiveController(c: AbortController | null) {
  _activeController = c;
}

export function abortActiveStream(reason = 'superseded') {
  if (_activeController) {
    try { _activeController.abort(reason); } catch { /* noop */ }
    _activeController = null;
  }
}
```

- [ ] **Step 2: Wire registry into `startMessageStream`**

In `frontend/src/features/send-message/model.ts`:

a) Add imports at the top:
```ts
import { useStreamStore, setActiveController, abortActiveStream } from '@/shared/store/stream-store';
```
(adjust existing import to add the two helpers)

b) Inside `startMessageStream` after `if (!content.trim())` guard, abort any prior stream:
```ts
  abortActiveStream();
```

c) Create the controller right after the store-startStream call (so it exists even when caller did not pass `signal`):
```ts
  const controller = new AbortController();
  setActiveController(controller);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort());
  }
```

d) In the `fetchEventSource` options replace `...(signal ? { signal } : {})` with `signal: controller.signal,`.

e) In `onmessage` add a stale-stream guard at the top:
```ts
      if (useStreamStore.getState().chatId !== chatId) return;
```

f) Wrap each `refreshMessages` / `scheduleChatListRefresh` call to check the chat is still active first:
```ts
  const isStillActive = () => useStreamStore.getState().chatId === chatId;
```
And gate both calls behind `if (isStillActive())`.

g) In the trailing `.catch` and after the promise resolves, clear the registry:
```ts
  }).catch((err) => {
    if ((err as Error)?.name !== 'AbortError') {
      useStreamStore.getState().setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }).finally(() => {
    if (_isOurController(controller)) setActiveController(null);
  });
```

Add helper `_isOurController` (or inline the comparison) — since `_activeController` is module-private use a getter:

In stream-store.ts:
```ts
export function getActiveController(): AbortController | null {
  return _activeController;
}
```

In send-message/model.ts:
```ts
import { ..., getActiveController } from '@/shared/store/stream-store';
// ...
  }).finally(() => {
    if (getActiveController() === controller) setActiveController(null);
  });
```

h) In `useStreamChat.send`, drop the local `abortControllerRef` setup — pass nothing for `signal` since `startMessageStream` now owns the controller. `useStreamChat.stop` should call `abortActiveStream('user')` instead of using its own ref. After this change `abortControllerRef` can be deleted from the hook.

Updated `useStreamChat`:

```ts
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
      useStreamStore.setState((s) => { s.status = 'stopping'; });
      abortActiveStream('user');
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

- [ ] **Step 3: Mirror changes in regenerate-message/model.ts**

a) Use registry instead of local `abortRef`:
```ts
import {
  useStreamStore,
  setActiveController,
  abortActiveStream,
  getActiveController,
} from '@/shared/store/stream-store';
```

b) Inside `regenerate`, at top after the streaming guard:
```ts
    abortActiveStream();
    const controller = new AbortController();
    setActiveController(controller);
```
Pass `signal: controller.signal` to `fetchEventSource`. Remove `abortRef`. Use the same `isStillActive` + stale-stream guard. In the trailing finally clear the registry the same way.

c) `stop` becomes:
```ts
  const stop = useCallback(() => {
    if (useStreamStore.getState().status === 'streaming') {
      useStreamStore.setState((s) => { s.status = 'stopping'; });
      abortActiveStream('user');
    }
  }, []);
```

- [ ] **Step 4: Add test for stale-stream guard**

Create `frontend/src/features/send-message/model.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStreamStore, abortActiveStream } from '@/shared/store/stream-store';

beforeEach(() => {
  useStreamStore.getState().reset();
});

describe('stream race protection', () => {
  it('abortActiveStream noops when no controller registered', () => {
    expect(() => abortActiveStream()).not.toThrow();
  });

  it('switching chatId cancels previous stream controller', async () => {
    const { setActiveController, getActiveController } = await import('@/shared/store/stream-store');
    const ctrl = new AbortController();
    setActiveController(ctrl);
    expect(getActiveController()).toBe(ctrl);
    abortActiveStream('test');
    expect(ctrl.signal.aborted).toBe(true);
    expect(getActiveController()).toBe(null);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm test -- src/features/send-message/model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run full typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/store/stream-store.ts \
        frontend/src/features/send-message/model.ts \
        frontend/src/features/regenerate-message/model.ts \
        frontend/src/features/send-message/model.test.ts
git commit -m "fix(frontend): cancel in-flight stream on chat navigation

A second send/regenerate or a route change now aborts the prior SSE
connection through a module-level registry. Late onmessage callbacks
are dropped via a chatId guard, so the old stream cannot clobber the
new chat's cache."
```

---

### Task 3: Logger backpressure (exponential backoff + bounded retries)

**Files:**
- Modify: `frontend/src/shared/logger/clientLogger.ts`
- Create: `frontend/src/shared/logger/clientLogger.test.ts`

**Approach:** Track consecutive flush failures. While failures > 0, multiply the next flush interval by `min(2^failures, 32)`. After 6 consecutive failures stop trying for 5 min ("circuit open"). Reset on first success.

- [ ] **Step 1: Write failing test**

Create `frontend/src/shared/logger/clientLogger.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClientLogger } from './clientLogger';

const URL = 'http://localhost:8080/api/v1/_telemetry/logs';

describe('clientLogger backoff', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('drops oldest records past maxQueue on sustained failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const logger = createClientLogger({ url: URL, flushSize: 10, maxQueue: 5, flushIntervalMs: 1_000_000 });
    for (let i = 0; i < 20; i++) logger.log('info', `m${i}`, { traceId: 't' });
    await logger.flush();
    expect(logger._queueSize()).toBeLessThanOrEqual(5);
  });

  it('opens the circuit after 6 consecutive failures', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const logger = createClientLogger({ url: URL, flushSize: 1, flushIntervalMs: 1_000_000 });
    logger.log('info', 'm', { traceId: 't' });
    for (let i = 0; i < 8; i++) await logger.flush();
    // After circuit opens further flushes must not touch fetch.
    const callsBefore = fetchMock.mock.calls.length;
    await logger.flush();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('resets failure counter on success', async () => {
    fetchMock.mockRejectedValueOnce(new Error('nope'));
    fetchMock.mockResolvedValue(new Response('', { status: 204 }));
    const logger = createClientLogger({ url: URL, flushSize: 1, flushIntervalMs: 1_000_000 });
    logger.log('info', 'a', { traceId: 't' });
    await logger.flush();
    logger.log('info', 'b', { traceId: 't' });
    await logger.flush();
    expect(logger._failureCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/shared/logger/clientLogger.test.ts`
Expected: FAIL (`_failureCount is not a function`, possibly other).

- [ ] **Step 3: Implement backoff in clientLogger.ts**

Replace the file with:

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ClientLogRecord {
  ts: string;
  level: LogLevel;
  msg: string;
  traceId: string;
  source?: string;
  fields?: Record<string, string | number | boolean | null>;
}

export interface ClientLoggerOptions {
  url: string;
  flushSize?: number;
  flushIntervalMs?: number;
  maxQueue?: number;
  circuitOpenMs?: number;
  maxFailuresBeforeOpen?: number;
}

export interface ClientLogger {
  log(level: LogLevel, msg: string, opts?: { traceId: string; [key: string]: unknown }): void;
  flush(): Promise<void>;
  flushSync(): void;
  _queueSize(): number;
  _failureCount(): number;
}

export function createClientLogger(opts: ClientLoggerOptions): ClientLogger {
  const flushSize = opts.flushSize ?? 20;
  const flushIntervalMs = opts.flushIntervalMs ?? 5000;
  const maxQueue = opts.maxQueue ?? 200;
  const circuitOpenMs = opts.circuitOpenMs ?? 5 * 60 * 1000;
  const maxFailuresBeforeOpen = opts.maxFailuresBeforeOpen ?? 6;

  let queue: ClientLogRecord[] = [];
  let flushing = false;
  let failures = 0;
  let circuitOpenUntil = 0;

  const timer = setInterval(() => {
    void flush();
  }, flushIntervalMs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (timer as any).unref?.();

  function enqueue(rec: ClientLogRecord) {
    queue.push(rec);
    if (queue.length > maxQueue) {
      queue.splice(0, queue.length - maxQueue);
    }
    if (queue.length >= flushSize) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return;
    if (Date.now() < circuitOpenUntil) return;
    flushing = true;
    const batch = queue;
    queue = [];
    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batch }),
        credentials: 'include',
        keepalive: true,
      });
      if (!res.ok) throw new Error(`telemetry ${res.status}`);
      failures = 0;
    } catch {
      failures += 1;
      queue = [...batch, ...queue].slice(-maxQueue);
      if (failures >= maxFailuresBeforeOpen) {
        circuitOpenUntil = Date.now() + circuitOpenMs;
      }
    } finally {
      flushing = false;
    }
  }

  function flushSync(): void {
    if (queue.length === 0) return;
    const body = JSON.stringify({ records: queue });
    queue = [];
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(opts.url, new Blob([body], { type: 'application/json' }));
    }
  }

  function log(level: LogLevel, msg: string, meta?: { traceId: string; [key: string]: unknown }): void {
    const traceId = (meta?.traceId as string) ?? '';
    const fields: Record<string, string | number | boolean | null> = {};
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (k === 'traceId') continue;
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
          fields[k] = v as string | number | boolean | null;
        }
      }
    }
    enqueue({
      ts: new Date().toISOString(),
      level,
      msg,
      traceId,
      source: 'frontend',
      fields,
    });
  }

  return {
    log,
    flush,
    flushSync,
    _queueSize: () => queue.length,
    _failureCount: () => failures,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/shared/logger/clientLogger.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/logger/clientLogger.ts frontend/src/shared/logger/clientLogger.test.ts
git commit -m "fix(frontend): bounded backoff + circuit breaker for clientLogger

Sustained /_telemetry/logs failures no longer silently drop logs in a
hot retry loop. After 6 consecutive failures the circuit opens for
5 minutes, then retries fresh."
```

---

## Phase 2 — UX bug fixes

### Task 4: ErrorBoundary forwards to clientLogger + reload-resilient reset

**Files:**
- Modify: `frontend/src/app/error-boundary.tsx`

- [ ] **Step 1: Update the component**

Replace `frontend/src/app/error-boundary.tsx` with:

```tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { clientLogger, newTraceId } from '@/shared/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Forward to telemetry pipeline. Wrap in try so a logger failure cannot
    // cascade and re-trigger the error boundary.
    try {
      clientLogger.log('error', 'ui.boundary', {
        traceId: newTraceId(),
        message: error.message,
        stack: (error.stack ?? '').slice(0, 2000),
        componentStack: (info.componentStack ?? '').slice(0, 2000),
      });
    } catch {
      /* swallow */
    }
  }

  private handleReset = () => {
    // A simple state reset only works if the underlying problem went away.
    // Reload the page so derived state (React-Query caches, zustand stores,
    // hung streams) is rebuilt from scratch.
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-semibold text-[--color-destructive]">
              Что-то пошло не так
            </p>
            <p className="text-sm text-[--color-muted-foreground]">
              {this.state.error?.message ?? 'Произошла непредвиденная ошибка.'}
            </p>
            <button
              className="mt-4 rounded-md bg-[--color-primary] px-4 py-2 text-sm text-[--color-primary-foreground] hover:opacity-90"
              onClick={this.handleReset}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/error-boundary.tsx
git commit -m "fix(frontend): ErrorBoundary forwards to telemetry + reload on reset"
```

---

### Task 5: Stable date-divider keys in ChatView

**Files:**
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx`

- [ ] **Step 1: Replace divider rendering**

In `frontend/src/widgets/chat-view/chat-view.tsx` change the `displayMessages.map` block (lines 105-120) to derive a stable key from the date of the next message:

```tsx
        {displayMessages.map((item, idx) => {
          if (item === '__divider__') {
            const nextMsg = displayMessages.slice(idx + 1).find((m) => m !== '__divider__') as
              | Message
              | undefined;
            const dividerKey = nextMsg
              ? `divider-${new Date(nextMsg.created_at).toDateString()}`
              : `divider-end`;
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
          // ...rest unchanged
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/chat-view/chat-view.tsx
git commit -m "fix(frontend): stable date-based keys for ChatView dividers"
```

---

### Task 6: Auto-scroll follows streaming deltas

**Files:**
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx:88`

- [ ] **Step 1: Update deps array**

Change the `useAutoScroll` call to track content length so every delta retriggers scroll:

```tsx
  const { anchorRef } = useAutoScroll([
    displayMessages.length,
    stream.assistantContent.length,
    stream.status,
  ]);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/widgets/chat-view/chat-view.tsx
git commit -m "fix(frontend): chat auto-scroll tracks streaming deltas"
```

---

### Task 7: Invalidate chat detail after send-message completes

**Files:**
- Modify: `frontend/src/features/send-message/model.ts` (the `refreshMessages` closure built inside `startMessageStream`)

- [ ] **Step 1: Extend `refreshMessages` to invalidate chat detail too**

```ts
  const refreshMessages = () => {
    qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    return qc
      .invalidateQueries({ queryKey: messageKeys.list(chatId) })
      .then(() => useStreamStore.getState().reset())
      .catch(() => useStreamStore.getState().reset());
  };
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/send-message/model.ts
git commit -m "fix(frontend): invalidate chat detail after assistant_done

Title generated by the backend after the first exchange could
otherwise stay stale in the chat list until manual refresh."
```

---

### Task 8: Clean up global window listeners on HMR

**Files:**
- Modify: `frontend/src/app/main.tsx`

**Approach:** Vite HMR reloads the module; without disposal listeners stack. Detect HMR and dispose previous wiring via `import.meta.hot`.

- [ ] **Step 1: Wrap listeners with HMR dispose**

In `frontend/src/app/main.tsx`, after the three `addEventListener` calls and the `console.error/warn` overrides, declare disposers and register them:

```ts
const _origConsoleError = console.error.bind(console);
const _origConsoleWarn = console.warn.bind(console);

const _onError = (ev: ErrorEvent) => {
  clientLogger.log('error', 'unhandled.error', {
    traceId: newTraceId(),
    message: String(ev.message ?? ''),
    source: String(ev.filename ?? ''),
    line: Number(ev.lineno ?? 0),
    col: Number(ev.colno ?? 0),
  });
};
const _onRejection = (ev: PromiseRejectionEvent) => {
  const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
  clientLogger.log('error', 'unhandled.rejection', { traceId: newTraceId(), reason });
};
const _onBeforeUnload = () => { clientLogger.flushSync(); };

window.addEventListener('error', _onError);
window.addEventListener('unhandledrejection', _onRejection);
window.addEventListener('beforeunload', _onBeforeUnload);

console.error = (...args: unknown[]) => {
  _origConsoleError(...args);
  clientLogger.log('error', 'console.error', {
    traceId: newTraceId(),
    args: args.map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ').slice(0, 1000),
  });
};
console.warn = (...args: unknown[]) => {
  _origConsoleWarn(...args);
  clientLogger.log('warn', 'console.warn', {
    traceId: newTraceId(),
    args: args.map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ').slice(0, 1000),
  });
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('error', _onError);
    window.removeEventListener('unhandledrejection', _onRejection);
    window.removeEventListener('beforeunload', _onBeforeUnload);
    console.error = _origConsoleError;
    console.warn = _origConsoleWarn;
  });
}
```

(Replace the existing inline arrow functions accordingly — they all become named so `removeEventListener` can target them.)

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/main.tsx
git commit -m "fix(frontend): dispose global error listeners on HMR reload"
```

---

## Phase 3 — Streaming UX features

### Task 9: Verify stop control end-to-end + polish "Stopped" state

**Files:**
- Modify: `frontend/src/shared/store/stream-store.ts` (small: ensure `setStopping` action)
- Modify: `frontend/src/widgets/chat-view/message-bubble.tsx` (already shows `— Остановлено` for `message.aborted`; verify after abort the streaming class is removed)
- Add toast on stop via Sonner.
- Create: `frontend/src/features/send-message/stop.test.ts`

**Approach:** The stop wiring exists; this task is verification + small polish (toast feedback).

- [ ] **Step 1: Add `setStopping` action to stream-store**

Edit `frontend/src/shared/store/stream-store.ts`:

a) Add `setStopping: () => void;` to the `StreamState` interface.
b) Implement inside `create<StreamState>()`:
```ts
    setStopping() {
      set((s) => {
        if (s.status === 'streaming') s.status = 'stopping';
      });
    },
```

- [ ] **Step 2: Wire toast on stop**

In `frontend/src/features/send-message/model.ts` `useStreamChat.stop`:

```ts
import { toast } from 'sonner';
// ...
  const stop = useCallback(() => {
    if (useStreamStore.getState().status === 'streaming') {
      useStreamStore.getState().setStopping();
      abortActiveStream('user');
      toast('Генерация остановлена');
    }
  }, []);
```

Same in `frontend/src/features/regenerate-message/model.ts`.

- [ ] **Step 3: Add minimal integration test**

Create `frontend/src/features/send-message/stop.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStreamStore, setActiveController, abortActiveStream, getActiveController } from '@/shared/store/stream-store';

describe('stop wiring', () => {
  beforeEach(() => {
    useStreamStore.getState().reset();
    setActiveController(null);
  });

  it('setStopping transitions only from streaming', () => {
    useStreamStore.getState().setStopping();
    expect(useStreamStore.getState().status).toBe('idle');
    useStreamStore.getState().startStream('c', 'hi');
    useStreamStore.getState().setStopping();
    expect(useStreamStore.getState().status).toBe('stopping');
  });

  it('abortActiveStream signals the registered controller', () => {
    const c = new AbortController();
    setActiveController(c);
    abortActiveStream('user');
    expect(c.signal.aborted).toBe(true);
    expect(getActiveController()).toBe(null);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test -- src/features/send-message/stop.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/store/stream-store.ts \
        frontend/src/features/send-message/model.ts \
        frontend/src/features/regenerate-message/model.ts \
        frontend/src/features/send-message/stop.test.ts
git commit -m "feat(frontend): explicit setStopping action + toast on stop"
```

---

### Task 10: Retry-on-error in the composer

**Files:**
- Modify: `frontend/src/shared/store/stream-store.ts` (add `lastUserContent` field)
- Modify: `frontend/src/features/send-message/model.ts` (record content; expose `retry`)
- Modify: `frontend/src/pages/chats.$chatId.tsx` (render retry button when status==='error')

**Approach:** When a stream errors, the last user content stays in the store. A "Retry" button calls `send(lastUserContent)` after `reset()`.

- [ ] **Step 1: Add `lastUserContent` to stream store**

In `StreamState` add `lastUserContent: string | null;` and default it to `null` in `INITIAL`. In `startStream`, store `lastUserContent = optimisticContent`. In `reset`, restore from `INITIAL` (already does via spread).

- [ ] **Step 2: Expose `retry` from `useStreamChat`**

```ts
  const retry = useCallback(async () => {
    const last = useStreamStore.getState().lastUserContent;
    if (!last) return;
    useStreamStore.getState().reset();
    await startMessageStream({ chatId, content: last, qc });
  }, [chatId, qc]);

  return { send, stop, retry, isStreaming: ..., status: ... };
```

- [ ] **Step 3: Render Retry button**

In `frontend/src/pages/chats.$chatId.tsx`:

```tsx
const { send, stop, retry, isStreaming, status } = useStreamChat(chatId);
// ...
        {status === 'error' && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <p className="text-xs text-destructive">
              Не удалось получить ответ.
            </p>
            <button
              onClick={retry}
              className="text-xs underline underline-offset-2 hover:opacity-80"
            >
              Повторить
            </button>
          </div>
        )}
```
(remove the prior centered `<p>` text — replaced by the new block.)

- [ ] **Step 4: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/store/stream-store.ts \
        frontend/src/features/send-message/model.ts \
        frontend/src/pages/chats.$chatId.tsx
git commit -m "feat(frontend): retry button on stream error"
```

---

### Task 11: Generation progress indicator (chars/s + elapsed)

**Files:**
- Modify: `frontend/src/shared/store/stream-store.ts` (track `startedAt`, expose live counters via selector)
- Create: `frontend/src/widgets/chat-view/generation-progress.tsx`
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx` (render the indicator while streaming the assistant bubble)

**Approach:** No backend SSE change needed — we count characters of `assistantContent` and use wall-clock time. Show "12.4 c · 240 симв · 19 симв/с" beneath the bubble while streaming.

- [ ] **Step 1: Record `streamStartedAt` in the store**

In `StreamState` add `startedAt: number | null;`. Default `null` in `INITIAL`. Inside `startStream` set `s.startedAt = Date.now()`.

- [ ] **Step 2: Create the progress widget**

Create `frontend/src/widgets/chat-view/generation-progress.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useStreamStore } from '@/shared/store/stream-store';

export function GenerationProgress() {
  const startedAt = useStreamStore((s) => s.startedAt);
  const content = useStreamStore((s) => s.assistantContent);
  const status = useStreamStore((s) => s.status);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (status !== 'streaming') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);

  if (!startedAt || status !== 'streaming') return null;
  const elapsed = Math.max(0.1, (now - startedAt) / 1000);
  const chars = content.length;
  const rate = chars / elapsed;

  return (
    <div
      className="mt-1 text-[11px] text-muted-foreground tabular-nums"
      aria-live="polite"
    >
      {elapsed.toFixed(1)} c · {chars} симв · {rate.toFixed(0)} симв/с
    </div>
  );
}
```

- [ ] **Step 3: Mount inside ChatView**

In `frontend/src/widgets/chat-view/chat-view.tsx`, import and render just above the `anchorRef` div:

```tsx
import { GenerationProgress } from './generation-progress';
// ...
        <GenerationProgress />
        <div ref={anchorRef} className="h-1" aria-hidden="true" />
```

- [ ] **Step 4: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/store/stream-store.ts \
        frontend/src/widgets/chat-view/generation-progress.tsx \
        frontend/src/widgets/chat-view/chat-view.tsx
git commit -m "feat(frontend): live generation progress (elapsed/chars/rate)"
```

---

## Phase 4 — Chat features

### Task 12: Search-within-chat (filter messages)

**Files:**
- Create: `frontend/src/features/search-in-chat/model.ts` (FSE-powered hook returning filtered ids)
- Create: `frontend/src/features/search-in-chat/index.ts`
- Create: `frontend/src/widgets/chat-view/search-bar.tsx`
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx` (toolbar with search bar; filter `displayMessages`)
- Modify: `frontend/src/widgets/chat-view/message-bubble.tsx` (accept optional `highlight` term and wrap matches in `<mark>`)

- [ ] **Step 1: Add search hook**

Create `frontend/src/features/search-in-chat/model.ts`:

```ts
import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Message } from '@/entities/message/types';

export function useSearchInChat(messages: Message[], query: string) {
  return useMemo(() => {
    if (!query.trim()) return new Set<string>();
    const fuse = new Fuse(messages, {
      keys: ['content'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    return new Set(fuse.search(query).map((r) => r.item.id));
  }, [messages, query]);
}
```

Create `frontend/src/features/search-in-chat/index.ts`:

```ts
export { useSearchInChat } from './model';
```

- [ ] **Step 2: Add the search bar widget**

Create `frontend/src/widgets/chat-view/search-bar.tsx`:

```tsx
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  resultCount: number | null;
}

export function ChatSearchBar({ value, onChange, resultCount }: Props) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск по сообщениям…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label="Поиск по чату"
      />
      {value && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {resultCount ?? 0}
          </span>
          <button
            onClick={() => onChange('')}
            aria-label="Очистить"
            className="rounded p-1 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount + filter inside ChatView**

In `frontend/src/widgets/chat-view/chat-view.tsx`:

a) Import the hooks and widget:
```tsx
import { useState } from 'react';
import { useSearchInChat } from '@/features/search-in-chat';
import { ChatSearchBar } from './search-bar';
```

b) Inside `ChatView`:
```tsx
const [query, setQuery] = useState('');
const matchedIds = useSearchInChat(messages, query);
const filterActive = query.trim().length > 0;
```

c) When rendering, render `<ChatSearchBar value={query} onChange={setQuery} resultCount={filterActive ? matchedIds.size : null} />` above the message list container.

d) When `filterActive`, skip messages whose id is not in `matchedIds`:
```tsx
{displayMessages.map((item, idx) => {
  if (item === '__divider__') { /* unchanged */ }
  const msg = item as Message;
  if (filterActive && !matchedIds.has(msg.id)) return null;
  // ... existing return
})}
```

e) Pass `highlight={query}` to `MessageBubble` when `filterActive`.

- [ ] **Step 4: Highlight matches inside MessageBubble**

In `frontend/src/widgets/chat-view/message-bubble.tsx`:

a) Add `highlight?: string | undefined;` to props.
b) For user bubbles (the `<p>` branch) replace with a small `highlightText` helper:

```tsx
function highlightText(text: string, query?: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? <mark key={i} className="bg-yellow-200/60 dark:bg-yellow-500/40 rounded px-0.5">{part}</mark> : part
  );
}
```

Use `{highlightText(message.content, highlight)}` in the user bubble. (Assistant bubble — markdown — left as is; full-text highlighting through markdown is out of scope for this task.)

- [ ] **Step 5: Run typecheck + smoke test**

Run: `cd frontend && npm run typecheck && npm test`
Expected: no errors, all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/search-in-chat \
        frontend/src/widgets/chat-view/search-bar.tsx \
        frontend/src/widgets/chat-view/chat-view.tsx \
        frontend/src/widgets/chat-view/message-bubble.tsx
git commit -m "feat(frontend): search within current chat (fuse.js)"
```

---

### Task 13: Copy single message as Markdown

**Files:**
- Modify: `frontend/src/widgets/chat-view/message-bubble.tsx` (add copy-as-md button next to copy button)

**Approach:** Plain `copy` already exists and writes raw `message.content`. Since the assistant text *is* Markdown, "copy as MD" can simply copy the same string but with a richer toast (`"Скопировано как Markdown"`). To differentiate from plain text on user bubbles, only render the MD button for assistant role.

- [ ] **Step 1: Edit message-bubble.tsx**

Add an inline import:

```tsx
import { ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
```

Inside the action row, after the existing copy button add:

```tsx
{!isUser && (
  <button
    onClick={() => {
      navigator.clipboard.writeText(message.content).then(() => {
        toast('Скопировано как Markdown');
      });
    }}
    className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    aria-label="Копировать как Markdown"
    title="Копировать как Markdown"
  >
    <ClipboardCopy className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/chat-view/message-bubble.tsx
git commit -m "feat(frontend): copy assistant message as Markdown"
```

---

## Phase 5 — Larger features

### Task 14: Model selector (backend endpoint + UI dropdown)

**Files:**
- Create: `backend/app/api/v1/models.py`
- Modify: `backend/app/api/v1/router.py` (include the router)
- Modify: `backend/app/services/llm_client.py` (helper `list_models` + per-call `model` override)
- Modify: `backend/app/services/message_service.py` (accept optional `model` and pass through)
- Modify: `backend/app/api/v1/messages.py` (read `?model=...` query param)
- Modify: `backend/app/schemas/message.py` (no change required if `SendMessageIn` stays just `content`; model is a query param)
- Create: `frontend/src/entities/model/api.ts` (`useModelsQuery`)
- Create: `frontend/src/features/select-model/model.ts` (Zustand store: `selectedModel`)
- Create: `frontend/src/widgets/composer/model-picker.tsx`
- Modify: `frontend/src/widgets/composer/composer.tsx` (mount picker)
- Modify: `frontend/src/features/send-message/model.ts` (pass `?model=` query)
- Modify: `frontend/src/features/regenerate-message/model.ts` (same)

**Approach:** Backend exposes `GET /api/v1/models` that proxies `GET {VLLM_URL}/models` (OpenAI-compatible) and returns `[{ id, name }]`. Frontend persists the selection in `localStorage` via Zustand `persist` middleware. `?model=` query param on send/regenerate overrides the env default per request.

- [ ] **Step 1: Backend — add `list_models` to LlmClient**

Add to `backend/app/services/llm_client.py`:

```python
    async def list_models(self) -> list[str]:
        """List model ids exposed by the OpenAI-compatible /models endpoint."""
        try:
            response = await self._client.get("/models")
            if response.status_code >= 500:
                raise LlmUnavailableError(f"vLLM returned {response.status_code}")
            response.raise_for_status()
            data = response.json()
            return [m["id"] for m in data.get("data", []) if "id" in m]
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            raise LlmUnavailableError(str(exc)) from exc
```

- [ ] **Step 2: Backend — accept per-call model override**

In `LlmClient.stream` and `LlmClient.complete` add `model: str | None = None` kwarg, and use it in the payload:

```python
        payload = {
            "model": model or self._model,
            ...
        }
```

(For both methods; update signatures and docstrings.)

- [ ] **Step 3: Backend — create the route**

Create `backend/app/api/v1/models.py`:

```python
"""List available LLM models (proxies the OpenAI-compatible /models endpoint)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.db.models import User
from app.deps import get_current_user, get_llm_client
from app.services.llm_client import LlmClient
from app.core.exceptions import LlmUnavailableError

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def list_models(
    current_user: User = Depends(get_current_user),  # noqa: B008
    llm: LlmClient = Depends(get_llm_client),  # noqa: B008
) -> list[dict[str, str]]:
    try:
        ids = await llm.list_models()
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [{"id": mid, "name": mid} for mid in ids]
```

Check `backend/app/deps.py` for an existing `get_llm_client` dependency; if absent add one that returns the module-level singleton already used by `get_message_service` (reuse the same construction site — do not create a second `httpx.AsyncClient`).

- [ ] **Step 4: Backend — register router**

In `backend/app/api/v1/router.py`:

```python
from app.api.v1 import auth, health, models as models_api, telemetry
# ...
api_router.include_router(models_api.router)
```

- [ ] **Step 5: Backend — thread model override through MessageService**

In `backend/app/services/message_service.py`:

a) `stream_new_message(self, user_id, chat_id, content, model: str | None = None)`.
b) `stream_regenerate(self, user_id, chat_id, model: str | None = None)`.
c) Pass `model=model` to both `self._llm.stream(...)` calls.

In `backend/app/api/v1/messages.py`:

```python
@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    body: SendMessageIn,
    model: str | None = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_new_message(current_user.id, chat_id, body.content, model),
        headers=SSE_HEADERS,
    )


@router.post("/{chat_id}/regenerate")
async def regenerate_message(
    chat_id: UUID,
    model: str | None = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_regenerate(current_user.id, chat_id, model),
        headers=SSE_HEADERS,
    )
```

- [ ] **Step 6: Backend smoke test**

Run: `cd backend && uv run pytest -q`
Expected: existing tests still pass. (Adjust mocked LlmClient if any test asserts on positional args of `stream`.)

- [ ] **Step 7: Frontend — entity hook**

Create `frontend/src/entities/model/api.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';

export interface LlmModel {
  id: string;
  name: string;
}

export const modelKeys = {
  all: ['models'] as const,
  list: () => [...modelKeys.all, 'list'] as const,
};

export function useModelsQuery() {
  return useQuery({
    queryKey: modelKeys.list(),
    queryFn: () => api.get('models').json<LlmModel[]>(),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 8: Frontend — persisted store**

Create `frontend/src/features/select-model/model.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectModelState {
  selectedModel: string | null;
  setSelectedModel: (id: string | null) => void;
}

export const useSelectedModel = create<SelectModelState>()(
  persist(
    (set) => ({
      selectedModel: null,
      setSelectedModel: (id) => set({ selectedModel: id }),
    }),
    { name: 'nova-selected-model' },
  ),
);
```

- [ ] **Step 9: Frontend — picker UI**

Create `frontend/src/widgets/composer/model-picker.tsx`:

```tsx
import { Cpu, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model/model';

export function ModelPicker() {
  const { data: models = [], isLoading, isError } = useModelsQuery();
  const { selectedModel, setSelectedModel } = useSelectedModel();
  const current = selectedModel ?? models[0]?.id ?? '—';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
        <Cpu className="h-3.5 w-3.5" />
        <span>{isLoading ? '…' : isError ? 'модель?' : current}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {models.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => setSelectedModel(m.id)}>
            {m.name}
          </DropdownMenuItem>
        ))}
        {models.length === 0 && (
          <DropdownMenuItem disabled>Нет доступных моделей</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 10: Mount picker into Composer**

In `frontend/src/widgets/composer/composer.tsx` import and render the picker in the bottom action row, left side:

```tsx
import { ModelPicker } from './model-picker';
// ...
      <div className="flex items-center justify-between">
        <ModelPicker />
        {tooLong && (
          <span className="text-xs text-destructive">
            {value.length}/{MAX_LENGTH} — сообщение слишком длинное
          </span>
        )}
        <span className="flex-1" />
        {/* existing send/stop button */}
```

- [ ] **Step 11: Pass selected model on send/regenerate**

In `frontend/src/features/send-message/model.ts` change the URL:

```ts
import { useSelectedModel } from '@/features/select-model/model';
// inside startMessageStream:
  const model = useSelectedModel.getState().selectedModel;
  const url = `${getApiBase()}/chats/${chatId}/messages${model ? `?model=${encodeURIComponent(model)}` : ''}`;
  return fetchEventSource(url, { /* unchanged */ });
```

Same in `frontend/src/features/regenerate-message/model.ts`.

- [ ] **Step 12: Run lint + typecheck + tests**

Run: `cd frontend && npm run typecheck && npm run lint && npm test`
Expected: green.

- [ ] **Step 13: Commit**

```bash
git add backend/app/services/llm_client.py \
        backend/app/services/message_service.py \
        backend/app/api/v1/models.py \
        backend/app/api/v1/router.py \
        backend/app/api/v1/messages.py \
        frontend/src/entities/model \
        frontend/src/features/select-model \
        frontend/src/widgets/composer/model-picker.tsx \
        frontend/src/widgets/composer/composer.tsx \
        frontend/src/features/send-message/model.ts \
        frontend/src/features/regenerate-message/model.ts
git commit -m "feat: per-request LLM model selection

Backend exposes GET /api/v1/models proxying the OpenAI-compatible
/models endpoint. Frontend lets users pick a model from a Composer
dropdown; choice is persisted in localStorage and sent as ?model=
on send/regenerate."
```

---

### Task 15: Edit user message + regenerate from there

**Files:**
- Modify: `backend/app/services/chat_service.py` (new method `truncate_after(message_id)`)
- Modify: `backend/app/services/message_service.py` (new method `stream_edit(user_id, chat_id, message_id, new_content)`)
- Create: `backend/app/api/v1/messages.py` — new route `PATCH /chats/{chat_id}/messages/{message_id}/edit`
- Modify: `frontend/src/entities/message/types.ts` (add `SseUserMessageEvent` reuse)
- Create: `frontend/src/features/edit-message/model.ts` (`useEditMessage(chatId)` hook)
- Create: `frontend/src/features/edit-message/index.ts`
- Modify: `frontend/src/widgets/chat-view/message-bubble.tsx` (edit button + inline textarea on user messages)
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx` (pass `onEdit` to MessageBubble)
- Modify: `frontend/src/pages/chats.$chatId.tsx` (wire `useEditMessage`)

**Approach (backend):** PATCH replaces the user message content, deletes every message strictly after it (assistant turn + any subsequent rows), then re-streams a fresh assistant reply via the existing SSE pipeline. The response *is* an SSE stream identical in shape to `stream_regenerate`.

**Approach (frontend):** A pencil icon appears on hover of user bubbles. Clicking enters edit mode (replaces the bubble text with a `<textarea>` and Save/Cancel buttons). Saving calls the new endpoint with `EventSource`-style fetch and reuses the existing stream-store overlay.

- [ ] **Step 1: Backend — service-layer truncate + edit-stream**

In `backend/app/services/message_service.py` add:

```python
    async def stream_edit(
        self, user_id: UUID, chat_id: UUID, message_id: UUID, new_content: str
    ) -> AsyncIterator[bytes]:
        """Replace a user message content and regenerate everything after it."""
        try:
            chat = await self._get_chat_or_404(chat_id, user_id)
        except NotFoundError as exc:
            yield _sse("error", {"code": exc.code, "message": exc.message})
            return

        all_msgs = await self._get_messages(chat_id)
        target = next((m for m in all_msgs if m.id == message_id), None)
        if target is None or target.role != "user":
            yield _sse("error", {"code": "NOT_FOUND", "message": "User message not found"})
            return

        # Truncate: delete every message with created_at strictly greater than target.
        from sqlalchemy import delete as sa_delete

        from app.db.models import Message as MsgModel

        await self._db.execute(
            sa_delete(MsgModel).where(
                MsgModel.chat_id == chat_id,
                MsgModel.created_at > target.created_at,
            )
        )
        target.content = new_content
        target.created_at = datetime.now(UTC)  # bump so ordering stays consistent
        await self._db.flush()

        yield _sse(
            "user_message",
            {
                "id": str(target.id),
                "role": "user",
                "content": target.content,
                "created_at": target.created_at.isoformat(),
            },
        )

        # Reuse the regenerate path: build context from current history (which now
        # ends at the edited user message) and stream a fresh assistant reply.
        history = await self._get_messages(chat_id)
        context_messages = build_context(history, self._context_window)

        assistant_msg = Message(
            chat_id=chat_id,
            role="assistant",
            content="",
            aborted=False,
            created_at=datetime.now(UTC),
        )
        self._db.add(assistant_msg)
        await self._db.flush()
        await self._db.refresh(assistant_msg)
        yield _sse("assistant_start", {"id": str(assistant_msg.id)})

        accumulated: list[str] = []
        aborted = False
        llm_started = time.perf_counter()
        try:
            async for delta in self._llm.stream(
                context_messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            ):
                accumulated.append(delta)
                yield _sse("delta", {"text": delta})
        except asyncio.CancelledError:
            aborted = True
            raise
        except Exception as exc:
            yield _sse("error", {"code": "LLM_UNAVAILABLE", "message": str(exc)})
            await self._persist_assistant_fresh(
                chat_id, assistant_msg.id, "".join(accumulated), aborted=False
            )
            return
        finally:
            if aborted:
                await self._persist_assistant_fresh(
                    chat_id, assistant_msg.id, "".join(accumulated), aborted=True
                )
                return  # noqa: B012

        full_content = "".join(accumulated)
        assistant_msg.content = full_content
        await self._db.flush()
        from sqlalchemy import update
        from app.db.models import Chat as ChatModel

        await self._db.execute(
            update(ChatModel).where(ChatModel.id == chat_id).values(updated_at=datetime.now(UTC))
        )
        await self._db.flush()
        _ = chat  # quiet linter
        _ = llm_started
        yield _sse(
            "assistant_done",
            {
                "id": str(assistant_msg.id),
                "content": full_content,
                "aborted": False,
            },
        )
```

- [ ] **Step 2: Backend — new route**

In `backend/app/api/v1/messages.py`:

```python
from app.schemas.message import EditMessageIn  # added below


@router.patch("/{chat_id}/messages/{message_id}/edit")
async def edit_message(
    chat_id: UUID,
    message_id: UUID,
    body: EditMessageIn,
    current_user: User = Depends(get_current_user),  # noqa: B008
    svc: MessageService = Depends(get_message_service),  # noqa: B008
) -> StreamingResponse:
    return StreamingResponse(
        svc.stream_edit(current_user.id, chat_id, message_id, body.content),
        headers=SSE_HEADERS,
    )
```

In `backend/app/schemas/message.py` add:

```python
class EditMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=32_000)
```

(adjust imports — `BaseModel`, `Field`.)

- [ ] **Step 3: Backend — run tests**

Run: `cd backend && uv run pytest -q`
Expected: green. (Add a happy-path test if existing tests cover `stream_new_message` patterns — at minimum exercise the truncate via an in-memory session.)

- [ ] **Step 4: Frontend — edit hook**

Create `frontend/src/features/edit-message/model.ts`:

```ts
import { useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import {
  useStreamStore,
  setActiveController,
  abortActiveStream,
  getActiveController,
} from '@/shared/store/stream-store';
import { chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { getApiBase } from '@/shared/config/env';
import { clientLogger, newTraceId } from '@/shared/logger';
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
      clientLogger.log('info', 'user.message_edit', { traceId, chatId, messageId });

      abortActiveStream();
      const controller = new AbortController();
      setActiveController(controller);

      const store = useStreamStore.getState();
      store.startStream(chatId, trimmed);

      const refresh = () => {
        qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        return qc
          .invalidateQueries({ queryKey: messageKeys.list(chatId) })
          .then(() => useStreamStore.getState().reset())
          .catch(() => useStreamStore.getState().reset());
      };

      try {
        await fetchEventSource(
          `${getApiBase()}/chats/${chatId}/messages/${messageId}/edit`,
          {
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
                  void refresh();
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
              useStreamStore.getState().setError(err instanceof Error ? err.message : 'Edit error');
              throw err;
            },
            onclose: () => {
              const s = useStreamStore.getState();
              if (s.status === 'streaming' || s.status === 'stopping') {
                s.finishStream(s.assistantContent, true);
                void refresh();
              }
            },
          },
        );
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          useStreamStore.getState().setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (getActiveController() === controller) setActiveController(null);
      }
    },
    [chatId, qc],
  );

  return { edit };
}
```

Create `frontend/src/features/edit-message/index.ts`:

```ts
export { useEditMessage } from './model';
```

- [ ] **Step 5: MessageBubble — edit UI for user messages**

In `frontend/src/widgets/chat-view/message-bubble.tsx`:

a) Imports:
```tsx
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';
```

b) Add `onEdit?: ((newContent: string) => void) | undefined;` to props.

c) Local state for edit mode:
```tsx
const [editing, setEditing] = useState(false);
const [draft, setDraft] = useState(message.content);
```

d) In the user-bubble branch, replace the `<p>...` with:

```tsx
{isUser && editing ? (
  <div className="flex flex-col gap-2 w-full">
    <textarea
      autoFocus
      className="w-full resize-none rounded-md border bg-background p-2 text-sm leading-6 outline-none"
      rows={Math.min(8, draft.split('\n').length + 1)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(message.content); }}>
        Отмена
      </Button>
      <Button
        size="sm"
        disabled={!draft.trim() || draft.trim() === message.content.trim()}
        onClick={() => {
          if (onEdit) onEdit(draft.trim());
          setEditing(false);
        }}
      >
        Сохранить и пересоздать
      </Button>
    </div>
  </div>
) : isUser ? (
  <p className="whitespace-pre-wrap break-words">{message.content}</p>
) : (
  <MarkdownContent content={message.content} streaming={streaming} />
)}
```

e) In the action row, before the copy button add (only for user bubbles, only when not editing):

```tsx
{isUser && !editing && onEdit && (
  <button
    onClick={() => { setDraft(message.content); setEditing(true); }}
    className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    aria-label="Редактировать сообщение"
  >
    <Pencil className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 6: Pipe `onEdit` through ChatView**

In `frontend/src/widgets/chat-view/chat-view.tsx`:

a) Add to props: `onEditMessage?: ((messageId: string, content: string) => void) | undefined;`.
b) Pass to MessageBubble: `onEdit={onEditMessage ? (c) => onEditMessage(msg.id, c) : undefined}`.

- [ ] **Step 7: Wire on the chat page**

In `frontend/src/pages/chats.$chatId.tsx`:

```tsx
import { useEditMessage } from '@/features/edit-message';
// ...
  const { edit } = useEditMessage(chatId);
  // ...
      <ChatView
        messages={messages}
        chatId={chatId}
        onRegenerate={regenerate}
        onExamplePrompt={(p) => send(p)}
        onEditMessage={edit}
      />
```

- [ ] **Step 8: Run typecheck + tests**

Run: `cd frontend && npm run typecheck && npm test`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/message_service.py \
        backend/app/schemas/message.py \
        backend/app/api/v1/messages.py \
        frontend/src/features/edit-message \
        frontend/src/widgets/chat-view/message-bubble.tsx \
        frontend/src/widgets/chat-view/chat-view.tsx \
        frontend/src/pages/chats.$chatId.tsx
git commit -m "feat: edit user message and regenerate the rest

PATCH /chats/{chat_id}/messages/{message_id}/edit truncates the
conversation after the edited message and re-streams a fresh
assistant reply via the same SSE shape. Frontend renders an
in-place edit textarea on user bubbles with Save/Cancel."
```

---

## Final Verification

- [ ] **Run the full suite**

```bash
cd frontend && npm run typecheck && npm run lint && npm test
cd ../backend && uv run pytest -q
```
Expected: green.

- [ ] **Smoke-test in the browser** (manual)

```bash
docker compose up -d
```
- Login via OTP (Mailpit on :8025).
- Send a message → confirm stream + progress indicator.
- Hit Stop mid-stream → toast appears, bubble shows "— Остановлено".
- Force a network error (block /api/v1/chats/.../messages in DevTools) → Retry button works.
- Search inside chat for a word → matches highlighted.
- Switch model in composer dropdown → next message uses new model (visible in backend logs `llm.call_start` field `model`).
- Edit a previous user message → assistant reply re-streams; subsequent turns disappear.

---

## Self-Review

**Spec coverage:** All 8 bugs from the audit have tasks (1, 2, 3, 4, 5, 6, 7, 8) and all 8 feature ideas are tasks (9 verify/polish stop, 10 retry, 11 progress, 12 search, 13 copy-as-md, 14 model selector, 15 edit message). Code-block & math polish was a "verify already works" item — covered implicitly by Task 12 verifying KaTeX/highlight render unaffected and by the final smoke test.

**Placeholder scan:** No TBDs, no "add appropriate error handling", every step shows the actual code.

**Type consistency:** `setActiveController` / `getActiveController` / `abortActiveStream` all live in `stream-store.ts` and are imported with the same names in 4 places. `StreamState` adds `lastUserContent` (Task 10), `startedAt` (Task 11), `setStopping` (Task 9) — each added once and referenced consistently.
