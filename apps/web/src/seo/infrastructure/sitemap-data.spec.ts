jest.mock('server-only', () => ({}));

jest.mock('@/modules/user-profile/infrastructure/clients/query-api.client', () => ({
  queryApiFetch: jest.fn(),
}));

import {
  fetchDiscoverObjectsForSitemap,
  fetchDiscoverUsersForSitemap,
} from './sitemap-data';

const { queryApiFetch } = jest.requireMock(
  '@/modules/user-profile/infrastructure/clients/query-api.client',
) as { queryApiFetch: jest.Mock };

describe('sitemap-data', () => {
  beforeEach(() => {
    queryApiFetch.mockReset();
  });

  it('paginates discover objects until limit', async () => {
    queryApiFetch
      .mockResolvedValueOnce({
        items: [{ object_id: 'a' }, { object_id: 'b' }],
        cursor: 'c1',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ object_id: 'c' }],
        cursor: null,
        hasMore: false,
      });

    const rows = await fetchDiscoverObjectsForSitemap({ limit: 3 });
    expect(rows).toEqual([
      { object_id: 'a' },
      { object_id: 'b' },
      { object_id: 'c' },
    ]);
    expect(queryApiFetch).toHaveBeenCalledTimes(2);
  });

  it('never asks query-api for more than its 50-row discover limit', async () => {
    queryApiFetch.mockResolvedValue({ items: [], cursor: null, hasMore: false });

    await fetchDiscoverObjectsForSitemap({ limit: 5000 });
    await fetchDiscoverUsersForSitemap({ limit: 5000 });

    for (const [path] of queryApiFetch.mock.calls) {
      const limit = Number(new URL(String(path), 'http://query-api').searchParams.get('limit'));
      expect(limit).toBe(50);
    }
  });

  it('returns empty array on fetch failure', async () => {
    queryApiFetch.mockResolvedValue(null);
    await expect(fetchDiscoverUsersForSitemap({ limit: 10 })).resolves.toEqual([]);
  });
});
