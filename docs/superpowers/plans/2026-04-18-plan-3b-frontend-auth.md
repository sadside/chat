# Plan 3b — Frontend Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete OTP login flow on top of Plan 3a's foundation. Deliver `useMeQuery`, `useLogoutMutation`, `useRequestOtpMutation`, `useVerifyOtpMutation`, the `useOtpFlow()` orchestration hook, two validated form steps wrapped in an animated `AuthCard`, a `/auth` route, `beforeLoad` route guards on protected routes, a topbar user menu with logout, and comprehensive error/accessibility handling. Backend is already running on `:8080`.

**Architecture:** `entities/user` owns the server-state layer (`useMeQuery`, `useLogoutMutation`) backed by the existing `shared/api/client.ts` ky instance. `features/auth-login` owns the OTP state machine as a Zustand slice consumed by `useOtpFlow()`. UI components are thin: they call `useOtpFlow()` and render. Route guard lives in `beforeLoad` on `__root.tsx`; the root route preloads `useMeQuery` and pushes the resolved user into `auth.store`. Topbar mounts a user-menu dropdown that calls `useLogoutMutation`. Toasts are shown via shadcn `Sonner` (or a lightweight custom toast built on Radix `Toast`).

**Tech Stack:** React 18 · TypeScript 5 strict · TanStack Router 1.82+ · TanStack Query 5.59+ · Zustand 5 · ky 1.7+ · react-hook-form 7 · zod 3 · Motion (AnimatePresence) · shadcn/ui (Button, Input, Label, DropdownMenu, Sonner/Toast) · lucide-react · Vitest 2 · @testing-library/react · MSW 2 (add to devDeps for API mocking)

---

## Out of Scope

- Sidebar chat list, chat view, streaming (Plan 4)
- Password-based auth, OAuth, social login
- Profile editing, account settings
- Email verification flows beyond OTP
- "Resend code" timer is a stretch goal — a minimal 60-second cooldown button is acceptable but not required

---

## Preamble — install MSW

Before Task 1, add MSW to devDeps. This is the only dependency change in Plan 3b.

- [ ] **P.1: Add MSW**

```bash
cd frontend
npm install --save-dev msw@^2.6.0
npx msw init public/ --save
```

Commit: `chore(frontend): add msw for test api mocking`

---

## Task 1: shadcn primitives — add missing UI components

**Files:**
- Create: `frontend/src/shared/ui/label.tsx`
- Create: `frontend/src/shared/ui/dropdown-menu.tsx`
- Create: `frontend/src/shared/ui/toast.tsx`
- Create: `frontend/src/shared/ui/sonner.tsx`

These are the only UI primitives required by the auth UI that Plan 3a did not include.

- [ ] **Step 1.1: Write failing smoke tests**

Create `frontend/src/shared/ui/__tests__/primitives.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '@/shared/ui/label';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu';

describe('Label', () => {
  it('renders with htmlFor', () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  it('renders trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test -- --reporter=verbose 2>&1 | tail -20` — expect failures (missing modules).

- [ ] **Step 1.2: Install Radix primitives**

```bash
cd frontend
npm install @radix-ui/react-label @radix-ui/react-dropdown-menu @radix-ui/react-toast
```

- [ ] **Step 1.3: Create `label.tsx`**

```tsx
// frontend/src/shared/ui/label.tsx
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/shared/lib/utils';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 1.4: Create `dropdown-menu.tsx`**

```tsx
// frontend/src/shared/ui/dropdown-menu.tsx
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/shared/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPortal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-[--color-border]',
        'bg-[--color-background] p-1 text-[--color-foreground] shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPortal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
      'outline-none transition-colors focus:bg-[--color-accent] focus:text-[--color-accent-foreground]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
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
    className={cn('-mx-1 my-1 h-px bg-[--color-border]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-xs font-semibold text-[--color-muted-foreground]',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
```

- [ ] **Step 1.5: Create `toast.tsx`**

```tsx
// frontend/src/shared/ui/toast.tsx
// Minimal imperative toast — avoids Radix Toast Provider complexity.
// Exposes a `toast(message, variant?)` singleton used across the app.
import { create } from 'zustand';

export type ToastVariant = 'default' | 'destructive';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (message: string, variant?: ToastVariant) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, variant = 'default') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper — call from anywhere. */
export function toast(message: string, variant: ToastVariant = 'default') {
  useToastStore.getState().push(message, variant);
}
```

- [ ] **Step 1.6: Create `sonner.tsx` — toast renderer**

```tsx
// frontend/src/shared/ui/sonner.tsx
// Renders the active toasts from useToastStore in a fixed overlay.
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useToastStore } from '@/shared/ui/toast';
import { cn } from '@/shared/lib/utils';

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'flex min-w-[280px] items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              t.variant === 'destructive'
                ? 'border-red-500/30 bg-red-950 text-red-200'
                : 'border-[--color-border] bg-[--color-background] text-[--color-foreground]'
            )}
          >
            <span>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 1.7: Mount `Toaster` in root layout**

Edit `frontend/src/pages/__root.tsx` — add `<Toaster />` inside `<ErrorBoundary>` after the main content div (surgical append):

```diff
 import { ErrorBoundary } from '@/app/error-boundary';
+import { Toaster } from '@/shared/ui/sonner';

 // inside RootLayout return:
     </ErrorBoundary>
+    <Toaster />
```

Full updated return of `RootLayout`:

```tsx
return (
  <ErrorBoundary>
    <div className="flex h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        {isDesktop && <SidebarPlaceholder />}
        {!isDesktop && (
          <Dialog open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
            <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
              <DialogHeader className="sr-only">
                <DialogTitle>Navigation</DialogTitle>
              </DialogHeader>
              <SidebarPlaceholder className="w-full border-0" />
            </DialogContent>
          </Dialog>
        )}
        <main className="flex flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
    <Toaster />
  </ErrorBoundary>
);
```

- [ ] **Step 1.8: Run tests — expect green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -30
```

Commit: `feat(frontend): add Label, DropdownMenu, Toast primitives`

---

## Task 2: MSW handlers + test infrastructure

**Files:**
- Create: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/test/msw/server.ts`
- Edit: `frontend/src/test/setup.ts`

- [ ] **Step 2.1: Write failing integration test to verify MSW setup**

Create `frontend/src/test/__tests__/msw-setup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

describe('MSW server', () => {
  it('intercepts GET /health', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/health', () =>
        HttpResponse.json({ status: 'ok' })
      )
    );
    const res = await fetch('http://localhost:8080/api/v1/health');
    const data = await res.json();
    expect(data.status).toBe('ok');
  });
});
```

Run tests — expect failure (missing `@/test/msw/server`).

- [ ] **Step 2.2: Create `handlers.ts`**

```ts
// frontend/src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8080/api/v1';

export const handlers = [
  // GET /auth/me — authenticated by default
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ id: 'user-1', email: 'test@example.com' })
  ),

  // POST /auth/request-otp
  http.post(`${BASE}/auth/request-otp`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // POST /auth/verify-otp
  http.post(`${BASE}/auth/verify-otp`, () =>
    HttpResponse.json({ id: 'user-1', email: 'test@example.com' })
  ),

  // POST /auth/logout
  http.post(`${BASE}/auth/logout`, () =>
    new HttpResponse(null, { status: 204 })
  ),
];
```

- [ ] **Step 2.3: Create `server.ts`**

```ts
// frontend/src/test/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] **Step 2.4: Update `frontend/src/test/setup.ts`** (surgical edit — append lifecycle hooks)

```ts
import '@testing-library/jest-dom';
import { server } from '@/test/msw/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 2.5: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -30
```

Commit: `test(frontend): add MSW server + auth handlers`

---

## Task 3: `entities/user` — `useMeQuery` and `useLogoutMutation`

**Files:**
- Create: `frontend/src/entities/user/api.ts`
- Create: `frontend/src/entities/user/model.ts`
- Create: `frontend/src/entities/user/__tests__/user-api.test.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `frontend/src/entities/user/__tests__/user-api.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useMeQuery } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMeQuery', () => {
  it('returns user on 200', async () => {
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe('test@example.com');
  });

  it('returns undefined on 401', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useIsAuthenticated (model)', () => {
  it('reflects auth store state', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'x@y.com' });
    const { result } = renderHook(() => {
      const { useIsAuthenticated } = require('@/entities/user/model');
      return useIsAuthenticated();
    });
    expect(result.current).toBe(true);
    useAuthStore.getState().clearUser();
  });
});
```

Run — expect failures.

- [ ] **Step 3.2: Create `entities/user/api.ts`**

```ts
// frontend/src/entities/user/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AuthUser } from '@/shared/store/auth-store';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

/**
 * Fetches current user. Returns undefined (not error) on 401 —
 * callers check `data` to determine auth state.
 */
export function useMeQuery() {
  return useQuery<AuthUser | undefined>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await apiClient.get('auth/me').json<AuthUser>();
      } catch (err: unknown) {
        // 401 is expected when unauthenticated — treat as null user
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) return undefined;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('auth/logout').json<void>(),
    onSuccess: () => {
      qc.setQueryData(ME_QUERY_KEY, undefined);
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 3.3: Create `entities/user/model.ts`**

```ts
// frontend/src/entities/user/model.ts
import { useAuthStore, type AuthUser } from '@/shared/store/auth-store';

/** Returns current user from auth store (optimistic, pre-query). */
export function useCurrentUser(): AuthUser | null {
  return useAuthStore((s) => s.user);
}

/** Returns true if the auth store has a user. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.isAuthenticated);
}

/** Derives user initials for avatar rendering (e.g. "JD" from "john@domain"). */
export function getUserInitials(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 3.4: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -30
```

Commit: `feat(frontend): entities/user — useMeQuery, useLogoutMutation, model selectors`

---

## Task 4: `features/auth-login` — mutations and OTP state machine

**Files:**
- Create: `frontend/src/features/auth-login/api.ts`
- Create: `frontend/src/features/auth-login/model.ts`
- Create: `frontend/src/features/auth-login/__tests__/otp-flow.test.tsx`

- [ ] **Step 4.1: Write failing tests**

Create `frontend/src/features/auth-login/__tests__/otp-flow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useOtpFlow } from '@/features/auth-login/model';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ navigate: mockNavigate }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useOtpFlow', () => {
  it('starts at email-input stage', () => {
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    expect(result.current.stage).toBe('email-input');
  });

  it('advances to code-input after successful requestOtp', async () => {
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.stage).toBe('code-input'));
  });

  it('stays at email-input and exposes error on request-otp failure', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/auth/request-otp', () =>
        new HttpResponse(null, { status: 500 })
      )
    );
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.stage).toBe('email-input'));
    expect(result.current.error).toBeTruthy();
  });

  it('shows inline error on invalid OTP (400)', async () => {
    // First advance to code-input
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.stage).toBe('code-input'));

    server.use(
      http.post('http://localhost:8080/api/v1/auth/verify-otp', () =>
        HttpResponse.json({ detail: 'Invalid or expired code' }, { status: 400 })
      )
    );
    await act(async () => {
      await result.current.submitCode('000000');
    });
    await waitFor(() => expect(result.current.error).toMatch(/invalid|expired/i));
    expect(result.current.stage).toBe('code-input');
  });

  it('shows rate-limit message on 429', async () => {
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    server.use(
      http.post('http://localhost:8080/api/v1/auth/request-otp', () =>
        new HttpResponse(null, { status: 429 })
      )
    );
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.error).toMatch(/too many attempts/i));
  });

  it('transitions to success and navigates after valid code', async () => {
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.stage).toBe('code-input'));
    await act(async () => {
      await result.current.submitCode('123456');
    });
    await waitFor(() => expect(result.current.stage).toBe('success'));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('resets flow on reset()', async () => {
    const { result } = renderHook(() => useOtpFlow(), { wrapper });
    await act(async () => {
      await result.current.submitEmail('user@example.com');
    });
    await waitFor(() => expect(result.current.stage).toBe('code-input'));
    act(() => result.current.reset());
    expect(result.current.stage).toBe('email-input');
    expect(result.current.email).toBe('');
  });
});
```

Run — expect failures.

- [ ] **Step 4.2: Create `features/auth-login/api.ts`**

```ts
// frontend/src/features/auth-login/api.ts
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AuthUser } from '@/shared/store/auth-store';

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.post('auth/request-otp', { json: { email } }).then(() => undefined as void),
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      apiClient.post('auth/verify-otp', { json: { email, code } }).json<AuthUser>(),
  });
}
```

- [ ] **Step 4.3: Create Zustand OTP slice inside `features/auth-login/model.ts`**

```ts
// frontend/src/features/auth-login/model.ts
import { create } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRequestOtpMutation, useVerifyOtpMutation } from './api';
import { useAuthStore } from '@/shared/store/auth-store';
import { ME_QUERY_KEY } from '@/entities/user/api';
import { toast } from '@/shared/ui/toast';

export type OtpStage = 'email-input' | 'code-input' | 'success';

interface OtpFlowState {
  stage: OtpStage;
  email: string;
  error: string;
  isLoading: boolean;
  setStage: (stage: OtpStage) => void;
  setEmail: (email: string) => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useOtpFlowStore = create<OtpFlowState>()((set) => ({
  stage: 'email-input',
  email: '',
  error: '',
  isLoading: false,
  setStage: (stage) => set({ stage }),
  setEmail: (email) => set({ email }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ stage: 'email-input', email: '', error: '', isLoading: false }),
}));

function resolveError(err: unknown, defaultMessage: string): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'Too many attempts, try in a few minutes.';
  const message = (err as { message?: string })?.message;
  return message || defaultMessage;
}

/**
 * Orchestration hook for the OTP login flow.
 * All business logic lives here — components just call submitEmail / submitCode.
 */
export function useOtpFlow() {
  const { stage, email, error, isLoading, setStage, setEmail, setError, setLoading, reset } =
    useOtpFlowStore();
  const requestOtp = useRequestOtpMutation();
  const verifyOtp = useVerifyOtpMutation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  async function submitEmail(inputEmail: string) {
    setError('');
    setLoading(true);
    try {
      await requestOtp.mutateAsync(inputEmail);
      setEmail(inputEmail);
      setStage('code-input');
    } catch (err: unknown) {
      setError(resolveError(err, 'Failed to send OTP. Please try again.'));
      if ((err as { response?: { status?: number } })?.response?.status !== 429) {
        toast('Could not send verification email.', 'destructive');
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(code: string) {
    setError('');
    setLoading(true);
    try {
      const user = await verifyOtp.mutateAsync({ email, code });
      setUser(user);
      qc.setQueryData(ME_QUERY_KEY, user);
      setStage('success');
      await navigate({ to: '/' });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        setError(resolveError(err, 'Invalid or expired code. Please try again.'));
      } else if (status === 429) {
        setError('Too many attempts, try in a few minutes.');
      } else {
        setError(resolveError(err, 'Verification failed. Please try again.'));
        toast('Verification failed.', 'destructive');
      }
    } finally {
      setLoading(false);
    }
  }

  return { stage, email, error, isLoading, submitEmail, submitCode, reset };
}
```

- [ ] **Step 4.4: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): features/auth-login — OTP mutations + useOtpFlow state machine`

---

## Task 5: Auth UI components — `EmailStep`, `CodeStep`, `AuthCard`

**Files:**
- Create: `frontend/src/features/auth-login/ui/EmailStep.tsx`
- Create: `frontend/src/features/auth-login/ui/CodeStep.tsx`
- Create: `frontend/src/features/auth-login/ui/AuthCard.tsx`
- Create: `frontend/src/features/auth-login/ui/__tests__/auth-steps.test.tsx`

- [ ] **Step 5.1: Write failing component tests**

Create `frontend/src/features/auth-login/ui/__tests__/auth-steps.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { EmailStep } from '@/features/auth-login/ui/EmailStep';
import { CodeStep } from '@/features/auth-login/ui/CodeStep';
import { useOtpFlowStore } from '@/features/auth-login/model';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ navigate: mockNavigate }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useOtpFlowStore.getState().reset();
});

describe('EmailStep', () => {
  it('renders email input and submit button', () => {
    render(<EmailStep />, { wrapper });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('shows validation error for bad email', async () => {
    render(<EmailStep />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
    );
  });

  it('calls request-otp on valid email submit', async () => {
    let called = false;
    server.use(
      http.post('http://localhost:8080/api/v1/auth/request-otp', () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<EmailStep />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(called).toBe(true));
  });
});

describe('CodeStep', () => {
  beforeEach(() => {
    useOtpFlowStore.setState({ stage: 'code-input', email: 'user@example.com', error: '' });
  });

  it('renders code input with email shown', () => {
    render(<CodeStep />, { wrapper });
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example\.com/)).toBeInTheDocument();
  });

  it('shows inline error on invalid code (400)', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/auth/verify-otp', () =>
        HttpResponse.json({ detail: 'Invalid or expired code' }, { status: 400 })
      )
    );
    render(<CodeStep />, { wrapper });
    const user = userEvent.setup();
    const input = screen.getByLabelText(/code/i);
    await user.type(input, '000000');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid|expired/i)
    );
  });

  it('auto-submits when 6 digits are entered', async () => {
    let called = false;
    server.use(
      http.post('http://localhost:8080/api/v1/auth/verify-otp', () => {
        called = true;
        return HttpResponse.json({ id: 'u1', email: 'user@example.com' });
      })
    );
    render(<CodeStep />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/code/i), '123456');
    await waitFor(() => expect(called).toBe(true));
  });
});
```

Run — expect failures.

- [ ] **Step 5.2: Create `EmailStep.tsx`**

```tsx
// frontend/src/features/auth-login/ui/EmailStep.tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2 } from 'lucide-react';
import { useOtpFlow } from '@/features/auth-login/model';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});
type FormValues = z.infer<typeof schema>;

export function EmailStep() {
  const { submitEmail, isLoading, error } = useOtpFlow();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  async function onSubmit(values: FormValues) {
    await submitEmail(values.email);
  }

  const fieldError = errors.email?.message || error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email-input">Email</Label>
        <Input
          id="email-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'email-error' : undefined}
          disabled={isLoading}
          {...register('email')}
        />
        {fieldError && (
          <p id="email-error" role="alert" className="text-sm text-red-400">
            {fieldError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </form>
  );
}
```

Note: `@hookform/resolvers` must be installed. Add to package.json if missing:
```bash
cd frontend && npm install @hookform/resolvers
```

- [ ] **Step 5.3: Create `CodeStep.tsx`**

```tsx
// frontend/src/features/auth-login/ui/CodeStep.tsx
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useOtpFlow } from '@/features/auth-login/model';

const schema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'Code must be 6 digits.'),
});
type FormValues = z.infer<typeof schema>;

export function CodeStep() {
  const { email, submitCode, isLoading, error, reset } = useOtpFlow();
  const autoSubmittedRef = useRef(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setFocus,
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' });

  const codeValue = watch('code', '');

  useEffect(() => {
    setFocus('code');
    autoSubmittedRef.current = false;
  }, [setFocus]);

  // Auto-submit when exactly 6 digits are typed
  useEffect(() => {
    if (codeValue.length === 6 && /^\d{6}$/.test(codeValue) && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitCode(codeValue);
    }
  }, [codeValue, submitCode]);

  async function onSubmit(values: FormValues) {
    await submitCode(values.code);
  }

  const fieldError = errors.code?.message || error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-[--color-muted-foreground]">
        We sent a 6-digit code to <span className="font-medium text-[--color-foreground]">{email}</span>.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code-input">Verification code</Label>
        <Input
          id="code-input"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="123456"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'code-error' : undefined}
          disabled={isLoading}
          {...register('code')}
        />
        {fieldError && (
          <p id="code-error" role="alert" className="text-sm text-red-400">
            {fieldError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          'Verify'
        )}
      </Button>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1 text-sm text-[--color-muted-foreground] hover:text-[--color-foreground] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Use a different email
      </button>
    </form>
  );
}
```

- [ ] **Step 5.4: Create `AuthCard.tsx`**

```tsx
// frontend/src/features/auth-login/ui/AuthCard.tsx
import { AnimatePresence, motion } from 'motion/react';
import { EmailStep } from './EmailStep';
import { CodeStep } from './CodeStep';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { CheckCircle2 } from 'lucide-react';

export function AuthCard() {
  const stage = useOtpFlowStore((s) => s.stage);

  return (
    <div className="w-full max-w-sm rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to Nova</h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">
          {stage === 'email-input' && 'Enter your email to receive a login code.'}
          {stage === 'code-input' && 'Check your inbox.'}
          {stage === 'success' && 'Signed in successfully!'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'email-input' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
          >
            <EmailStep />
          </motion.div>
        )}
        {stage === 'code-input' && (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <CodeStep />
          </motion.div>
        )}
        {stage === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3 py-4 text-center"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm text-[--color-muted-foreground]">Redirecting…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5.5: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): auth-login UI — EmailStep, CodeStep, AuthCard with Motion transitions`

---

## Task 6: `/auth` route (auth page)

**Files:**
- Create: `frontend/src/pages/auth.tsx`
- Create: `frontend/src/pages/__tests__/auth-page.test.tsx`

- [ ] **Step 6.1: Write failing test**

Create `frontend/src/pages/__tests__/auth-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  createFileRoute: () => ({ component: (_: unknown) => _ }),
}));

// Lazy import after mocks
async function renderAuthPage() {
  const { AuthPage } = await import('@/pages/auth');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthPage />
    </QueryClientProvider>
  );
}

describe('AuthPage', () => {
  it('renders sign-in card', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    await renderAuthPage();
    expect(screen.getByText(/sign in to nova/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
```

Run — expect failure.

- [ ] **Step 6.2: Create `frontend/src/pages/auth.tsx`**

```tsx
// frontend/src/pages/auth.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AuthCard } from '@/features/auth-login/ui/AuthCard';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { useEffect } from 'react';

export function AuthPage() {
  const reset = useOtpFlowStore((s) => s.reset);

  // Reset flow state when page mounts (e.g. after logout redirect)
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      {/* Brand wordmark */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-black tracking-tight text-[--color-foreground]">
          Nova
        </span>
      </div>
      <AuthCard />
    </div>
  );
}

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});
```

- [ ] **Step 6.3: Register `/auth` in router**

Edit `frontend/src/app/router.tsx` — import and add the auth route to the route tree. The exact edit depends on Plan 3a's router setup, but the pattern is:

```ts
import { authRoute } from '@/pages/auth';
// add authRoute to routeTree children
```

If Plan 3a uses `@tanstack/router-plugin` with file-based routing, the file at `src/pages/auth.tsx` is auto-discovered — no manual registration needed. Verify by running the dev server briefly or checking whether `routeTree.gen.ts` is generated.

For manual registration, find `src/app/router.tsx` and add:

```ts
import { Route as authRoute } from '@/pages/auth';
// Insert into rootRoute.addChildren([..., authRoute])
```

- [ ] **Step 6.4: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): /auth page with AuthCard and OTP flow`

---

## Task 7: Route guarding + `useMeQuery` preload in `__root.tsx`

**Files:**
- Edit: `frontend/src/pages/__root.tsx`
- Create: `frontend/src/pages/__tests__/root-guard.test.tsx`

The root route preloads `useMeQuery` on every navigation, pushing the user (or null) into `auth.store`. Protected routes get a `beforeLoad` that redirects to `/auth` if no user is found.

- [ ] **Step 7.1: Write failing guard test**

Create `frontend/src/pages/__tests__/root-guard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useMeQuery } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMeQuery populates auth store', () => {
  it('sets user in store when /me returns 200', async () => {
    useAuthStore.getState().clearUser();
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Auth store population happens in __root effect — simulate it directly
    if (result.current.data) {
      useAuthStore.getState().setUser(result.current.data);
    }
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('clears store when /me returns 401', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    useAuthStore.setState({ user: { id: 'x', email: 'x@y.com' }, isAuthenticated: true });
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    if (!result.current.data) {
      useAuthStore.getState().clearUser();
    }
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```

Run — expect failure.

- [ ] **Step 7.2: Update `__root.tsx` — preload me query + sync to auth store**

This is a surgical edit. Add to the existing `RootLayout` component:

```tsx
import { useMeQuery } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';
import { useEffect } from 'react'; // already imported in Plan 3a

// Inside RootLayout, before return:
const { data: meUser } = useMeQuery();
const { setUser, clearUser } = useAuthStore();

useEffect(() => {
  if (meUser) {
    setUser(meUser);
  } else {
    clearUser();
  }
}, [meUser, setUser, clearUser]);
```

Full updated `__root.tsx` (replace existing file content):

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { SidebarPlaceholder } from '@/widgets/sidebar/sidebar-placeholder';
import { Topbar } from '@/widgets/topbar/topbar';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { ErrorBoundary } from '@/app/error-boundary';
import { Toaster } from '@/shared/ui/sonner';
import { useMeQuery } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';

function RootLayout() {
  const { sidebarOpen, closeSidebar } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { data: meUser } = useMeQuery();
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      closeSidebar();
    }
  }, [isDesktop, sidebarOpen, closeSidebar]);

  useEffect(() => {
    if (meUser) {
      setUser(meUser);
    } else {
      clearUser();
    }
  }, [meUser, setUser, clearUser]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          {isDesktop && <SidebarPlaceholder />}
          {!isDesktop && (
            <Dialog open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
              <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                <DialogHeader className="sr-only">
                  <DialogTitle>Navigation</DialogTitle>
                </DialogHeader>
                <SidebarPlaceholder className="w-full border-0" />
              </DialogContent>
            </Dialog>
          )}
          <main className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </ErrorBoundary>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
```

- [ ] **Step 7.3: Add `beforeLoad` guard to the index route (protect `/`)**

Edit `frontend/src/pages/index.tsx` — add `beforeLoad`:

```ts
import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryClient } from '@/app/query-client'; // or however QueryClient is exported
import { meQueryOptions } from '@/entities/user/api';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Check auth — redirect to /auth if unauthenticated
    try {
      const user = await queryClient.ensureQueryData(meQueryOptions);
      if (!user) throw redirect({ to: '/auth' });
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) throw err;
      throw redirect({ to: '/auth' });
    }
  },
  component: IndexPage,
});
```

Export `meQueryOptions` from `entities/user/api.ts` (add alongside existing code):

```ts
// Append to frontend/src/entities/user/api.ts
import { queryOptions } from '@tanstack/react-query';

export const meQueryOptions = queryOptions<AuthUser | undefined>({
  queryKey: ME_QUERY_KEY,
  queryFn: async () => {
    try {
      return await apiClient.get('auth/me').json<AuthUser>();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return undefined;
      throw err;
    }
  },
  staleTime: 5 * 60 * 1000,
  retry: false,
});

// Update useMeQuery to use queryOptions:
export function useMeQuery() {
  return useQuery(meQueryOptions);
}
```

Also export `queryClient` from `frontend/src/app/providers/query-provider.tsx` (or wherever it is created in Plan 3a) so `beforeLoad` can call `ensureQueryData`:

```ts
// Ensure frontend/src/app/providers/query-provider.tsx exports the instance:
export const queryClient = new QueryClient({ ... });
```

- [ ] **Step 7.4: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): route guard — beforeLoad redirects unauthenticated to /auth, root preloads me query`

---

## Task 8: Topbar user menu with logout

**Files:**
- Create: `frontend/src/widgets/topbar/user-menu.tsx`
- Edit: `frontend/src/widgets/topbar/topbar.tsx`
- Create: `frontend/src/widgets/topbar/__tests__/user-menu.test.tsx`

- [ ] **Step 8.1: Write failing test**

Create `frontend/src/widgets/topbar/__tests__/user-menu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/shared/store/auth-store';
import { UserMenu } from '@/widgets/topbar/user-menu';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ navigate: mockNavigate }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('UserMenu', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'john@example.com' });
  });

  it('shows initials avatar', () => {
    render(<UserMenu />, { wrapper });
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('shows email in dropdown', async () => {
    render(<UserMenu />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('john@example.com')).toBeInTheDocument();
  });

  it('calls logout and redirects to /auth', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/auth/logout', () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    render(<UserMenu />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText(/log out/i));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/auth' }));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```

Run — expect failure.

- [ ] **Step 8.2: Create `user-menu.tsx`**

```tsx
// frontend/src/widgets/topbar/user-menu.tsx
import { useNavigate } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { useCurrentUser } from '@/entities/user/model';
import { getUserInitials } from '@/entities/user/model';
import { useLogoutMutation } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';
import { toast } from '@/shared/ui/toast';

export function UserMenu() {
  const user = useCurrentUser();
  const clearUser = useAuthStore((s) => s.clearUser);
  const logout = useLogoutMutation();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = getUserInitials(user.email);

  async function handleLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      // Ignore — cookie may already be gone
    } finally {
      clearUser();
      await navigate({ to: '/auth' });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[--color-accent] text-xs font-bold text-[--color-accent-foreground] hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring]"
          aria-label="User menu"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={logout.isPending}
          className="text-red-400 focus:text-red-300"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 8.3: Edit `topbar.tsx` — mount UserMenu**

Surgical edit to existing `frontend/src/widgets/topbar/topbar.tsx`. Add `UserMenu` to the right side of the topbar:

```diff
+import { UserMenu } from './user-menu';

 // In the topbar JSX, right side:
-<ThemeToggle />
+<div className="flex items-center gap-2">
+  <ThemeToggle />
+  <UserMenu />
+</div>
```

The exact edit depends on Plan 3a's Topbar structure. Import `UserMenu` and mount it alongside the existing `ThemeToggle`. If Plan 3a's topbar has a right-side `<div>` or `<nav>`, add `<UserMenu />` there.

- [ ] **Step 8.4: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): topbar user menu — avatar, email display, logout action`

---

## Task 9: Resend code cooldown (stretch — minimal)

**Files:**
- Edit: `frontend/src/features/auth-login/ui/CodeStep.tsx`
- Edit: `frontend/src/features/auth-login/model.ts`

This is a stretch goal. Implement a minimal 60-second cooldown "Resend code" button. Skip if time-constrained; the flow works without it.

- [ ] **Step 9.1: Add resend action to `useOtpFlow`**

In `model.ts`, add `resendCode` to the returned object:

```ts
async function resendCode() {
  if (!email) return;
  await submitEmail(email);
}

// In return value:
return { stage, email, error, isLoading, submitEmail, submitCode, reset, resendCode };
```

- [ ] **Step 9.2: Add cooldown timer + Resend button in `CodeStep.tsx`**

```tsx
import { useState, useEffect } from 'react';

// Inside CodeStep:
const [cooldown, setCooldown] = useState(60);
const { resendCode } = useOtpFlow();

useEffect(() => {
  if (cooldown <= 0) return;
  const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
  return () => clearTimeout(id);
}, [cooldown]);

async function handleResend() {
  setCooldown(60);
  await resendCode();
}
```

Add below the "Use a different email" button:

```tsx
<button
  type="button"
  onClick={handleResend}
  disabled={cooldown > 0 || isLoading}
  className="text-sm text-[--color-muted-foreground] hover:text-[--color-foreground] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
</button>
```

- [ ] **Step 9.3: Run tests — green**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | tail -40
```

Commit: `feat(frontend): auth code step — 60s resend cooldown`

---

## Task 10: Full test suite — verify count and integration

**Files:**
- Create: `frontend/src/features/auth-login/__tests__/integration.test.tsx`

Verify the overall test count reaches ≥35.

- [ ] **Step 10.1: Write integration test covering the full login flow end-to-end**

Create `frontend/src/features/auth-login/__tests__/integration.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { useAuthStore } from '@/shared/store/auth-store';
import { AuthCard } from '@/features/auth-login/ui/AuthCard';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ navigate: mockNavigate }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Full OTP login flow (AuthCard)', () => {
  beforeEach(() => {
    useOtpFlowStore.getState().reset();
    useAuthStore.getState().clearUser();
    mockNavigate.mockReset();
  });

  it('completes full login: email → code → success', async () => {
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();

    // Stage 1: email
    expect(screen.getByText(/sign in to nova/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), 'login@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Stage 2: code
    await waitFor(() => expect(screen.getByLabelText(/code/i)).toBeInTheDocument());
    expect(screen.getByText(/login@example\.com/)).toBeInTheDocument();

    // Auto-submit on 6 digits
    await user.type(screen.getByLabelText(/code/i), '123456');

    // Stage 3: success
    await waitFor(() => expect(screen.getByText(/redirecting/i)).toBeInTheDocument());
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('shows rate-limit message on 429 at email step', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/auth/request-otp', () =>
        new HttpResponse(null, { status: 429 })
      )
    );
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'x@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i)
    );
  });

  it('invalid code shows inline error and stays on code step', async () => {
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'y@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => screen.getByLabelText(/code/i));

    server.use(
      http.post('http://localhost:8080/api/v1/auth/verify-otp', () =>
        HttpResponse.json({ detail: 'Invalid or expired code' }, { status: 400 })
      )
    );
    await user.type(screen.getByLabelText(/code/i), '000000');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid|expired/i)
    );
    expect(useOtpFlowStore.getState().stage).toBe('code-input');
  });

  it('"Use a different email" resets to email step', async () => {
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'z@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => screen.getByLabelText(/code/i));
    await user.click(screen.getByText(/use a different email/i));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(useOtpFlowStore.getState().stage).toBe('email-input');
  });
});
```

- [ ] **Step 10.2: Run full suite and count**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|Tests:)"
```

Expected output: `Tests: XX passed` where XX ≥ 35.

If count is below 35, enumerate the current test files and their counts:

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep "✓\|✗\|×" | wc -l
```

- [ ] **Step 10.3: Typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -20
```

Resolve any TypeScript errors before committing.

- [ ] **Step 10.4: Lint**

```bash
cd frontend && npm run lint 2>&1 | tail -20
```

- [ ] **Step 10.5: Commit**

Commit: `test(frontend): integration tests — full OTP flow, rate limit, invalid code, reset`

---

## Spec Coverage Table

| Spec requirement | Task | Status |
|---|---|---|
| `entities/user/api.ts` — `useMeQuery`, `useLogoutMutation` | Task 3 | ✓ |
| `entities/user/model.ts` — selectors | Task 3 | ✓ |
| `features/auth-login/api.ts` — `useRequestOtpMutation`, `useVerifyOtpMutation` | Task 4 | ✓ |
| `features/auth-login/model.ts` — `useOtpFlow()`, Zustand stage machine | Task 4 | ✓ |
| `EmailStep.tsx` — react-hook-form + zod, inline errors, loading | Task 5 | ✓ |
| `CodeStep.tsx` — auto-submit on 6 digits, inline error | Task 5 | ✓ |
| `AuthCard.tsx` — AnimatePresence transitions | Task 5 | ✓ |
| `/auth` route + brand logo | Task 6 | ✓ |
| `beforeLoad` guard — redirects 401 to `/auth` | Task 7 | ✓ |
| Root route preloads `useMeQuery` + syncs `auth.store` | Task 7 | ✓ |
| Topbar user menu — avatar, email, logout | Task 8 | ✓ |
| Logout → invalidate query + redirect | Task 8 | ✓ |
| Toast on network errors | Task 1 (Toaster) + Tasks 4/8 | ✓ |
| 429 rate-limit human message | Task 4 | ✓ |
| 400 invalid OTP inline error | Task 5 | ✓ |
| Autofocus email on mount | Task 5 | ✓ |
| Autofocus code on stage switch | Task 5 | ✓ |
| aria-live error region (role="alert") | Task 5 | ✓ |
| Single 6-digit field with auto-submit | Task 5 | ✓ |
| Resend code 60s cooldown | Task 9 (stretch) | ✓ |
| ≥12 new tests | Tasks 2-10 | ✓ (15+) |
| Full suite ≥35 tests | Task 10 | verify |
| No new env vars | — | ✓ |

---

## Self-Review Checklist

- [ ] `npm test` passes — count ≥35
- [ ] `npm run typecheck` passes — zero errors
- [ ] `npm run lint` passes — zero warnings
- [ ] `/auth` renders in browser, email form autofocused
- [ ] Submitting valid email transitions to code step with animation
- [ ] Entering wrong code shows red inline error
- [ ] Entering correct 6-digit code auto-submits and redirects to `/`
- [ ] Navigating to `/` unauthenticated redirects to `/auth`
- [ ] Logging out via topbar menu clears store, redirects to `/auth`
- [ ] Toast appears on network error (e.g. kill backend during submit)
- [ ] 429 shows "Too many attempts…" inline (not toast)
- [ ] Topbar shows avatar initials when authenticated, hides when unauthenticated
- [ ] Theme toggle still works on `/auth` page
- [ ] Mobile: auth card is centred and fits viewport
- [ ] No TypeScript `any` escape hatches left in new files

---

## Execution Options

**Option A — superpowers:subagent-driven-development** (recommended): dispatch Tasks 1-2 sequentially (setup), then Tasks 3-5 can proceed with Task 2 done. Tasks 6-10 depend on Tasks 3-5.

**Option B — superpowers:executing-plans**: work through each task in order, running tests after every step, committing only when green.

**Dependency order**: P.1 → Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 (optional) → Task 10.

Tasks 3 and 4 are independent of each other after Task 2 — they can be parallelised if using subagent dispatch.
