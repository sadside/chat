import '@testing-library/jest-dom';
import { server } from '@/test/msw/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom does not implement ResizeObserver — provide a stub for input-otp and similar libs
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// input-otp's password-manager badge uses elementFromPoint which jsdom doesn't support
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}

// jsdom does not implement window.matchMedia — provide a stub for all tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
