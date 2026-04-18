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
