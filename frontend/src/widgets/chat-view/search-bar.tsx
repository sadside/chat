import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  resultCount: number | null;
}

export function ChatSearchBar({ value, onChange, resultCount }: Props) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск по сообщениям…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label="Поиск по чату"
      />
      {value && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {resultCount ?? 0}
          </span>
          <button
            onClick={() => onChange('')}
            aria-label="Очистить"
            className="rounded p-1 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
