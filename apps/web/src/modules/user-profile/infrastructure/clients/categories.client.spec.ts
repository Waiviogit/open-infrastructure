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

import { apiNavContextFromLineage } from '../../domain/category-nav-path';
import { getCategoryNav } from './categories.client';

const NAV = {
  items: [{ name: 'Comfort Food', objects_count: 4, has_children: false }],
  uncategorized_count: 2,
  show_other: false,
};

function mockFetchJson(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as typeof fetch;
}

describe('categories client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    cacheTag.mockReset();
  });

  it('requests exactly one type with the drill-down context', async () => {
    mockFetchJson(NAV);
    const res = await getCategoryNav(
      'alice',
      'recipe',
      apiNavContextFromLineage(['World', 'German Cuisine']),
    );
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/query/v1/users/alice/categories');
    expect(url.searchParams.getAll('types')).toEqual(['recipe']);
    expect(url.searchParams.get('name')).toBe('German Cuisine');
    expect(url.searchParams.getAll('path')).toEqual(['World']);
    expect(res).toEqual(NAV);
  });

  it('tags the response with the user favorites tag', async () => {
    mockFetchJson(NAV);
    await getCategoryNav('Alice', 'book');
    expect(cacheTag).toHaveBeenCalledWith('query-api:user:alice:favorites');
  });

  it('returns null for an unexpected shape', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetchJson({ items: 'nope' });
    await expect(getCategoryNav('alice', 'book')).resolves.toBeNull();
  });
});
