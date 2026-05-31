import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { TOUR_STEPS, ONBOARDING_KEY } from './config';

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      // Small delay so layout settles after first render.
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const step = TOUR_STEPS[stepIdx];
    if (!step) return;
    const el = document.querySelector(step.anchor) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, stepIdx]);

  if (!open) return null;
  const step = TOUR_STEPS[stepIdx];
  if (!step) return null;

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setOpen(false);
  };

  // Position the tooltip above or below the anchor based on viewport space.
  const placeAbove = rect ? rect.top > window.innerHeight / 2 : false;
  const tooltipTop = rect
    ? placeAbove
      ? Math.max(12, rect.top - 12)
      : Math.min(window.innerHeight - 200, rect.bottom + 14)
    : window.innerHeight / 2;
  const tooltipLeft = rect
    ? Math.max(12, Math.min(window.innerWidth - 340, rect.left))
    : window.innerWidth / 2 - 160;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[300]">
      <AnimatePresence>
        {rect && (
          <motion.div
            key={`spot-${stepIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute rounded-xl ring-2 ring-primary/70"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        key={`card-${stepIdx}`}
        initial={{ opacity: 0, y: placeAbove ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="absolute w-[320px] rounded-xl border border-border bg-card p-4 shadow-2xl"
        style={{
          left: tooltipLeft,
          top: placeAbove ? undefined : tooltipTop,
          bottom: placeAbove ? window.innerHeight - rect!.top + 12 : undefined,
        }}
      >
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {step.title}
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">
          {step.body}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={finish}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Пропустить
            </button>
            {stepIdx < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setStepIdx((i) => i + 1)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Дальше
              </button>
            ) : (
              <button
                onClick={finish}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Готово
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
