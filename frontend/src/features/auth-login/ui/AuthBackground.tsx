// frontend/src/features/auth-login/ui/AuthBackground.tsx
import { motion } from 'motion/react';

/** Floating gradient mesh + radial glow behind the auth card */
export function AuthBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Radial glow centred behind card */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full opacity-30 dark:opacity-20"
        style={{
          background:
            'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Blob 1 — violet/indigo, top-left */}
      <motion.div
        className="absolute rounded-full dark:[mix-blend-mode:screen] [mix-blend-mode:multiply]"
        style={{
          width: 520,
          height: 520,
          background:
            'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.35,
          top: '-10%',
          left: '-5%',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.08, 0.96, 1],
        }}
        transition={{
          duration: 24,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        }}
      />

      {/* Blob 2 — teal/emerald, bottom-right */}
      <motion.div
        className="absolute rounded-full dark:[mix-blend-mode:screen] [mix-blend-mode:multiply]"
        style={{
          width: 480,
          height: 480,
          background:
            'radial-gradient(circle, var(--color-accent-alt) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.3,
          bottom: '-8%',
          right: '-5%',
        }}
        animate={{
          x: [0, -35, 15, 0],
          y: [0, 25, -15, 0],
          scale: [1, 0.94, 1.06, 1],
        }}
        transition={{
          duration: 28,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
          delay: 4,
        }}
      />

      {/* Blob 3 — muted violet, top-right */}
      <motion.div
        className="absolute rounded-full dark:[mix-blend-mode:screen] [mix-blend-mode:multiply]"
        style={{
          width: 360,
          height: 360,
          background:
            'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.18,
          top: '20%',
          right: '-2%',
        }}
        animate={{
          x: [0, 20, -10, 0],
          y: [0, -20, 10, 0],
          scale: [1, 1.05, 0.97, 1],
        }}
        transition={{
          duration: 32,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
          delay: 8,
        }}
      />
    </div>
  );
}
