// frontend/src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8080/api/v1';

export const handlers = [
  // GET /auth/me — authenticated by default
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ id: 'user-1', email: 'test@example.com' })
  ),

  // POST /auth/request-otp
  http.post(`${BASE}/auth/request-otp`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // POST /auth/verify-otp
  http.post(`${BASE}/auth/verify-otp`, () =>
    HttpResponse.json({ id: 'user-1', email: 'test@example.com' })
  ),

  // POST /auth/logout
  http.post(`${BASE}/auth/logout`, () =>
    new HttpResponse(null, { status: 204 })
  ),
];
