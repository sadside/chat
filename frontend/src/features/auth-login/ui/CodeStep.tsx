// frontend/src/features/auth-login/ui/CodeStep.tsx
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useOtpFlow } from '@/features/auth-login/model';

const schema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits.')
    .regex(/^\d{6}$/, 'Code must be 6 digits.'),
});
type FormValues = z.infer<typeof schema>;

export function CodeStep() {
  const { email, submitCode, isLoading, error, reset, resendCode } = useOtpFlow();
  const autoSubmittedRef = useRef(false);
  const [cooldown, setCooldown] = useState(60);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setFocus,
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' });

  const codeValue = watch('code', '');

  useEffect(() => {
    setFocus('code');
    autoSubmittedRef.current = false;
  }, [setFocus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Auto-submit when exactly 6 digits are typed
  useEffect(() => {
    if (codeValue.length === 6 && /^\d{6}$/.test(codeValue) && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitCode(codeValue);
    }
  }, [codeValue, submitCode]);

  async function onSubmit(values: FormValues) {
    await submitCode(values.code);
  }

  async function handleResend() {
    setCooldown(60);
    await resendCode();
  }

  const fieldError = errors.code?.message || error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-[--color-muted-foreground]">
        We sent a 6-digit code to <span className="font-medium text-[--color-foreground]">{email}</span>.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code-input">Verification code</Label>
        <Input
          id="code-input"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="123456"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'code-error' : undefined}
          disabled={isLoading}
          {...register('code')}
        />
        {fieldError && (
          <p id="code-error" role="alert" className="text-sm text-red-400">
            {fieldError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          'Verify'
        )}
      </Button>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1 text-sm text-[--color-muted-foreground] hover:text-[--color-foreground] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Use a different email
      </button>
      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || isLoading}
        className="text-sm text-[--color-muted-foreground] hover:text-[--color-foreground] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  );
}
