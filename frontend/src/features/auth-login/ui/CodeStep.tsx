// frontend/src/features/auth-login/ui/CodeStep.tsx
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/ui/input-otp';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useOtpFlow } from '@/features/auth-login/model';

const schema = z.object({
  code: z
    .string()
    .length(6, 'Код должен содержать ровно 6 цифр.')
    .regex(/^\d{6}$/, 'Код должен состоять из 6 цифр.'),
});
type FormValues = z.infer<typeof schema>;

export function CodeStep() {
  const { email, submitCode, isLoading, error, reset, resendCode } = useOtpFlow();
  const autoSubmittedRef = useRef(false);
  const [cooldown, setCooldown] = useState(60);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' });

  const codeValue = watch('code', '');

  useEffect(() => {
    autoSubmittedRef.current = false;
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Auto-submit when exactly 6 digits are typed
  useEffect(() => {
    if (codeValue?.length === 6 && /^\d{6}$/.test(codeValue) && !autoSubmittedRef.current) {
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-[--color-muted-foreground] text-center">
        Мы отправили 6-значный код на{' '}
        <span className="font-medium text-[--color-foreground]">{email}</span>.
      </p>

      <div className="flex flex-col items-center gap-2">
        <Controller
          name="code"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <InputOTP
              maxLength={6}
              value={field.value}
              onChange={field.onChange}
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={isLoading}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? 'code-error' : undefined}
              aria-label="Код подтверждения"
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}
        />
        {fieldError && (
          <p id="code-error" role="alert" aria-live="polite" className="text-sm text-red-400 text-center">
            {fieldError}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Проверяем…
          </>
        ) : (
          'Подтвердить'
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={reset}
        className="w-full"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Использовать другой e-mail
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || isLoading}
        className="text-sm text-[--color-muted-foreground] hover:text-[--color-foreground] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-center"
      >
        {cooldown > 0 ? `Отправить снова через ${cooldown}с` : 'Отправить код снова'}
      </button>
    </form>
  );
}
