import { HubFeedFilterSnapshotService } from './hub-feed-filter-snapshot.service';

function setup(options: { cached?: string | null; counted?: unknown[] | null } = {}) {
  const client = {
    get: jest.fn().mockResolvedValue(options.cached ?? null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const redisFactory = { getClient: jest.fn().mockReturnValue(client) };
  const countsRepo = {
    findFollowsWithCounts: jest
      .fn()
      .mockResolvedValue(
        options.counted === undefined
          ? [{ kind: 'user', id: 'bob', object_type: null, count: 2, last_item_unix: 1 }]
          : options.counted,
      ),
    findFollows: jest
      .fn()
      .mockResolvedValue([{ kind: 'user', id: 'bob', object_type: null, count: null, last_item_unix: 1 }]),
  };
  const service = new HubFeedFilterSnapshotService(countsRepo as never, redisFactory as never);
  return { service, client, countsRepo };
}

describe('HubFeedFilterSnapshotService', () => {
  it('returns the cached snapshot without touching the database', async () => {
    const cached = { windowStart: 1, countsAvailable: true, users: [], objectTypes: [] };
    const { service, countsRepo } = setup({ cached: JSON.stringify(cached) });

    await expect(service.getSnapshot('alice', 'posts')).resolves.toEqual(cached);
    expect(countsRepo.findFollowsWithCounts).not.toHaveBeenCalled();
  });

  it('counts on a miss and caches the result under the account + tab key', async () => {
    const { service, client, countsRepo } = setup();

    const snapshot = await service.getSnapshot('Alice', 'threads');

    expect(snapshot.users).toEqual([{ name: 'bob', count: 2, lastItemUnix: 1 }]);
    expect(countsRepo.findFollowsWithCounts).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'Alice', tab: 'threads' }),
      300,
    );
    expect(client.set).toHaveBeenCalledWith(
      'query-api:cache:hub-feed-filters:v2:alice:threads',
      JSON.stringify(snapshot),
      300,
    );
  });

  it('falls back to follows without counts and does not cache when counting fails', async () => {
    const { service, client, countsRepo } = setup({ counted: null });

    const snapshot = await service.getSnapshot('alice', 'posts');

    expect(countsRepo.findFollows).toHaveBeenCalled();
    expect(snapshot.countsAvailable).toBe(false);
    expect(snapshot.users[0].count).toBeNull();
    expect(client.set).not.toHaveBeenCalled();
  });
});
