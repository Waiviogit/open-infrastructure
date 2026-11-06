import { createHmac } from 'node:crypto';

import type { BrowserContext } from '@playwright/test';

/**
 * Production `instant()` rig (see apps/web-e2e/instant-nav.rig.md): `next build` with the
 * Instant Navigation testing API + `next start`, real query-api from `dist/`, test Postgres.
 * Ports differ from `next dev` (3000), the editor rig (3991) and the verify skill (3991/7991).
 */
export const INSTANT_WEB_PORT = 3993;
export const INSTANT_QUERY_API_PORT = 7993;
export const INSTANT_BASE_URL = `http://localhost:${INSTANT_WEB_PORT}`;
export const INSTANT_QUERY_API_URL = `http://127.0.0.1:${INSTANT_QUERY_API_PORT}`;
export const INSTANT_JWT_SECRET = 'web-instant-e2e-secret-0123456789';

/**
 * Test Postgres + Redis (`pnpm test:db:up`). Deliberately NOT read from `POSTGRES_*` / `REDIS_URI`:
 * Nx loads the developer `.env` (dev database) into the environment. Override with the
 * `INSTANT_E2E_*` names only (CI). The rig refuses any database other than `test`.
 */
export const INSTANT_DB_ENV = {
  POSTGRES_HOST: process.env['INSTANT_E2E_POSTGRES_HOST'] ?? '127.0.0.1',
  POSTGRES_PORT: process.env['INSTANT_E2E_POSTGRES_PORT'] ?? '55432',
  POSTGRES_DATABASE: 'test',
  POSTGRES_USER: process.env['INSTANT_E2E_POSTGRES_USER'] ?? 'test',
  POSTGRES_PASSWORD: process.env['INSTANT_E2E_POSTGRES_PASSWORD'] ?? 'test',
  REDIS_URI: process.env['INSTANT_E2E_REDIS_URI'] ?? 'redis://127.0.0.1:56379',
} as const;

/** Viewer whose followed objects are seeded (see support/seed.sql). */
export const INSTANT_VIEWER = 'carol';

const TOKEN_TTL_SEC = 3600;

function base64Url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function accessToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({ typ: 'access', sub: username, iat: now, exp: now + TOKEN_TTL_SEC }),
  );
  const signature = createHmac('sha256', INSTANT_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Session cookie only — never navigates the page (safe before `instant()`). */
export async function signIn(context: BrowserContext, username = INSTANT_VIEWER): Promise<void> {
  await context.addCookies([
    { name: 'odl_access', value: accessToken(username), url: INSTANT_BASE_URL },
  ]);
}
