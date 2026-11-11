import type { UserFavoritesScope } from '../../repositories';
import { GetUserCategoriesEndpoint } from './get-user-categories.endpoint';

const scope: UserFavoritesScope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

function createEndpoint(resolvedScope: UserFavoritesScope = scope) {
  const resolver = { resolve: jest.fn().mockResolvedValue(resolvedScope) };
  const navigation = {
    build: jest.fn().mockResolvedValue({
      items: [{ name: 'Desserts', objects_count: 2, has_children: true }],
      show_other: false,
    }),
  };
  const objectCategoriesRepo = {
    countUncategorizedObjectIdsByScope: jest.fn().mockResolvedValue(3),
  };
  const endpoint = new GetUserCategoriesEndpoint(
    resolver as never,
    navigation as never,
    objectCategoriesRepo as never,
  );
  return { endpoint, resolver, navigation, objectCategoriesRepo };
}

describe('GetUserCategoriesEndpoint', () => {
  it('builds root navigation with has_children and a live uncategorized count for the one type', async () => {
    const { endpoint, resolver, navigation, objectCategoriesRepo } = createEndpoint();

    const result = await endpoint.execute('alice', { types: ['recipe'], path: [], excluded: [] });

    expect(result).toEqual({
      items: [{ name: 'Desserts', objects_count: 2, has_children: true }],
      uncategorized_count: 3,
      show_other: false,
    });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', ['recipe']);
    expect(navigation.build).toHaveBeenCalledWith({
      scope,
      objectType: 'recipe',
      lineage: [],
      excluded: [],
      includeHasChildren: true,
    });
    expect(objectCategoriesRepo.countUncategorizedObjectIdsByScope).toHaveBeenCalledWith({ scope });
  });

  it('drills down with the full lineage and reports uncategorized_count 0 below the root', async () => {
    const { endpoint, navigation, objectCategoriesRepo } = createEndpoint();

    const result = await endpoint.execute('alice', {
      types: ['recipe'],
      name: 'Comfort Food',
      path: ['German Cuisine'],
      excluded: ['Soups'],
    });

    expect(result.uncategorized_count).toBe(0);
    expect(navigation.build).toHaveBeenCalledWith(
      expect.objectContaining({
        lineage: ['German Cuisine', 'Comfort Food'],
        excluded: ['Soups'],
      }),
    );
    expect(objectCategoriesRepo.countUncategorizedObjectIdsByScope).not.toHaveBeenCalled();
  });

  it('returns an empty response for a blank account', async () => {
    const { endpoint, resolver } = createEndpoint();
    await expect(
      endpoint.execute('  ', { types: ['recipe'], path: [], excluded: [] }),
    ).resolves.toEqual({ items: [], uncategorized_count: 0, show_other: false });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('returns an empty response when the type is outside the Favorites whitelist', async () => {
    const { endpoint, navigation } = createEndpoint({ ...scope, types: [] });
    await expect(
      endpoint.execute('alice', { types: ['recipe'], path: [], excluded: [] }),
    ).resolves.toEqual({ items: [], uncategorized_count: 0, show_other: false });
    expect(navigation.build).not.toHaveBeenCalled();
  });
});
