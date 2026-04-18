import { describe, it, expect } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  it('is a ky instance (has .get method)', () => {
    expect(typeof apiClient.get).toBe('function');
  });

  it('exposes extend method', () => {
    expect(typeof apiClient.extend).toBe('function');
  });
});
