import type { SearchRepository } from '../../repositories';
import { GetSearchCountsEndpoint } from './get-search-counts.endpoint';

function endpointWith(
  objectCounts: { counts: Record<string, number>; capped: boolean },
  users: number,
) {
  const searchRepo = {
    countObjectsByType: jest.fn().mockResolvedValue(objectCounts),
    countUsers: jest.fn().mockResolvedValue(users),
  } as unknown as SearchRepository;
  return new GetSearchCountsEndpoint(searchRepo);
}

describe('GetSearchCountsEndpoint', () => {
  it('returns type counts with counts_capped and the exact user total', async () => {
    const endpoint = endpointWith(
      { counts: { restaurant: 100_000, product: 3 }, capped: true },
      7,
    );

    await expect(endpoint.execute({ q: 're' })).resolves.toEqual({
      type_counts: { restaurant: 100_000, product: 3 },
      counts_capped: true,
      total_users: 7,
    });
  });

  it('reports counts_capped false below the cap', async () => {
    const endpoint = endpointWith(
      { counts: { restaurant: 2 }, capped: false },
      0,
    );

    await expect(endpoint.execute({ q: 'greek' })).resolves.toEqual({
      type_counts: { restaurant: 2 },
      counts_capped: false,
      total_users: 0,
    });
  });
});
