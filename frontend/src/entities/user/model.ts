// frontend/src/entities/user/model.ts
import { useAuthStore, type AuthUser } from '@/shared/store/auth-store';

/** Returns current user from auth store (optimistic, pre-query). */
export function useCurrentUser(): AuthUser | null {
  return useAuthStore((s) => s.user);
}

/** Returns true if the auth store has a user. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.isAuthenticated);
}

/** Derives user initials for avatar rendering (e.g. "JO" from "john@domain"). */
export function getUserInitials(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
