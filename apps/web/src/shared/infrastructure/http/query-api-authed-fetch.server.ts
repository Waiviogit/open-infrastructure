import 'server-only';

import { cookies } from 'next/headers';

import { env } from '@/config/env';
import { fail, ok, type Result } from '@/shared/domain/result';
import { AUTH_ACCESS_COOKIE } from '@/shared/infrastructure/auth/session-cookie';

const HTTP_NO_CONTENT = 204;

export type QueryApiAuthedError =
  | { code: 'unauthorized' }
  /** `apiCode` is the error body's `code` field when query-api sends one (e.g. `activity_notes_limit_reached`). */
  | { code: 'http_error'; status: number; apiCode?: string }
  | { code: 'network' };

async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(AUTH_ACCESS_COOKIE)?.value;
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  const base = env.QUERY_API_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function readJson(res: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await res.json() };
  } catch {
    return { ok: false };
  }
}

function errorBodyCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined;
  }
  const code = (body as { code: unknown }).code;
  return typeof code === 'string' && code !== '' ? code : undefined;
}

/**
 * Authenticated fetch to query-api (Bearer from the access cookie). No Next.js HTTP cache.
 * Never throws: network failures and malformed JSON bodies come back as typed errors.
 */
export async function queryApiAuthedFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<Result<T, QueryApiAuthedError>> {
  const token = await getAccessToken();
  if (!token) {
    return fail({ code: 'unauthorized' });
  }
  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    return fail({ code: 'network' });
  }
  if (res.status === HTTP_NO_CONTENT) {
    return ok(undefined as T);
  }
  if (!res.ok) {
    const body = await readJson(res);
    const apiCode = body.ok ? errorBodyCode(body.value) : undefined;
    return fail({
      code: 'http_error',
      status: res.status,
      ...(apiCode ? { apiCode } : {}),
    });
  }
  const body = await readJson(res);
  if (!body.ok) {
    return fail({ code: 'http_error', status: res.status });
  }
  return ok(body.value as T);
}
