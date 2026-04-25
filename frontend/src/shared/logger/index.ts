export { newTraceId } from './traceId';
export { createClientLogger } from './clientLogger';
export type { LogLevel, ClientLogRecord, ClientLogger } from './clientLogger';

import { createClientLogger } from './clientLogger';
import { env } from '@/shared/config/env';

export const clientLogger = createClientLogger({
  url: `${env.VITE_API_URL.replace(/\/$/, '')}/_telemetry/logs`,
});
