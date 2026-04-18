import { useTheme } from 'next-themes';

export interface UseToggleThemeReturn {
  theme: string | undefined;
  isDark: boolean;
  toggle: () => void;
}

export function useToggleTheme(): UseToggleThemeReturn {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return { theme, isDark, toggle };
}
