export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ClientLogRecord {
  ts: string;
  level: LogLevel;
  msg: string;
  traceId: string;
  source?: string;
  fields?: Record<string, string | number | boolean | null>;
}

export interface ClientLoggerOptions {
  url: string;
  flushSize?: number;
  flushIntervalMs?: number;
  maxQueue?: number;
}

export interface ClientLogger {
  log(level: LogLevel, msg: string, opts?: { traceId: string; [key: string]: unknown }): void;
  flush(): Promise<void>;
  flushSync(): void;
  _queueSize(): number;
}

export function createClientLogger(opts: ClientLoggerOptions): ClientLogger {
  const flushSize = opts.flushSize ?? 20;
  const flushIntervalMs = opts.flushIntervalMs ?? 5000;
  const maxQueue = opts.maxQueue ?? 200;

  let queue: ClientLogRecord[] = [];
  let flushing = false;

  const timer = setInterval(() => {
    void flush();
  }, flushIntervalMs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (timer as any).unref?.();

  function enqueue(rec: ClientLogRecord) {
    queue.push(rec);
    if (queue.length > maxQueue) {
      queue.splice(0, queue.length - maxQueue);
    }
    if (queue.length >= flushSize) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue;
    queue = [];
    try {
      await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batch }),
        credentials: 'include',
        keepalive: true,
      });
    } catch {
      queue = [...batch, ...queue].slice(-maxQueue);
    } finally {
      flushing = false;
    }
  }

  function flushSync(): void {
    if (queue.length === 0) return;
    const body = JSON.stringify({ records: queue });
    queue = [];
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(opts.url, new Blob([body], { type: 'application/json' }));
    }
  }

  function log(level: LogLevel, msg: string, meta?: { traceId: string; [key: string]: unknown }): void {
    const traceId = (meta?.traceId as string) ?? '';
    const fields: Record<string, string | number | boolean | null> = {};
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (k === 'traceId') continue;
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
          fields[k] = v as string | number | boolean | null;
        }
      }
    }
    enqueue({
      ts: new Date().toISOString(),
      level,
      msg,
      traceId,
      source: 'frontend',
      fields,
    });
  }

  return { log, flush, flushSync, _queueSize: () => queue.length };
}
