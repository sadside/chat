// frontend/src/pages/auth.tsx
import { createFileRoute } from '@tanstack/react-router';
import { AuthCard } from '@/features/auth-login/ui/AuthCard';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { useEffect } from 'react';

export function AuthPage() {
  const reset = useOtpFlowStore((s) => s.reset);

  // Reset flow state when page mounts (e.g. after logout redirect)
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      {/* Brand wordmark */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-black tracking-tight text-[--color-foreground]">
          Nova
        </span>
      </div>
      <AuthCard />
    </div>
  );
}

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});
