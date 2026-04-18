import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoScroll } from '../use-auto-scroll';

const disconnectMock = vi.fn();
const observeMock = vi.fn();

beforeEach(() => {
  disconnectMock.mockReset();
  observeMock.mockReset();
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation((_cb) => {
    return { observe: observeMock, disconnect: disconnectMock, unobserve: vi.fn() };
  }));
});

describe('useAutoScroll', () => {
  it('returns anchorRef and scrollToBottom', () => {
    const { result } = renderHook(() => useAutoScroll([]));
    expect(result.current.anchorRef).toBeDefined();
    expect(typeof result.current.scrollToBottom).toBe('function');
  });

  it('IntersectionObserver is defined in test environment', () => {
    // Verify our stub is in place
    expect(typeof IntersectionObserver).toBe('function');
  });

  it('anchorRef is a ref object', () => {
    const { result } = renderHook(() => useAutoScroll([]));
    // anchorRef should be a React ref with current property
    expect(result.current.anchorRef).toHaveProperty('current');
  });
});
