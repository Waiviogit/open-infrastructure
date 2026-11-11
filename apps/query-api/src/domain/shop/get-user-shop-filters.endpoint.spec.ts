import { GetUserShopFiltersEndpoint } from './get-user-shop-filters.endpoint';

const scope = {
  account: 'alice',
  types: ['product'],
  postLinkedTypes: [],
  deselectObjectIds: ['d1'],
};

describe('GetUserShopFiltersEndpoint', () => {
  it('returns static ratings and grouped categories for the resolved Favorites scope', async () => {
    const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
    const objectCategoriesRepo = {
      getTagCategoriesByScope: jest.fn().mockResolvedValue([
        { category: 'Pros', tag_value: 'coffee', object_count: 2 },
      ]),
    };
    const endpoint = new GetUserShopFiltersEndpoint(
      resolver as never,
      objectCategoriesRepo as never,
    );

    const result = await endpoint.execute('alice', {
      types: ['product'],
      categoryPath: ['Kitchen'],
      uncategorizedOnly: false,
      tags: [],
    });

    expect(result).toEqual({
      ratings: [10, 8, 6],
      categories: [{ category: 'Pros', items: [{ value: 'coffee', count: 2 }] }],
    });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', ['product']);
    expect(objectCategoriesRepo.getTagCategoriesByScope).toHaveBeenCalledWith(
      expect.objectContaining({ scope, categoryPath: ['Kitchen'], uncategorizedOnly: false }),
    );
  });

  it('returns null for blank username', async () => {
    const endpoint = new GetUserShopFiltersEndpoint({} as never, {} as never);
    expect(
      await endpoint.execute('  ', {
        types: ['product'],
        categoryPath: [],
        uncategorizedOnly: false,
        tags: [],
      }),
    ).toBeNull();
  });

  it('passes parsed tags and rating to the tag facet query', async () => {
    const objectCategoriesRepo = {
      getTagCategoriesByScope: jest.fn().mockResolvedValue([]),
    };
    const endpoint = new GetUserShopFiltersEndpoint(
      { resolve: jest.fn().mockResolvedValue(scope) } as never,
      objectCategoriesRepo as never,
    );

    await endpoint.execute('alice', {
      types: ['recipe'],
      categoryPath: [],
      uncategorizedOnly: false,
      tags: ['Cuisine:german'],
      rating: 10,
    });

    expect(objectCategoriesRepo.getTagCategoriesByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ category: 'Cuisine', value: 'german' }],
        rating: 10,
      }),
    );
  });
});
