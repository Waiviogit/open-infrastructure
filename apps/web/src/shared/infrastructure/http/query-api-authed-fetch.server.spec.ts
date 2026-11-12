/** @jest-environment node */

jest.mock('server-only', () => ({}));

jest.mock('@/config/env', () => ({
  env: { QUERY_API_URL: 'http://query-api.test/' },
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { cookies } from 'next/headers';

import { queryApiAuthedFetch } from './query-api-authed-fetch.server';

function withToken(token: string | undefined) {
  (cookies as jest.Mock).mockResolvedValue({
    get: () => (token ? { value: token } : undefined),
  });
}

describe('queryApiAuthedFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    withToken('tok');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns unauthorized without an access cookie and does not call fetch', async () => {
    withToken(undefined);
    global.fetch = jest.fn();
    expect(await queryApiAuthedFetch('/x')).toEqual({ ok: false, error: { code: 'unauthorized' } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the bearer token and JSON content type to the resolved URL', async () => {
    global.fetch = jest.fn().mockResolvedValue(Response.json({ a: 1 }));
    const result = await queryApiAuthedFetch('/query/v1/x', { method: 'POST', body: '{}' });
    expect(result).toEqual({ ok: true, value: { a: 1 } });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://query-api.test/query/v1/x');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
  });

  it('returns undefined for 204', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await queryApiAuthedFetch('/x', { method: 'DELETE' })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('returns network when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    expect(await queryApiAuthedFetch('/x')).toEqual({ ok: false, error: { code: 'network' } });
  });

  it('surfaces the error body code', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        Response.json({ code: 'activity_notes_limit_reached', message: 'x' }, { status: 409 }),
      );
    expect(await queryApiAuthedFetch('/x')).toEqual({
      ok: false,
      error: { code: 'http_error', status: 409, apiCode: 'activity_notes_limit_reached' },
    });
  });

  it('omits apiCode when the error body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    expect(await queryApiAuthedFetch('/x')).toEqual({
      ok: false,
      error: { code: 'http_error', status: 502 },
    });
  });

  it('turns a malformed success body into http_error instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    expect(await queryApiAuthedFetch('/x')).toEqual({
      ok: false,
      error: { code: 'http_error', status: 200 },
    });
  });
});
