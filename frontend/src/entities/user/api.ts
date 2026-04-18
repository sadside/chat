// frontend/src/entities/user/api.ts
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AuthUser } from '@/shared/store/auth-store';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

// Backend `GET /auth/me` returns `{ user: { id, email } }` (MeOut schema).
interface MeResponse {
  user: AuthUser;
}

export const meQueryOptions = queryOptions<AuthUser | null>({
  queryKey: ME_QUERY_KEY,
  queryFn: async () => {
    try {
      const res = await apiClient.get('auth/me').json<MeResponse>();
      return res.user;
    } catch (err: unknown) {
      // 401 is expected when unauthenticated — treat as null user
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return null;
      throw err;
    }
  },
  staleTime: 5 * 60 * 1000, // 5 min
  retry: false,
});

/**
 * Fetches current user. Returns null (not error) on 401 —
 * callers check `data` to determine auth state.
 */
export function useMeQuery() {
  return useQuery(meQueryOptions);
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('auth/logout').json<void>(),
    onSuccess: () => {
      qc.setQueryData(ME_QUERY_KEY, null);
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
