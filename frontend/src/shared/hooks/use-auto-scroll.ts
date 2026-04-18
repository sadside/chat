import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns a ref to attach to the bottom sentinel element.
 * Scrolls the container to the sentinel when `deps` change,
 * but ONLY if the sentinel is already near the viewport (user hasn't
 * scrolled up). Uses IntersectionObserver to track visibility.
 */
export function useAutoScroll(deps: unknown[]) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) nearBottomRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if ((nearBottomRef.current || force) && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Scroll whenever deps change (new delta, new message)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToBottom(); }, deps);

  return { anchorRef, scrollToBottom };
}
