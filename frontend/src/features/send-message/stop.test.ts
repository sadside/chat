import { describe, it, expect, beforeEach } from 'vitest';
import {
  useStreamStore,
  setActiveController,
  abortActiveStream,
  getActiveController,
} from '@/shared/store/stream-store';

describe('stop wiring', () => {
  beforeEach(() => {
    useStreamStore.getState().reset();
    setActiveController(null);
  });

  it('setStopping transitions only from streaming', () => {
    useStreamStore.getState().setStopping();
    expect(useStreamStore.getState().status).toBe('idle');
    useStreamStore.getState().startStream('c', 'hi');
    useStreamStore.getState().setStopping();
    expect(useStreamStore.getState().status).toBe('stopping');
  });

  it('abortActiveStream signals the registered controller', () => {
    const c = new AbortController();
    setActiveController(c);
    abortActiveStream('user');
    expect(c.signal.aborted).toBe(true);
    expect(getActiveController()).toBeNull();
  });
});
