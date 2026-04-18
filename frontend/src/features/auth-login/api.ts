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

// Backend returns `{ user: { id, email } }` (MeOut schema).
interface VerifyOtpResponse {
  user: AuthUser;
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const res = await apiClient
        .post('auth/verify-otp', { json: { email, code } })
        .json<VerifyOtpResponse>();
      return res.user;
    },
  });
}
