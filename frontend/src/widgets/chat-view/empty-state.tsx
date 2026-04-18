import { Sparkles } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  'Explain async/await in JavaScript in simple terms',
  'Write a Python function to parse a CSV file',
  'What is the difference between REST and GraphQL?',
  'Give me a recipe for chocolate chip cookies',
];

interface EmptyStateProps {
  onPromptClick?: ((prompt: string) => void) | undefined;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Welcome to Nova</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Start a conversation. Ask anything.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-md">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick?.(prompt)}
            className="rounded-xl border bg-muted/50 px-4 py-3 text-left text-sm
                       hover:bg-muted transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
