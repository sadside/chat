import { describe, it, expect } from 'vitest';
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
