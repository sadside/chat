import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientLogger } from './clientLogger';

describe('clientLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('flushes on size threshold', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 2, flushIntervalMs: 99999 });
    logger.log('info', 'a', { traceId: 'tid-1' });
    logger.log('info', 'b', { traceId: 'tid-2' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.records).toHaveLength(2);
    expect(body.records[0].msg).toBe('a');
  });

  it('flushes on timer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 100, flushIntervalMs: 500 });
    logger.log('info', 'one', { traceId: 'tid' });
    vi.advanceTimersByTime(500);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it('requeues on fetch failure and retries next flush', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 1, flushIntervalMs: 99999 });
    logger.log('error', 'x', { traceId: 'tid' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await logger.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caps queue at 200 and drops oldest', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    const logger = createClientLogger({
      url: '/api/v1/_telemetry/logs',
      flushSize: 999,
      flushIntervalMs: 999999,
      maxQueue: 200,
    });
    for (let i = 0; i < 250; i++) {
      logger.log('info', `m-${i}`, { traceId: 'tid' });
    }
    expect(logger._queueSize()).toBe(200);
  });

  it('uses sendBeacon on flushSync', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    const logger = createClientLogger({ url: '/api/v1/_telemetry/logs', flushSize: 999, flushIntervalMs: 999999 });
    logger.log('info', 'bye', { traceId: 'tid' });
    logger.flushSync();
    expect(sendBeacon).toHaveBeenCalledOnce();
  });
});
