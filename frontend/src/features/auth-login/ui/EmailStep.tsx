// frontend/src/features/auth-login/ui/EmailStep.tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2 } from 'lucide-react';
import { useOtpFlow } from '@/features/auth-login/model';

const schema = z.object({
  email: z.string().email('Введите корректный e-mail.'),
});
type FormValues = z.infer<typeof schema>;

export function EmailStep() {
  const { submitEmail, isLoading, error } = useOtpFlow();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  async function onSubmit(values: FormValues) {
    await submitEmail(values.email);
  }

  const fieldError = errors.email?.message || error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email-input">E-mail</Label>
        <Input
          id="email-input"
          type="email"
          autoComplete="email"
          placeholder="вы@example.com"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'email-error' : undefined}
          disabled={isLoading}
          {...register('email')}
        />
        {fieldError && (
          <p id="email-error" role="alert" className="text-sm text-red-400">
            {fieldError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Отправляем…
          </>
        ) : (
          'Продолжить'
        )}
      </Button>
    </form>
  );
}
