import { createHmac } from 'node:crypto';

import type { BrowserContext } from '@playwright/test';

/** Same value the editor e2e web server is started with (`playwright.editor.config.ts`). */
export const EDITOR_E2E_JWT_SECRET = 'web-editor-e2e-secret-0123456789';

export const EDITOR_E2E_BASE_URL = 'http://localhost:3991';

const TOKEN_TTL_SEC = 3600;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** HS256 access token in the shape `resolve-session-user.ts` accepts (`typ: access`, `sub`). */
export function accessToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({ typ: 'access', sub: username, iat: now, exp: now + TOKEN_TTL_SEC }),
  );
  const signature = createHmac('sha256', EDITOR_E2E_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Signs `username` in for the editor e2e web server (no auth-api involved). */
export async function signIn(context: BrowserContext, username: string): Promise<void> {
  await context.addCookies([
    { name: 'odl_access', value: accessToken(username), url: EDITOR_E2E_BASE_URL },
  ]);
}
