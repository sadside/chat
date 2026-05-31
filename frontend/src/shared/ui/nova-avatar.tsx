interface Props {
  size?: number;
}

/**
 * Nova logo orb — the assistant's avatar in chat bubbles and the welcome
 * screen. A layered aurora gradient sphere with an inner light bloom and a
 * soft outer glow, rendered entirely in CSS so it scales crisply.
 */
export function NovaAvatar({ size = 26 }: Props) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="bg-accent-gradient absolute inset-0 rounded-[32%] shadow-[0_3px_10px_-2px_oklch(0.60_0.18_281/0.4)]" />
      {/* inner light bloom */}
      <div className="absolute inset-0 rounded-[32%] bg-[radial-gradient(circle_at_32%_28%,oklch(1_0_0/0.7),transparent_55%)]" />
      {/* spark mark */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute inset-0 m-auto text-white drop-shadow-sm"
        style={{ width: size * 0.56, height: size * 0.56 }}
      >
        <path
          d="M12 2.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5Z"
          fill="currentColor"
        />
        <circle cx="17.5" cy="17" r="1.4" fill="currentColor" opacity="0.9" />
      </svg>
    </div>
  );
}
