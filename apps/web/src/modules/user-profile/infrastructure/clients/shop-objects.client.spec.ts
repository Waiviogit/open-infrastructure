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

import { headers } from 'next/headers';

import { fetchShopObjects, fetchShopSections } from './shop-objects.client';

const INCOMING_XFF = '6.6.6.6, 1.2.3.4';
const FAVORITES_TAG = 'query-api:user:alice:favorites';

function outboundCall(): { url: URL; init: RequestInit | undefined } {
  const [input, init] = (global.fetch as jest.Mock).mock.calls[0] ?? [];
  return { url: new URL(String(input)), init: init as RequestInit | undefined };
}

describe('shop objects client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (headers as jest.Mock).mockResolvedValue(
      new Headers({ 'x-forwarded-for': INCOMING_XFF }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], cursor: null, hasMore: false, sections: [] }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sends exactly one type with path, filters and cursor on shop objects', async () => {
    await fetchShopObjects('alice', {
      objectType: 'recipe',
      categoryPath: ['German Cuisine', ' '],
      tags: ['Cuisine:german'],
      rating: 8,
      limit: 20,
      cursor: 'abc',
    });
    const { url, init } = outboundCall();
    expect(url.pathname).toBe('/query/v1/users/alice/shop-objects');
    expect(url.searchParams.getAll('types')).toEqual(['recipe']);
    expect(url.searchParams.getAll('categoryPath')).toEqual(['German Cuisine']);
    expect(url.searchParams.getAll('tags')).toEqual(['Cuisine:german']);
    expect(url.searchParams.get('rating')).toBe('8');
    expect(url.searchParams.get('cursor')).toBe('abc');
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(INCOMING_XFF);
  });

  it('sends uncategorizedOnly for the Uncategorized node', async () => {
    await fetchShopObjects('alice', {
      objectType: 'book',
      categoryPath: [],
      uncategorizedOnly: true,
    });
    expect(outboundCall().url.searchParams.get('uncategorizedOnly')).toBe('true');
  });

  it('tags shop objects and sections with the user favorites tag', async () => {
    await fetchShopObjects('Alice', { objectType: 'place', categoryPath: [] });
    expect(cacheTag).toHaveBeenCalledWith(FAVORITES_TAG);
    cacheTag.mockClear();
    await fetchShopSections('Alice', { objectType: 'recipe' });
    expect(cacheTag).toHaveBeenCalledWith(FAVORITES_TAG);
  });

  it('sends one type with name and path on shop sections', async () => {
    await fetchShopSections('alice', {
      objectType: 'recipe',
      name: 'Comfort Food',
      path: ['German Cuisine'],
      sectionLimit: 3,
    });
    const { url, init } = outboundCall();
    expect(url.pathname).toBe('/query/v1/users/alice/shop-sections');
    expect(url.searchParams.getAll('types')).toEqual(['recipe']);
    expect(url.searchParams.get('name')).toBe('Comfort Food');
    expect(url.searchParams.getAll('path')).toEqual(['German Cuisine']);
    expect(url.searchParams.get('sectionLimit')).toBe('3');
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(INCOMING_XFF);
  });

  it('skips the request without a type', async () => {
    await expect(
      fetchShopObjects('alice', { objectType: ' ', categoryPath: [] }),
    ).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
