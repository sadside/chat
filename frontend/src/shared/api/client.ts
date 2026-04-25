import ky, { type KyRequest } from 'ky';
import { env } from '@/shared/config/env';
import { clientLogger, newTraceId } from '@/shared/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOptions = Record<string, any>;

// Ky's options object is frozen in newer versions, so we cannot stash per-request
// state on it. Keep a side-channel keyed on the Request instance instead.
const traceByRequest = new WeakMap<Request, string>();

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
    beforeRequest: [
      (request: KyRequest, options: unknown) => {
        const opts = options as AnyOptions;
        const traceId: string = opts?.traceId ?? newTraceId();
        traceByRequest.set(request, traceId);
        request.headers.set('X-Trace-Id', traceId);
      },
    ],
    afterResponse: [
      (request, _options, response) => {
        const traceId: string = traceByRequest.get(request) ?? 'unknown';
        if (!response.ok) {
          clientLogger.log('error', 'api.error', {
            traceId,
            status: response.status,
            method: request.method,
            path: new URL(request.url).pathname,
          });
        }
        return response;
      },
    ],
    beforeError: [
      async (error) => {
        const { response, request } = error;
        const traceId: string = request ? traceByRequest.get(request) ?? 'unknown' : 'unknown';
        if (!response) {
          clientLogger.log('error', 'api.network_error', {
            traceId,
            method: request?.method ?? 'UNKNOWN',
            path: request ? new URL(request.url).pathname : 'unknown',
            error: error.message,
          });
        }
        if (response) {
          try {
            const body = (await response.clone().json()) as { detail?: string };
            if (body.detail) error.message = body.detail;
          } catch {
            /* keep message */
          }
        }
        return error;
      },
    ],
  },
});
