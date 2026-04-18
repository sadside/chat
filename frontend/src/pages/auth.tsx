// frontend/src/pages/auth.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AuthCard } from '@/features/auth-login/ui/AuthCard';
import { AuthBackground } from '@/features/auth-login/ui/AuthBackground';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { useEffect } from 'react';

export function AuthPage() {
  const reset = useOtpFlowStore((s) => s.reset);

  // Reset flow state when page mounts (e.g. after logout redirect)
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-[--color-background]">
      <AuthBackground />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Brand wordmark */}
        <div className="text-center">
          <span
            className="text-4xl font-black tracking-tight select-none bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent-alt) 100%)',
            }}
          >
            ·Nova
          </span>
          <p className="mt-1 text-xs text-[--color-muted-foreground] tracking-wide uppercase">
            Локальный AI-чат с приватностью.
          </p>
        </div>

        <AuthCard />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});
