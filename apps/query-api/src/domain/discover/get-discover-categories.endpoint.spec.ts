import type { DiscoverCategoriesQuery } from './discover-query.schema';
import { GetDiscoverCategoriesEndpoint } from './get-discover-categories.endpoint';

const NAV = {
  items: [{ name: 'Audio', objects_count: 12, has_children: true }],
  show_other: false,
};

function setup(cached: string | null = null) {
  const navigation = { build: jest.fn().mockResolvedValue(NAV) };
  const redis = {
    get: jest.fn().mockResolvedValue(cached),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const endpoint = new GetDiscoverCategoriesEndpoint(
    navigation as never,
    { getClient: () => redis } as never,
  );
  return { endpoint, navigation, redis };
}

const ROOT: DiscoverCategoriesQuery = { object_type: 'product', category_path: [], tags: [] };

describe('GetDiscoverCategoriesEndpoint', () => {
  it('builds the level over the type scope with the filters and the lineage', async () => {
    const { endpoint, navigation } = setup();

    const result = await endpoint.execute({
      query: {
        object_type: 'product',
        category_path: ['Electronics', 'Audio'],
        q: '  sony ',
        tags: ['Brand:Sony'],
      },
    });

    expect(result).toEqual(NAV);
    expect(navigation.build).toHaveBeenCalledWith({
      scope: {
        kind: 'type',
        objectType: 'product',
        q: 'sony',
        tags: [{ category: 'Brand', value: 'Sony' }],
        box: null,
      },
      objectType: 'product',
      lineage: ['Electronics', 'Audio'],
      excluded: [],
      includeHasChildren: true,
    });
  });

  it('caches the unfiltered level and serves it from the cache', async () => {
    const first = setup();
    await first.endpoint.execute({ query: ROOT });
    expect(first.redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^query-api:cache:discover-categories:product:[0-9a-f]{64}$/),
      JSON.stringify(NAV),
      600,
    );

    const second = setup(JSON.stringify(NAV));
    await expect(second.endpoint.execute({ query: ROOT })).resolves.toEqual(NAV);
    expect(second.navigation.build).not.toHaveBeenCalled();
  });

  it('never caches a filtered level', async () => {
    const { endpoint, redis } = setup(JSON.stringify(NAV));

    await endpoint.execute({ query: { ...ROOT, tags: ['Brand:Sony'] } });

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('keys the cache by lineage', async () => {
    const a = setup();
    const b = setup();
    await a.endpoint.execute({ query: { ...ROOT, category_path: ['Audio'] } });
    await b.endpoint.execute({ query: { ...ROOT, category_path: ['Video'] } });

    expect(a.redis.set.mock.calls[0]?.[0]).not.toBe(b.redis.set.mock.calls[0]?.[0]);
  });
});
