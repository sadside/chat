// frontend/src/widgets/topbar/user-menu.tsx
import { useNavigate } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { useCurrentUser } from '@/entities/user/model';
import { getUserInitials } from '@/entities/user/model';
import { useLogoutMutation } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';

export function UserMenu() {
  const user = useCurrentUser();
  const clearUser = useAuthStore((s) => s.clearUser);
  const logout = useLogoutMutation();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = getUserInitials(user.email);

  async function handleLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      // Ignore — cookie may already be gone
    } finally {
      clearUser();
      await navigate({ to: '/auth' });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[--color-accent] text-xs font-bold text-[--color-accent-foreground] hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring]"
          aria-label="User menu"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={logout.isPending}
          className="text-red-400 focus:text-red-300"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
