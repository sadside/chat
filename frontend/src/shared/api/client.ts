import ky from 'ky';
import { env } from '@/shared/config/env';

export const apiClient = ky.create({
  prefixUrl: env.VITE_API_URL,
  credentials: 'include',
  timeout: 30_000,
  retry: {
    limit: 2,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error;
        if (response) {
          try {
            const body = (await response.clone().json()) as { detail?: string };
            if (body.detail) {
              error.message = body.detail;
            }
          } catch {
            // ignore JSON parse errors — keep original message
          }
        }
        return error;
      },
    ],
  },
});
