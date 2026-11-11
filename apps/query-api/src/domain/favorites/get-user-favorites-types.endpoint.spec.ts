import type { UserFavoritesRepository, UserFavoritesScope } from '../../repositories';
import type { UserCategoryNavigationService } from '../categories/user-category-navigation.service';
import { GetUserFavoritesTypesEndpoint } from './get-user-favorites-types.endpoint';
import type { UserFavoritesScopeResolver } from './user-favorites-scope.resolver';

const scope: UserFavoritesScope = {
  account: 'alice',
  types: ['recipe', 'restaurant', 'book', 'product'],
  postLinkedTypes: ['recipe', 'book'],
  deselectObjectIds: ['x'],
};

const ROOT_ITEM = { name: 'German Cuisine', objects_count: 2, has_children: false };

describe('GetUserFavoritesTypesEndpoint', () => {
  it('returns empty types and items for blank username', async () => {
    const endpoint = new GetUserFavoritesTypesEndpoint(
      {} as UserFavoritesScopeResolver,
      {} as UserFavoritesRepository,
      {} as UserCategoryNavigationService,
    );
    await expect(endpoint.execute('  ')).resolves.toEqual({ types: [], items: [] });
  });

  it('flags has_categories only when the category root lists a category', async () => {
    const resolve = jest.fn().mockResolvedValue(scope);
    const findTypesByScope = jest.fn().mockResolvedValue([
      { object_type: 'restaurant', objects_count: 7, categorized_count: 0 },
      { object_type: 'recipe', objects_count: 3, categorized_count: 2 },
      { object_type: 'book', objects_count: 1, categorized_count: 0 },
      // Categorized objects but an empty root (e.g. scope rows not rebuilt yet).
      { object_type: 'product', objects_count: 14, categorized_count: 12 },
    ]);
    const build = jest.fn(async ({ objectType }: { objectType: string }) => ({
      items: objectType === 'recipe' ? [ROOT_ITEM] : [],
      show_other: false,
    }));
    const endpoint = new GetUserFavoritesTypesEndpoint(
      { resolve } as unknown as UserFavoritesScopeResolver,
      { findTypesByScope } as unknown as UserFavoritesRepository,
      { build } as unknown as UserCategoryNavigationService,
    );

    await expect(endpoint.execute('alice')).resolves.toEqual({
      types: ['restaurant', 'recipe', 'book', 'product'],
      items: [
        {
          object_type: 'restaurant',
          objects_count: 7,
          supports_categories: false,
          has_categories: false,
        },
        { object_type: 'recipe', objects_count: 3, supports_categories: true, has_categories: true },
        { object_type: 'book', objects_count: 1, supports_categories: true, has_categories: false },
        {
          object_type: 'product',
          objects_count: 14,
          supports_categories: true,
          has_categories: false,
        },
      ],
    });
    expect(resolve).toHaveBeenCalledWith('alice');
    expect(findTypesByScope).toHaveBeenCalledWith(scope);
    // Navigation runs only for category types with categorized objects, on a one-type scope.
    expect(build).toHaveBeenCalledTimes(2);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: 'recipe',
        lineage: [],
        scope: { ...scope, types: ['recipe'], postLinkedTypes: ['recipe'] },
      }),
    );
  });
});
