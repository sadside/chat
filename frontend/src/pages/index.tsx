import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';

function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[--color-foreground]">
          Nova is ready
        </h1>
        <p className="text-sm text-[--color-muted-foreground]">
          Your AI assistant is standing by. Start a new chat to begin.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Check auth — redirect to /auth if unauthenticated
    try {
      const user = await queryClient.ensureQueryData(meQueryOptions);
      if (!user) throw redirect({ to: '/auth' });
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) throw err;
      throw redirect({ to: '/auth' });
    }
  },
  component: WelcomePage,
});
