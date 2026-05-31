import { useEffect, useState } from 'react';
import { SLASH_COMMANDS, type SlashCommand } from './config';

interface Props {
  query: string; // text after the leading '/'
  onPick: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashPopover({ query, onPick, onClose }: Props) {
  const list = SLASH_COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.id.startsWith(query.toLowerCase()),
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, list.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const cmd = list[active];
        if (cmd) {
          e.preventDefault();
          onPick(cmd);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, active, onPick, onClose]);

  if (list.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur-xl">
      {list.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onMouseEnter={() => setActive(i)}
          onClick={() => onPick(c)}
          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors ${
            i === active ? 'bg-primary/10' : 'hover:bg-muted'
          }`}
        >
          <span className="font-medium text-foreground">{c.label}</span>
          <span className="text-xs text-muted-foreground">{c.description}</span>
        </button>
      ))}
    </div>
  );
}
