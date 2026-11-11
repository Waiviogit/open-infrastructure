import { sql, type RawBuilder } from 'kysely';

/**
 * Unified profile Favorites scope (favorites ∪ authored post links − deselect).
 * Resolved once per request by `UserFavoritesScopeResolver`.
 * @see docs/apps/query-api/spec/users-favorites-endpoint.md
 */
export type UserFavoritesScope = {
  account: string;
  /** Object types in scope (already intersected with `USER_FAVORITES_OBJECT_TYPES`). */
  types: readonly string[];
  /** Subset of `types` whose post-linked objects are included (per-type hide flags). */
  postLinkedTypes: readonly string[];
  /** `user_shop_deselect` ids; removed from the post-linked branch only. */
  deselectObjectIds: readonly string[];
};

export type UserFavoritesTagFilter = {
  category: string;
  value: string;
};

export type UserFavoritesTagCategoryRow = {
  category: string;
  tag_value: string;
  object_count: number;
};

/** Legacy 10-point rating threshold → ODL `rank_score` (5★ = 10000). */
const RATING_THRESHOLD_TO_RANK = 1000;

/** True when the scope cannot contain any object (skip the query). */
export function isEmptyUserFavoritesScope(scope: UserFavoritesScope): boolean {
  return scope.account.trim().length === 0 || scope.types.length === 0;
}

/** Postgres `text[]` bound as a single array parameter (no string interpolation). */
export function textArraySql(values: readonly string[]): RawBuilder<unknown> {
  return sql`${[...values]}::text[]`;
}

/**
 * CTE `user_favorites_scope (object_id, object_type, weight)`:
 * active objects of `scope.types` that the account favorited, plus objects linked from the
 * account's posts when their type is in `scope.postLinkedTypes` and they are not deselected.
 * Ownership is intentionally not part of the scope.
 */
export function userFavoritesScopeCte(scope: UserFavoritesScope): RawBuilder<unknown> {
  const account = scope.account.trim();
  return sql`user_favorites_scope AS (
    SELECT DISTINCT oc.object_id, oc.object_type, oc.weight
    FROM (
      SELECT fav.object_id, TRUE AS is_favorite
      FROM object_favorite fav
      WHERE fav.account = ${account}
      UNION ALL
      SELECT po.object_id, FALSE AS is_favorite
      FROM post_objects po
      WHERE po.author = ${account}
        AND po.object_id <> ALL(${textArraySql(scope.deselectObjectIds)})
    ) member
    INNER JOIN objects_core oc ON oc.object_id = member.object_id
    WHERE oc.status = 'active'
      AND oc.object_type = ANY(${textArraySql(scope.types)})
      AND (member.is_favorite OR oc.object_type = ANY(${textArraySql(scope.postLinkedTypes)}))
  )`;
}

/**
 * Category membership on alias `cat` (LEFT JOIN `object_categories cat`):
 * uncategorized → empty `category_names`; otherwise `category_names @> path` (GIN-eligible).
 */
export function categoryMembershipFilter(
  categoryPath: readonly string[],
  uncategorizedOnly: boolean,
): RawBuilder<unknown> {
  if (uncategorizedOnly) {
    return sql`(cat.category_names IS NULL OR cardinality(cat.category_names) = 0)`;
  }
  if (categoryPath.length === 0) {
    return sql`TRUE`;
  }
  return sql`cat.category_names @> ${textArraySql(categoryPath)}`;
}

export function tagExistsFragments(
  objectIdColumn: RawBuilder<unknown>,
  tags: readonly UserFavoritesTagFilter[],
): RawBuilder<unknown>[] {
  return tags.map(
    ({ category, value }) => sql`EXISTS (
      SELECT 1 FROM object_tag_category_items tci
      WHERE tci.object_id = ${objectIdColumn}
        AND tci.category = ${category}
        AND tci.value = ${value}
    )`,
  );
}

export function ratingExistsFragment(
  objectIdColumn: RawBuilder<unknown>,
  ratingThreshold: number,
): RawBuilder<unknown> {
  const minRank = ratingThreshold * RATING_THRESHOLD_TO_RANK;
  return sql`EXISTS (
    SELECT 1 FROM object_updates ou
    WHERE ou.object_id = ${objectIdColumn}
      AND ou.update_type = 'aggregateRating'
      AND COALESCE(
        ou.rank_score,
        (
          SELECT ROUND(AVG(rv.rank))::int
          FROM rank_votes rv
          WHERE rv.update_id = ou.update_id
        )
      ) >= ${minRank}
  )`;
}

/** AND of tag filters and optional minimum rating; `TRUE` when no filter is active. */
export function objectFilterClause(
  objectIdColumn: RawBuilder<unknown>,
  tags: readonly UserFavoritesTagFilter[],
  ratingThreshold: number | null,
): RawBuilder<unknown> {
  const parts: RawBuilder<unknown>[] = [...tagExistsFragments(objectIdColumn, tags)];
  if (ratingThreshold != null) {
    parts.push(ratingExistsFragment(objectIdColumn, ratingThreshold));
  }
  if (parts.length === 0) {
    return sql`TRUE`;
  }
  return sql.join(parts, sql` AND `);
}
