jest.mock('server-only', () => ({}));

const cacheLife = jest.fn();
const cacheTag = jest.fn();
jest.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => cacheLife(...args),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));

const incomingHeaders = new Headers({ 'x-forwarded-for': '203.0.113.7' });
jest.mock('next/headers', () => ({
  headers: async () => incomingHeaders,
}));

jest.mock('@/config/env', () => ({
  env: { QUERY_API_URL: 'http://query-api' },
}));

import {
  QUERY_API_LIVE_INIT,
  queryApiFetch,
  queryApiFetchOutcome,
} from './query-api.client';

describe('query-api client caching', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    cacheLife.mockReset();
    cacheTag.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caches a read for 60 s with its tags', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));

    const data = await queryApiFetch('/query/v1/users/alice', {
      headers: { 'X-Viewer': 'carol' },
      cacheTags: ['query-api:user:alice:profile'],
    });

    expect(data).toEqual({ ok: 1 });
    expect(cacheTag).toHaveBeenCalledWith('query-api:user:alice:profile');
    expect(cacheLife).toHaveBeenCalledWith({ stale: 30, revalidate: 60, expire: 3600 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://query-api/query/v1/users/alice',
      expect.objectContaining({ method: 'GET', headers: { 'x-viewer': 'carol' }, cache: 'no-store' }),
    );
  });

  it('honours a legacy next.revalidate as the cache lifetime', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

    await queryApiFetch('/query/v1/discover/objects', { next: { revalidate: 3600 } });

    expect(cacheLife).toHaveBeenCalledWith({ stale: 30, revalidate: 3600, expire: 7200 });
  });

  it('caches failures only briefly', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));

    await expect(queryApiFetchOutcome('/query/v1/x')).resolves.toEqual({ ok: false, status: 503 });
    expect(cacheLife).toHaveBeenCalledWith({ stale: 30, revalidate: 1, expire: 2 });
  });

  it('bypasses the cache for live reads', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await queryApiFetch('/query/v1/users/alice/wallet', {
      ...QUERY_API_LIVE_INIT,
      cacheTags: ['query-api:user:alice:wallet'],
    });

    expect(cacheLife).not.toHaveBeenCalled();
    expect(cacheTag).not.toHaveBeenCalled();
  });

  it('puts the forwarded client IP into the request (and so into the cache key)', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await queryApiFetch('/query/v1/posts/alice/p', { forwardClientIp: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://query-api/query/v1/posts/alice/p',
      expect.objectContaining({ headers: { 'x-forwarded-for': '203.0.113.7' } }),
    );
  });

  it('sends POST bodies as part of the cached request', async () => {
    fetchMock.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));

    await queryApiFetch('/query/v1/posts/feed', {
      method: 'POST',
      body: JSON.stringify({ limit: 20 }),
      cacheTags: ['query-api:home-feed:carol'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://query-api/query/v1/posts/feed',
      expect.objectContaining({ method: 'POST', body: '{"limit":20}' }),
    );
    expect(cacheTag).toHaveBeenCalledWith('query-api:home-feed:carol');
  });
});
