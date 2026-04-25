import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is a ky instance (has .get method)', () => {
    expect(typeof apiClient.get).toBe('function');
  });

  it('exposes extend method', () => {
    expect(typeof apiClient.extend).toBe('function');
  });

  it('adds X-Trace-Id header on each request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiClient.get('health').json();
    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.headers.get('X-Trace-Id')).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('reuses explicit traceId if provided via options', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const tid = '11111111-2222-3333-4444-555555555555';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (apiClient as any).get('health', { traceId: tid }).json();
    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.headers.get('X-Trace-Id')).toBe(tid);
  });
});
