import { Injectable } from '@nestjs/common';
import {
  USER_FAVORITES_OBJECT_TYPES,
  isUserFavoritesObjectType,
  resolvePostLinkedObjectTypes,
} from '@opden-data-layer/core';
import {
  UserMetadataRepository,
  UserShopDeselectRepository,
  type UserFavoritesScope,
} from '../../repositories';

/**
 * Requested types ∩ `USER_FAVORITES_OBJECT_TYPES` (trimmed, deduped, request order kept).
 * `undefined` means "every Favorites type".
 */
export function intersectUserFavoritesTypes(requested?: readonly string[]): string[] {
  if (requested == null) {
    return [...USER_FAVORITES_OBJECT_TYPES];
  }
  const types: string[] = [];
  for (const raw of requested) {
    const type = raw.trim();
    if (isUserFavoritesObjectType(type) && !types.includes(type)) {
      types.push(type);
    }
  }
  return types;
}

/** The same scope restricted to one type (no extra queries: flags and deselects are reused). */
export function narrowUserFavoritesScope(
  scope: UserFavoritesScope,
  objectType: string,
): UserFavoritesScope {
  return {
    ...scope,
    types: scope.types.filter((type) => type === objectType),
    postLinkedTypes: scope.postLinkedTypes.filter((type) => type === objectType),
  };
}

/**
 * Builds the one Favorites scope every profile Favorites endpoint reads
 * (categories, shop/filters, shop-objects, shop-sections, favorites/types, favorites, favorites/map).
 * @see docs/apps/query-api/spec/users-favorites-endpoint.md
 */
@Injectable()
export class UserFavoritesScopeResolver {
  constructor(
    private readonly userMetadataRepo: UserMetadataRepository,
    private readonly deselectRepo: UserShopDeselectRepository,
  ) {}

  async resolve(account: string, requestedTypes?: readonly string[]): Promise<UserFavoritesScope> {
    const name = account.trim();
    const types = intersectUserFavoritesTypes(requestedTypes);
    if (name.length === 0 || types.length === 0) {
      return { account: name, types, postLinkedTypes: [], deselectObjectIds: [] };
    }

    const [flags, deselectObjectIds] = await Promise.all([
      this.userMetadataRepo.findShopVisibilityFlags(name),
      this.deselectRepo.findObjectIdsByAccount(name),
    ]);

    return {
      account: name,
      types,
      postLinkedTypes: resolvePostLinkedObjectTypes(types, flags),
      deselectObjectIds,
    };
  }
}
