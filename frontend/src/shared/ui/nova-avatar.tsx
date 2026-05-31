import { Sparkles } from 'lucide-react';

interface Props {
  size?: number;
}

/**
 * Small Nova logo badge — used as the assistant's avatar in chat bubbles
 * and on the welcome screen. Gradient from violet → magenta (oklch 280° → 320°).
 */
export function NovaAvatar({ size = 24 }: Props) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.65_0.20_280)] to-[oklch(0.55_0.20_320)] text-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Sparkles className="h-3 w-3" />
    </div>
  );
}
