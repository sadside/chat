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

  async function resendCode() {
    if (!email) return;
    await submitEmail(email);
  }

  return { stage, email, error, isLoading, submitEmail, submitCode, reset, resendCode };
}
