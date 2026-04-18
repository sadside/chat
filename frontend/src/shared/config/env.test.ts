import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('env loader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports VITE_API_URL when set', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8080/api/v1');
    const { env } = await import('./env');
    expect(env.VITE_API_URL).toBe('http://localhost:8080/api/v1');
  });

  it('throws when VITE_API_URL is missing', async () => {
    vi.stubEnv('VITE_API_URL', '');
    await expect(import('./env')).rejects.toThrow();
  });
});
