import { cn } from '@/shared/lib/utils';

interface SidebarPlaceholderProps {
  className?: string;
}

export function SidebarPlaceholder({ className }: SidebarPlaceholderProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-[--color-border] bg-[--color-background] p-4',
        className,
      )}
    >
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[--color-muted-foreground]">
        Navigation
      </div>
      <div className="flex-1 space-y-1">
        {/* Chat list will be rendered here in Plan 4 */}
        <div className="rounded-md px-3 py-2 text-sm text-[--color-muted-foreground]">
          No chats yet
        </div>
      </div>
    </aside>
  );
}
