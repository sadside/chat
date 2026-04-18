import { describe, it, expect, beforeEach } from 'vitest';
import { useStreamStore } from '@/shared/store/stream-store';

describe('stream-store', () => {
  beforeEach(() => {
    useStreamStore.getState().reset();
  });

  it('starts in idle state', () => {
    expect(useStreamStore.getState().status).toBe('idle');
  });

  it('startStream sets chatId and optimistic message', () => {
    useStreamStore.getState().startStream('chat-1', 'Hello');
    const state = useStreamStore.getState();
    expect(state.chatId).toBe('chat-1');
    expect(state.status).toBe('streaming');
    expect(state.optimisticUserMessage?.content).toBe('Hello');
  });

  it('appendDelta accumulates content', () => {
    useStreamStore.getState().startStream('chat-1', 'q');
    useStreamStore.getState().appendDelta('Hello ');
    useStreamStore.getState().appendDelta('world');
    expect(useStreamStore.getState().assistantContent).toBe('Hello world');
  });

  it('finishStream transitions to done', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().finishStream('Final answer', false);
    const s = useStreamStore.getState();
    expect(s.status).toBe('done');
    expect(s.assistantContent).toBe('Final answer');
    expect(s.aborted).toBe(false);
  });

  it('setError transitions to error', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().setError('LLM_UNAVAILABLE');
    expect(useStreamStore.getState().status).toBe('error');
    expect(useStreamStore.getState().error).toBe('LLM_UNAVAILABLE');
  });

  it('reset returns to idle', () => {
    useStreamStore.getState().startStream('c', 'q');
    useStreamStore.getState().reset();
    expect(useStreamStore.getState().status).toBe('idle');
    expect(useStreamStore.getState().chatId).toBeNull();
  });
});
