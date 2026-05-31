import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  content: string;
  /** When true, panel auto-opens (used during streaming so user sees thoughts). */
  streaming?: boolean;
}

/**
 * Collapsible panel for assistant `<think>...</think>` blocks emitted by
 * reasoning-capable models (deepseek-r1, qwq, etc.).
 */
export function ReasoningPanel({ content, streaming = false }: Props) {
  const [open, setOpen] = useState(streaming);
  if (!content.trim()) return null;
  return (
    <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em]"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Brain className="h-3 w-3" />
        Размышления
        {streaming && (
          <span className="ml-2 inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
        )}
      </button>
      {open && (
        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed opacity-80">
          {content}
        </pre>
      )}
    </div>
  );
}

/** Extract reasoning block + answer from assistant content. */
export function splitReasoning(content: string): { reasoning: string; answer: string } {
  const m = content.match(/^<think>([\s\S]*?)(?:<\/think>|$)/);
  if (!m) return { reasoning: '', answer: content };
  const reasoning = m[1] ?? '';
  const closedIdx = content.indexOf('</think>');
  const answer = closedIdx >= 0 ? content.slice(closedIdx + '</think>'.length) : '';
  return { reasoning, answer };
}
