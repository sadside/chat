import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url('VITE_API_URL must be a valid URL'),
});

const _parsed = envSchema.safeParse({
  VITE_API_URL: import.meta.env['VITE_API_URL'],
});

if (!_parsed.success) {
  const msg = _parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`[nova] Invalid environment variables:\n${msg}`);
}

export const env = _parsed.data;
