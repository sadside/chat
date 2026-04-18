import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    // Stage 1: email — Russian heading
    expect(screen.getByText(/войти в nova/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/e-mail/i), 'login@example.com');
    await user.click(screen.getByRole('button', { name: /продолжить/i }));

    // Stage 2: code — OTP input present
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /код подтверждения/i })).toBeInTheDocument()
    );
    expect(screen.getByText(/login@example\.com/)).toBeInTheDocument();

    // Auto-submit on 6 digits via the OTP input
    const otpInput = screen.getByRole('textbox', { name: /код подтверждения/i });
    await user.type(otpInput, '123456');

    // Stage 3: success
    await waitFor(() => expect(screen.getByText(/готово/i)).toBeInTheDocument());
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
    await user.type(screen.getByLabelText(/e-mail/i), 'x@example.com');
    await user.click(screen.getByRole('button', { name: /продолжить/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i)
    );
  });

  it('invalid code shows inline error and stays on code step', async () => {
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/e-mail/i), 'y@example.com');
    await user.click(screen.getByRole('button', { name: /продолжить/i }));
    await waitFor(() =>
      screen.getByRole('textbox', { name: /код подтверждения/i })
    );

    server.use(
      http.post('http://localhost:8080/api/v1/auth/verify-otp', () =>
        HttpResponse.json({ detail: 'Invalid or expired code' }, { status: 400 })
      )
    );
    const otpInput = screen.getByRole('textbox', { name: /код подтверждения/i });
    await user.type(otpInput, '000000');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid|expired/i)
    );
    expect(useOtpFlowStore.getState().stage).toBe('code-input');
  });

  it('"Использовать другой e-mail" resets to email step', async () => {
    render(<AuthCard />, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/e-mail/i), 'z@example.com');
    await user.click(screen.getByRole('button', { name: /продолжить/i }));
    await waitFor(() =>
      screen.getByRole('textbox', { name: /код подтверждения/i })
    );
    await user.click(screen.getByRole('button', { name: /использовать другой e-mail/i }));
    expect(useOtpFlowStore.getState().stage).toBe('email-input');
    await waitFor(() => expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument());
  });
});
