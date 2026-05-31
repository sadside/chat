// frontend/src/features/auth-login/ui/AuthCard.tsx
import { AnimatePresence, motion } from 'motion/react';
import { EmailStep } from './EmailStep';
import { CodeStep } from './CodeStep';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { CheckCircle2 } from 'lucide-react';

const springEase = [0.22, 1, 0.36, 1] as const;

export function AuthCard() {
  const stage = useOtpFlowStore((s) => s.stage);

  return (
    <div
      className={[
        'relative w-full max-w-sm overflow-hidden',
        'rounded-2xl border border-border',
        'bg-card/90 backdrop-blur-sm',
        'p-8 shadow-2xl',
        // tinted shadow via ring
        'ring-1 ring-primary/10',
      ].join(' ')}
      style={{
        boxShadow:
          '0 20px 60px -12px color-mix(in oklch, var(--color-primary) 18%, transparent), 0 4px 16px -4px rgba(0,0,0,0.12)',
      }}
    >
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {stage === 'code-input' ? 'Проверьте почту' : 'Войти в Nova'}
        </h1>
        <p
          aria-live="polite"
          className="mt-1 text-sm text-muted-foreground"
        >
          {stage === 'email-input' &&
            'Введите e-mail, чтобы получить код входа.'}
          {stage === 'code-input' && ''}
          {stage === 'success' && 'Готово! Перенаправляем…'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'email-input' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: -16, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 16, y: -4 }}
            transition={{ duration: 0.25, ease: springEase }}
          >
            <EmailStep />
          </motion.div>
        )}
        {stage === 'code-input' && (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 16, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -16, y: -4 }}
            transition={{ duration: 0.25, ease: springEase }}
          >
            <CodeStep />
          </motion.div>
        )}
        {stage === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: springEase }}
            className="flex flex-col items-center gap-3 py-4 text-center"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm text-muted-foreground">
              Готово! Перенаправляем…
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
