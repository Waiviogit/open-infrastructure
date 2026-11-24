import { sql, type RawBuilder } from 'kysely';

import type { DiscoverBox } from '../domain/discover/discover-query.schema';
import { buildDiscoverObjectFilters, type DiscoverTagFilter } from './discover-object-filters.sql';
import {
  isEmptyUserFavoritesScope,
  objectFilterClause,
  userFavoritesScopeCte,
  type UserFavoritesScope,
  type UserFavoritesTagFilter,
} from './user-favorites-scope.sql';

/** A user's Favorites (one type) with the Favorites filters; counted in objects. */
export type UserCategoryCountScope = {
  kind: 'user';
  scope: UserFavoritesScope;
  tags: readonly UserFavoritesTagFilter[];
  rating: number | null;
};

/** All active objects of one type with the Discover filters; counted in groups (`meta_group`). */
export type TypeCategoryCountScope = {
  kind: 'type';
  objectType: string;
  q: string;
  tags: readonly DiscoverTagFilter[];
  box: DiscoverBox | null;
};

/** The object set a category tree is built over. */
export type CategoryCountScope = UserCategoryCountScope | TypeCategoryCountScope;

/**
 * CTEs ending in `category_scope (object_id, unit_key)`: the scope's objects after its filters.
 * `unit_key` is what counts as one: the object for a user scope, its group
 * (`COALESCE(meta_group_id, object_id)`) for a type scope. `null` when the scope is empty or its
 * text query can match nothing (callers return zero counts).
 * @see docs/apps/query-api/spec/categories.md
 */
export function categoryScopeCtes(scope: CategoryCountScope): RawBuilder<unknown> | null {
  if (scope.kind === 'user') {
    if (isEmptyUserFavoritesScope(scope.scope)) {
      return null;
    }
    const objectFilter = objectFilterClause(sql`s.object_id`, scope.tags, scope.rating);
    return sql`${userFavoritesScopeCte(scope.scope)},
      category_scope AS (
        SELECT s.object_id, s.object_id AS unit_key
        FROM user_favorites_scope s
        WHERE ${objectFilter}
      )`;
  }

  const objectType = scope.objectType.trim();
  if (objectType.length === 0) {
    return null;
  }
  const filters = buildDiscoverObjectFilters({
    objectType,
    q: scope.q,
    tags: scope.tags,
    box: scope.box,
    categoryPath: [],
  });
  if (filters == null) {
    return null;
  }
  return sql`category_scope AS (
    SELECT oc.object_id, COALESCE(oc.meta_group_id, oc.object_id) AS unit_key
    FROM objects_core oc
    WHERE oc.status = 'active'
      AND oc.object_type = ${objectType}
      ${filters}
  )`;
}
