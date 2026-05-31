import { describe, it, expect, beforeEach } from 'vitest';
import {
  useStreamStore,
  setActiveController,
  getActiveController,
  abortActiveStream,
} from '@/shared/store/stream-store';

describe('stream race protection', () => {
  beforeEach(() => {
    useStreamStore.getState().reset();
    setActiveController(null);
  });

  it('abortActiveStream noops when no controller registered', () => {
    expect(() => abortActiveStream()).not.toThrow();
    expect(getActiveController()).toBeNull();
  });

  it('abortActiveStream aborts and clears the registered controller', () => {
    const ctrl = new AbortController();
    setActiveController(ctrl);
    expect(getActiveController()).toBe(ctrl);
    abortActiveStream('test');
    expect(ctrl.signal.aborted).toBe(true);
    expect(getActiveController()).toBeNull();
  });

  it('switching controllers aborts the previous one when callers go through abortActiveStream', () => {
    const a = new AbortController();
    setActiveController(a);
    abortActiveStream();
    const b = new AbortController();
    setActiveController(b);
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
    expect(getActiveController()).toBe(b);
  });
});
