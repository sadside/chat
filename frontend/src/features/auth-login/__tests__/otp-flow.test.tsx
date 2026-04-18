import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useOtpFlow, useOtpFlowStore } from '@/features/auth-login/model';
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
  beforeEach(() => {
    useOtpFlowStore.getState().reset();
    mockNavigate.mockReset();
  });
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
