// frontend/src/pages/auth.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AuthCard } from '@/features/auth-login/ui/AuthCard';
import { AuthBackground } from '@/features/auth-login/ui/AuthBackground';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { NovaAvatar } from '@/shared/ui/nova-avatar';
import { useEffect } from 'react';

export function AuthPage() {
  const reset = useOtpFlowStore((s) => s.reset);

  // Reset flow state when page mounts (e.g. after logout redirect)
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-background">
      <AuthBackground />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Brand wordmark */}
        <div className="flex flex-col items-center text-center">
          <NovaAvatar size={44} />
          <span className="text-accent-gradient font-display mt-4 select-none text-4xl font-semibold tracking-tight">
            Nova
          </span>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Локальный AI-чат с приватностью
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
