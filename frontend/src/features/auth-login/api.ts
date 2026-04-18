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
