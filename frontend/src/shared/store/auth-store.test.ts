import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('starts with no user', () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setUser sets user and isAuthenticated', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'test@example.com' });
    expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('clearUser resets state', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'test@example.com' });
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
