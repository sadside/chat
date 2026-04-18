import { createFileRoute } from '@tanstack/react-router';

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
  component: WelcomePage,
});
