import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

describe('MSW server', () => {
  it('intercepts GET /health', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/health', () =>
        HttpResponse.json({ status: 'ok' })
      )
    );
    const res = await fetch('http://localhost:8080/api/v1/health');
    const data = await res.json();
    expect(data.status).toBe('ok');
  });
});
