/** @jest-environment node */

jest.mock('server-only', () => ({}));

jest.mock('@/config/env', () => ({
  env: { QUERY_API_URL: 'http://query-api.test' },
}));

jest.mock('@/i18n/runtime/get-request-locale', () => ({
  getRequestLocale: jest.fn().mockResolvedValue('de-DE'),
}));

jest.mock('@/shared/infrastructure/auth/cookie-auth-context-provider', () => ({
  createCookieAuthContextProvider: () => ({
    getUser: jest.fn().mockResolvedValue({ username: 'carol' }),
  }),
}));

import { NextRequest } from 'next/server';

import { GET } from './route';

describe('GET /api/discover/sections', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('forwards the lineage and cursor with the locale and viewer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ sections: [], cursor: null, hasMore: false }),
      headers: { get: () => 'application/json' },
    }) as typeof fetch;

    const response = await GET(
      new NextRequest(
        'http://localhost/api/discover/sections?object_type=product&category_path=Electronics&category_path=Audio&cursor=Video',
      ),
    );

    expect(response.status).toBe(200);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const upstream = new URL(url);
    expect(upstream.pathname).toBe('/query/v1/discover/sections');
    expect(upstream.searchParams.getAll('category_path')).toEqual(['Electronics', 'Audio']);
    expect(upstream.searchParams.get('cursor')).toBe('Video');
    const headers = new Headers(init.headers);
    expect(headers.get('X-Locale')).toBe('de-DE');
    expect(headers.get('X-Viewer')).toBe('carol');
  });
});
