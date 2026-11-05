import type { NextRequest } from 'next/server';

jest.mock('server-only', () => ({}));

const mockGetUser = jest.fn();
const mockSafeFetch = jest.fn();
const mockPlacesEnabled = jest.fn();

jest.mock('@/config/env', () => ({ env: { QUERY_API_URL: 'http://query-api.test' } }));
jest.mock('@/config/post-editor-defaults', () => ({
  isPostEditorGooglePlacesEnabled: () => mockPlacesEnabled(),
}));
jest.mock('@/i18n/runtime/get-request-locale', () => ({ getRequestLocale: async () => 'en-US' }));
jest.mock('@/shared/infrastructure/auth/cookie-auth-context-provider', () => ({
  createCookieAuthContextProvider: () => ({ getUser: mockGetUser }),
}));
jest.mock('@/shared/infrastructure/http/safe-fetch.server', () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}));

import { proxyPlacesRequest } from './places-proxy.server';

function request(): NextRequest {
  return { headers: new Headers({ 'x-forwarded-for': '91.200.40.1' }) } as unknown as NextRequest;
}

describe('proxyPlacesRequest (Google places BFF)', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSafeFetch.mockReset();
    mockPlacesEnabled.mockReset();
  });

  it('answers 404 without calling query-api while the feature flag is off', async () => {
    mockPlacesEnabled.mockReturnValue(false);
    mockGetUser.mockResolvedValue({ username: 'alice' });

    const res = await proxyPlacesRequest(request(), '/search', new URLSearchParams({ q: 'pizza' }));

    expect(res.status).toBe(404);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('answers 401 to a signed-out visitor without calling query-api', async () => {
    mockPlacesEnabled.mockReturnValue(true);
    mockGetUser.mockResolvedValue(null);

    const res = await proxyPlacesRequest(request(), '/search', new URLSearchParams({ q: 'pizza' }));

    expect(res.status).toBe(401);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('forwards a signed-in request with the client IP and locale', async () => {
    mockPlacesEnabled.mockReturnValue(true);
    mockGetUser.mockResolvedValue({ username: 'alice' });
    mockSafeFetch.mockResolvedValue({
      ok: true,
      response: new Response('{"enabled":true,"places":[]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const res = await proxyPlacesRequest(request(), '/search', new URLSearchParams({ q: 'pizza' }));

    expect(res.status).toBe(200);
    const [url, init] = mockSafeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://query-api.test/query/v1/places/search?q=pizza');
    expect(init.headers).toMatchObject({ 'X-Forwarded-For': '91.200.40.1', 'X-Locale': 'en-US' });
  });

  it('answers 502 when query-api is unreachable', async () => {
    mockPlacesEnabled.mockReturnValue(true);
    mockGetUser.mockResolvedValue({ username: 'alice' });
    mockSafeFetch.mockResolvedValue({ ok: false, failure: 'network' });

    const res = await proxyPlacesRequest(request(), '/search');

    expect(res.status).toBe(502);
  });
});
