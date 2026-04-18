// frontend/src/features/auth-login/ui/AuthCard.tsx
import { AnimatePresence, motion } from 'motion/react';
import { EmailStep } from './EmailStep';
import { CodeStep } from './CodeStep';
import { useOtpFlowStore } from '@/features/auth-login/model';
import { CheckCircle2 } from 'lucide-react';

export function AuthCard() {
  const stage = useOtpFlowStore((s) => s.stage);

  return (
    <div className="w-full max-w-sm rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to Nova</h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">
          {stage === 'email-input' && 'Enter your email to receive a login code.'}
          {stage === 'code-input' && 'Check your inbox.'}
          {stage === 'success' && 'Signed in successfully!'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'email-input' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
          >
            <EmailStep />
          </motion.div>
        )}
        {stage === 'code-input' && (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <CodeStep />
          </motion.div>
        )}
        {stage === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3 py-4 text-center"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm text-[--color-muted-foreground]">Redirecting…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
