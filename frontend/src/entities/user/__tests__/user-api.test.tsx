import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useMeQuery } from '@/entities/user/api';
import { useIsAuthenticated } from '@/entities/user/model';
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

  it('returns null on 401', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useIsAuthenticated (model)', () => {
  it('reflects auth store state', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'x@y.com' });
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
    useAuthStore.getState().clearUser();
  });
});
