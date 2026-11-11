/** @jest-environment node */

jest.mock('server-only', () => ({}));

const cacheTag = jest.fn();
jest.mock('next/cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));

jest.mock('@/config/env', () => ({
  env: { QUERY_API_URL: 'http://query-api.test' },
}));

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

import { fetchFavoritesTypes } from './favorites.client';

function mockFetchJson(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as typeof fetch;
}

describe('favorites types client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    cacheTag.mockReset();
  });

  it('parses counted items and tags the response', async () => {
    mockFetchJson({
      types: ['recipe', 'place'],
      items: [
        {
          object_type: 'recipe',
          objects_count: 12,
          supports_categories: true,
          has_categories: true,
        },
        {
          object_type: 'place',
          objects_count: 3,
          supports_categories: false,
          has_categories: false,
        },
      ],
    });
    const res = await fetchFavoritesTypes('alice');
    expect(res?.items?.map((item) => item.object_type)).toEqual(['recipe', 'place']);
    expect(cacheTag).toHaveBeenCalledWith('query-api:user:alice:favorites-types');
  });

  it('accepts a response without items', async () => {
    mockFetchJson({ types: ['book'] });
    await expect(fetchFavoritesTypes('alice')).resolves.toEqual({ types: ['book'] });
  });

  it('returns null for an unexpected shape', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetchJson({ types: 'book' });
    await expect(fetchFavoritesTypes('alice')).resolves.toBeNull();
  });
});
