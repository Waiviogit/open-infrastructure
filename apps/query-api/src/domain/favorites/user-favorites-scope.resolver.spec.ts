import { USER_FAVORITES_OBJECT_TYPES } from '@opden-data-layer/core';
import type { UserMetadataRepository, UserShopDeselectRepository } from '../../repositories';
import {
  UserFavoritesScopeResolver,
  intersectUserFavoritesTypes,
} from './user-favorites-scope.resolver';

const NO_FLAGS = {
  hide_linked_objects: false,
  hide_recipe_objects: false,
  hide_favorite_objects: false,
};

function createResolver(
  flags = NO_FLAGS,
  deselectIds: string[] = [],
): {
  resolver: UserFavoritesScopeResolver;
  findFlags: jest.Mock;
  findDeselect: jest.Mock;
} {
  const findFlags = jest.fn().mockResolvedValue(flags);
  const findDeselect = jest.fn().mockResolvedValue(deselectIds);
  const resolver = new UserFavoritesScopeResolver(
    { findShopVisibilityFlags: findFlags } as unknown as UserMetadataRepository,
    { findObjectIdsByAccount: findDeselect } as unknown as UserShopDeselectRepository,
  );
  return { resolver, findFlags, findDeselect };
}

describe('intersectUserFavoritesTypes', () => {
  it('defaults to every Favorites type when nothing is requested', () => {
    expect(intersectUserFavoritesTypes(undefined)).toEqual([...USER_FAVORITES_OBJECT_TYPES]);
  });

  it('drops types outside the whitelist (hashtag, governance, unknown) and duplicates', () => {
    expect(
      intersectUserFavoritesTypes(['recipe', 'hashtag', 'governance', 'nope', ' recipe ', 'book']),
    ).toEqual(['recipe', 'book']);
  });
});

describe('UserFavoritesScopeResolver', () => {
  it('maps per-type hide flags to post-linked types (book/product, recipe, others)', async () => {
    const { resolver } = createResolver({
      hide_linked_objects: true,
      hide_recipe_objects: false,
      hide_favorite_objects: true,
    });

    const scope = await resolver.resolve('alice', ['book', 'product', 'recipe', 'restaurant']);

    expect(scope.types).toEqual(['book', 'product', 'recipe', 'restaurant']);
    expect(scope.postLinkedTypes).toEqual(['recipe']);
  });

  it('keeps every requested type post-linked when no flag is set', async () => {
    const { resolver } = createResolver();
    const scope = await resolver.resolve('alice', ['book', 'restaurant']);
    expect(scope.postLinkedTypes).toEqual(['book', 'restaurant']);
  });

  it('loads flags and deselects once for the trimmed account', async () => {
    const { resolver, findFlags, findDeselect } = createResolver(NO_FLAGS, ['x1']);

    const scope = await resolver.resolve('  alice  ', ['recipe']);

    expect(scope).toEqual({
      account: 'alice',
      types: ['recipe'],
      postLinkedTypes: ['recipe'],
      deselectObjectIds: ['x1'],
    });
    expect(findFlags).toHaveBeenCalledTimes(1);
    expect(findFlags).toHaveBeenCalledWith('alice');
    expect(findDeselect).toHaveBeenCalledTimes(1);
  });

  it('returns an empty scope without reading the database when no requested type is allowed', async () => {
    const { resolver, findFlags, findDeselect } = createResolver();

    const scope = await resolver.resolve('alice', ['hashtag']);

    expect(scope.types).toEqual([]);
    expect(scope.postLinkedTypes).toEqual([]);
    expect(findFlags).not.toHaveBeenCalled();
    expect(findDeselect).not.toHaveBeenCalled();
  });

  it('returns an empty scope for a blank account', async () => {
    const { resolver, findFlags } = createResolver();
    const scope = await resolver.resolve('  ');
    expect(scope.account).toBe('');
    expect(scope.postLinkedTypes).toEqual([]);
    expect(findFlags).not.toHaveBeenCalled();
  });
});
