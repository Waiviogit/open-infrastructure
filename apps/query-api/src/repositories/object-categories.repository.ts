import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import type { WeightObjectCursorPayload } from '../domain/pagination/weight-object-cursor';
import {
  categoryMembershipFilter,
  isEmptyUserFavoritesScope,
  objectFilterClause,
  textArraySql,
  userFavoritesScopeCte,
  type UserFavoritesScope,
  type UserFavoritesTagCategoryRow,
  type UserFavoritesTagFilter,
} from './user-favorites-scope.sql';

export type ScopedObjectRow = { object_id: string; weight: number | null };

export type CategoryNamePair = { first: string; second: string };

type ScopeObjectFilters = {
  tags?: readonly UserFavoritesTagFilter[];
  rating?: number | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keyset continuation for `ORDER BY weight DESC NULLS LAST, object_id ASC` on alias `s`. */
function weightKeysetFilter(cursor: WeightObjectCursorPayload | null) {
  if (cursor == null) {
    return sql`TRUE`;
  }
  if (cursor.weight == null) {
    return sql`(s.weight IS NULL AND s.object_id > ${cursor.object_id})`;
  }
  return sql`(
    s.weight < ${cursor.weight}
    OR (s.weight = ${cursor.weight} AND s.object_id > ${cursor.object_id})
    OR s.weight IS NULL
  )`;
}

@Injectable()
export class ObjectCategoriesRepository {
  private readonly logger = new Logger(ObjectCategoriesRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Flat page of scope objects under `categoryPath` (or uncategorized), ordered by
   * `weight DESC NULLS LAST, object_id ASC` with a keyset cursor.
   */
  async findObjectIdsByScope(
    params: {
      scope: UserFavoritesScope;
      categoryPath: readonly string[];
      uncategorizedOnly: boolean;
      limit: number;
      cursor: WeightObjectCursorPayload | null;
    } & ScopeObjectFilters,
  ): Promise<{ rows: ScopedObjectRow[]; hasMore: boolean }> {
    if (isEmptyUserFavoritesScope(params.scope) || params.limit <= 0) {
      return { rows: [], hasMore: false };
    }
    const categoryFilter = categoryMembershipFilter(params.categoryPath, params.uncategorizedOnly);
    const objectFilter = objectFilterClause(sql`s.object_id`, params.tags ?? [], params.rating ?? null);
    const take = params.limit + 1;

    try {
      const result = await sql<ScopedObjectRow>`
        WITH ${userFavoritesScopeCte(params.scope)}
        SELECT s.object_id, s.weight
        FROM user_favorites_scope s
        LEFT JOIN object_categories cat ON cat.object_id = s.object_id
        WHERE (${categoryFilter})
          AND (${objectFilter})
          AND ${weightKeysetFilter(params.cursor)}
        ORDER BY s.weight DESC NULLS LAST, s.object_id ASC
        LIMIT ${take}
      `.execute(this.db);

      const hasMore = result.rows.length > params.limit;
      const rows = (hasMore ? result.rows.slice(0, params.limit) : result.rows).map((row) => ({
        object_id: row.object_id,
        weight: row.weight == null ? null : Number(row.weight),
      }));
      return { rows, hasMore };
    } catch (error) {
      this.logger.error(`findObjectIdsByScope failed: ${errorMessage(error)}`);
      return { rows: [], hasMore: false };
    }
  }

  /**
   * Up to `objectsPerCategory` scope object ids per category (full path = parentPath + name),
   * ordered by `weight DESC NULLS LAST, object_id ASC`.
   */
  async findObjectIdsByScopeForCategories(
    params: {
      scope: UserFavoritesScope;
      parentPath: readonly string[];
      categoryNames: readonly string[];
      objectsPerCategory: number;
    } & ScopeObjectFilters,
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>(params.categoryNames.map((n) => [n, []]));
    if (
      isEmptyUserFavoritesScope(params.scope) ||
      params.categoryNames.length === 0 ||
      params.objectsPerCategory <= 0
    ) {
      return result;
    }
    const objectFilter = objectFilterClause(sql`s.object_id`, params.tags ?? [], params.rating ?? null);

    try {
      const rows = await sql<{ category_name: string; object_id: string }>`
        WITH ${userFavoritesScopeCte(params.scope)},
        cats AS (
          SELECT candidate_name FROM unnest(${textArraySql(params.categoryNames)}) AS candidate_name
        )
        SELECT c.candidate_name AS category_name, picked.object_id
        FROM cats c
        CROSS JOIN LATERAL (
          SELECT s.object_id
          FROM user_favorites_scope s
          INNER JOIN object_categories cat ON cat.object_id = s.object_id
          WHERE cat.category_names @> (${textArraySql(params.parentPath)} || ARRAY[c.candidate_name]::text[])
            AND (${objectFilter})
          ORDER BY s.weight DESC NULLS LAST, s.object_id ASC
          LIMIT ${params.objectsPerCategory}
        ) picked
      `.execute(this.db);

      for (const row of rows.rows) {
        result.get(row.category_name)?.push(row.object_id);
      }
      return result;
    } catch (error) {
      this.logger.error(`findObjectIdsByScopeForCategories failed: ${errorMessage(error)}`);
      return result;
    }
  }

  /**
   * Live `COUNT(DISTINCT object_id)` per category name over scope objects whose
   * `category_names` contain `parentPath` and the name (same set the leaf list pages through).
   * Names with no matching object map to 0.
   */
  async countObjectIdsByScopeForCategories(
    params: {
      scope: UserFavoritesScope;
      parentPath: readonly string[];
      categoryNames: readonly string[];
    } & ScopeObjectFilters,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>(params.categoryNames.map((n) => [n, 0]));
    if (isEmptyUserFavoritesScope(params.scope) || params.categoryNames.length === 0) {
      return result;
    }
    const objectFilter = objectFilterClause(sql`s.object_id`, params.tags ?? [], params.rating ?? null);

    try {
      const rows = await sql<{ category_name: string; object_count: number | string }>`
        WITH ${userFavoritesScopeCte(params.scope)},
        lineage_objects AS (
          SELECT s.object_id, cat.category_names
          FROM user_favorites_scope s
          INNER JOIN object_categories cat ON cat.object_id = s.object_id
          WHERE cat.category_names @> ${textArraySql(params.parentPath)}
            AND (${objectFilter})
        )
        SELECT c.name AS category_name, COUNT(DISTINCT lo.object_id)::int AS object_count
        FROM lineage_objects lo
        CROSS JOIN LATERAL unnest(lo.category_names) AS c(name)
        WHERE c.name = ANY(${textArraySql(params.categoryNames)})
        GROUP BY c.name
      `.execute(this.db);

      for (const row of rows.rows) {
        result.set(row.category_name, Number(row.object_count));
      }
      return result;
    } catch (error) {
      this.logger.error(`countObjectIdsByScopeForCategories failed: ${errorMessage(error)}`);
      return result;
    }
  }

  /**
   * Live counts of scope objects under `parentPath` carrying both names of each pair
   * (`first` → `second` → count). Only non-zero pairs are present.
   */
  async countCategoryPairsByScope(params: {
    scope: UserFavoritesScope;
    parentPath: readonly string[];
    pairs: readonly CategoryNamePair[];
  }): Promise<Map<string, Map<string, number>>> {
    const result = new Map<string, Map<string, number>>();
    if (isEmptyUserFavoritesScope(params.scope) || params.pairs.length === 0) {
      return result;
    }

    try {
      const rows = await sql<{ first_name: string; second_name: string; object_count: number | string }>`
        WITH ${userFavoritesScopeCte(params.scope)},
        lineage_objects AS (
          SELECT s.object_id, cat.category_names
          FROM user_favorites_scope s
          INNER JOIN object_categories cat ON cat.object_id = s.object_id
          WHERE cat.category_names @> ${textArraySql(params.parentPath)}
        ),
        pairs AS (
          SELECT DISTINCT p.first_name, p.second_name
          FROM unnest(
            ${textArraySql(params.pairs.map((p) => p.first))},
            ${textArraySql(params.pairs.map((p) => p.second))}
          ) AS p(first_name, second_name)
        )
        SELECT p.first_name, p.second_name, COUNT(DISTINCT lo.object_id)::int AS object_count
        FROM lineage_objects lo
        CROSS JOIN LATERAL unnest(lo.category_names) AS a(name)
        CROSS JOIN LATERAL unnest(lo.category_names) AS b(name)
        INNER JOIN pairs p ON p.first_name = a.name AND p.second_name = b.name
        GROUP BY p.first_name, p.second_name
      `.execute(this.db);

      for (const row of rows.rows) {
        const inner = result.get(row.first_name) ?? new Map<string, number>();
        inner.set(row.second_name, Number(row.object_count));
        result.set(row.first_name, inner);
      }
      return result;
    } catch (error) {
      this.logger.error(`countCategoryPairsByScope failed: ${errorMessage(error)}`);
      return result;
    }
  }

  /** Live count of scope objects with empty `category_names` (optionally filtered). */
  async countUncategorizedObjectIdsByScope(
    params: { scope: UserFavoritesScope } & ScopeObjectFilters,
  ): Promise<number> {
    if (isEmptyUserFavoritesScope(params.scope)) {
      return 0;
    }
    const categoryFilter = categoryMembershipFilter([], true);
    const objectFilter = objectFilterClause(sql`s.object_id`, params.tags ?? [], params.rating ?? null);

    try {
      const result = await sql<{ object_count: number | string }>`
        WITH ${userFavoritesScopeCte(params.scope)}
        SELECT COUNT(*)::int AS object_count
        FROM user_favorites_scope s
        LEFT JOIN object_categories cat ON cat.object_id = s.object_id
        WHERE (${categoryFilter})
          AND (${objectFilter})
      `.execute(this.db);
      return Number(result.rows[0]?.object_count ?? 0);
    } catch (error) {
      this.logger.error(`countUncategorizedObjectIdsByScope failed: ${errorMessage(error)}`);
      return 0;
    }
  }

  /** Tag facet rows for scope objects under `categoryPath`, narrowed by active tags/rating. */
  async getTagCategoriesByScope(
    params: {
      scope: UserFavoritesScope;
      categoryPath: readonly string[];
      uncategorizedOnly: boolean;
    } & ScopeObjectFilters,
  ): Promise<UserFavoritesTagCategoryRow[]> {
    if (isEmptyUserFavoritesScope(params.scope)) {
      return [];
    }
    const categoryFilter = categoryMembershipFilter(params.categoryPath, params.uncategorizedOnly);
    const objectFilter = objectFilterClause(sql`s.object_id`, params.tags ?? [], params.rating ?? null);

    try {
      const result = await sql<UserFavoritesTagCategoryRow>`
        WITH ${userFavoritesScopeCte(params.scope)},
        narrowed_objects AS (
          SELECT s.object_id
          FROM user_favorites_scope s
          LEFT JOIN object_categories cat ON cat.object_id = s.object_id
          WHERE (${categoryFilter})
            AND (${objectFilter})
        )
        SELECT
          tci.category AS category,
          tci.value AS tag_value,
          COUNT(DISTINCT tci.object_id)::int AS object_count
        FROM object_tag_category_items tci
        INNER JOIN narrowed_objects no ON no.object_id = tci.object_id
        GROUP BY 1, 2
        ORDER BY 1 ASC, 3 DESC, 2 ASC
      `.execute(this.db);

      return result.rows.map((row) => ({
        category: row.category,
        tag_value: row.tag_value,
        object_count: Number(row.object_count),
      }));
    } catch (error) {
      this.logger.error(`getTagCategoriesByScope failed: ${errorMessage(error)}`);
      return [];
    }
  }

  /**
   * Global active objects whose `category_names` contain `categoryName` (array overlap).
   * Collapses product variants by `meta_group_id`; orders by weight DESC NULLS LAST.
   */
  async findObjectIdsByCategoryName(params: {
    categoryName: string;
    limit: number;
    cursor: WeightObjectCursorPayload | null;
    excludeObjectId?: string;
  }): Promise<{
    rows: { object_id: string; weight: number | null }[];
    hasMore: boolean;
  }> {
    const name = params.categoryName.trim();
    if (name.length === 0 || params.limit <= 0) {
      return { rows: [], hasMore: false };
    }

    const fetchLimit = params.limit + 1;
    const excludeId = params.excludeObjectId?.trim() || null;
    const cursor = params.cursor;

    const cursorFilter =
      cursor != null
        ? sql`AND (
          COALESCE(picked.weight, -1) < COALESCE(${cursor.weight}, -1)
          OR (
            COALESCE(picked.weight, -1) = COALESCE(${cursor.weight}, -1)
            AND picked.object_id > ${cursor.object_id}
          )
        )`
        : sql``;

    const excludeFilter =
      excludeId != null && excludeId.length > 0
        ? sql`AND oc.object_id <> ${excludeId}`
        : sql``;

    const nameArray = textArraySql([name]);

    const result = await sql<{ object_id: string; weight: number | null }>`
      WITH picked AS (
        SELECT DISTINCT ON (COALESCE(oc.meta_group_id, oc.object_id))
          oc.object_id AS object_id,
          oc.weight AS weight
        FROM objects_core oc
        INNER JOIN object_categories cat ON cat.object_id = oc.object_id
        WHERE oc.status = 'active'
          AND cat.category_names && ${nameArray}
          ${excludeFilter}
        ORDER BY COALESCE(oc.meta_group_id, oc.object_id), oc.weight DESC NULLS LAST, oc.object_id ASC
      )
      SELECT picked.object_id AS object_id, picked.weight AS weight
      FROM picked
      WHERE TRUE
        ${cursorFilter}
      ORDER BY picked.weight DESC NULLS LAST, picked.object_id ASC
      LIMIT ${fetchLimit}
    `.execute(this.db);

    const hasMore = result.rows.length > params.limit;
    const rows = hasMore ? result.rows.slice(0, params.limit) : result.rows;
    return { rows, hasMore };
  }
}
