/** @jest-environment node */

jest.mock('server-only', () => ({}));

const mockEnv = {
  QUERY_API_URL: 'http://query-api.test',
};

jest.mock('@/config/env', () => ({
  env: mockEnv,
}));

import { NextRequest } from 'next/server';

import { GET } from './route';

describe('GET /api/discover/categories', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('forwards the lineage in order with the filters, and nothing else', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [], show_other: false }),
      headers: { get: () => 'application/json' },
    }) as typeof fetch;

    const request = new NextRequest(
      'http://localhost/api/discover/categories?object_type=product&category_path=Electronics&category_path=Audio&tags=Brand:Sony&q=%20sony%20&sort=newest',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const upstream = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
    expect(upstream.pathname).toBe('/query/v1/discover/categories');
    expect(upstream.searchParams.getAll('category_path')).toEqual(['Electronics', 'Audio']);
    expect(upstream.searchParams.getAll('tags')).toEqual(['Brand:Sony']);
    expect(upstream.searchParams.get('q')).toBe('sony');
    expect(upstream.searchParams.has('sort')).toBe(false);
  });

  it('returns 400 when object_type is missing', async () => {
    global.fetch = jest.fn() as typeof fetch;

    const response = await GET(new NextRequest('http://localhost/api/discover/categories'));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
