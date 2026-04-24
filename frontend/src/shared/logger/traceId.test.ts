import { describe, it, expect } from 'vitest';
import { newTraceId } from './traceId';

describe('newTraceId', () => {
  it('returns a uuid-shaped string', () => {
    const tid = newTraceId();
    expect(tid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('returns unique ids', () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
  });
});
