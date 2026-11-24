import { Logger } from '@nestjs/common';
import {
  CATEGORY_OBJECT_TYPES,
  TYPE_SCOPE_TOTAL_SENTINEL,
  UNCATEGORIZED_CATEGORY_SENTINEL,
  type UserFavoritesVisibilityFlags,
} from '@opden-data-layer/core';
import type {
  NewObjectCategoriesRelatedRow,
  ObjectCategoriesRelatedRow,
  ObjectCategoriesRelatedScopeType,
  OdlDatabase,
} from '@opden-data-layer/odl-db-types';
import { sql, type Kysely, type Transaction } from 'kysely';

import {
  GLOBAL_CATEGORY_SCOPE_KEY,
  RELATED_INSERT_CHUNK_ROWS,
  SCOPE_LOCK_PREFIX,
} from './category-scope.constants';
import type { UserCategoryScopeAggOptions } from './category-scope.types';

export type CategoryScopeDbExecutor =
  | Kysely<OdlDatabase>
  | Transaction<OdlDatabase>;

type AggregationRowRaw = {
  category_name: string;
  objects_count: bigint | string | number;
  group_keys: string[];
  related_names: string[];
};

/**
 * Data access for `object_categories_related` scopes: the aggregation SQL of each scope kind,
 * the row replace, and the reads a rebuild needs. Shared by chain-indexer (queue worker) and the
 * `categories:rebuild` script; transaction boundaries belong to `CategoryScopeRebuildService`.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
export class CategoryScopeRepository {
  private readonly logger = new Logger(CategoryScopeRepository.name);

  constructor(private readonly db: Kysely<OdlDatabase>) {}

  private executor(trx?: CategoryScopeDbExecutor): CategoryScopeDbExecutor {
    return trx ?? this.db;
  }

  /** The single transaction boundary for a scope rebuild. */
  runInTransaction<T>(
    work: (trx: Transaction<OdlDatabase>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(work);
  }

  /**
   * Deletes every row of one scope, then inserts `rows` in chunks (bind-parameter limit). A
   * transaction-scoped advisory lock on the scope serializes concurrent replaces (queue worker and
   * `categories:rebuild`); without it the second insert hits the primary key.
   */
  async replaceScopeRows(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    rows: readonly NewObjectCategoriesRelatedRow[],
    trx: Transaction<OdlDatabase>,
  ): Promise<void> {
    try {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`${SCOPE_LOCK_PREFIX}:${scopeType}:${scopeKey}`}))`.execute(
        trx,
      );
      await this.deleteScope(scopeType, scopeKey, trx);
      for (let i = 0; i < rows.length; i += RELATED_INSERT_CHUNK_ROWS) {
        const chunk = rows.slice(i, i + RELATED_INSERT_CHUNK_ROWS);
        await trx
          .insertInto('object_categories_related')
          .values(chunk)
          .execute();
      }
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async deleteScope(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    trx?: CategoryScopeDbExecutor,
  ): Promise<void> {
    try {
      await this.executor(trx)
        .deleteFrom('object_categories_related')
        .where('scope_type', '=', scopeType)
        .where('scope_key', '=', scopeKey)
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async findScopeRows(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    trx?: CategoryScopeDbExecutor,
  ): Promise<ObjectCategoriesRelatedRow[]> {
    try {
      return await this.executor(trx)
        .selectFrom('object_categories_related')
        .selectAll()
        .where('scope_type', '=', scopeType)
        .where('scope_key', '=', scopeKey)
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** `user_metadata` post-linked visibility flags; `null` when the account has no row. */
  async findUserVisibilityFlags(
    account: string,
    trx?: CategoryScopeDbExecutor,
  ): Promise<UserFavoritesVisibilityFlags | null> {
    try {
      const row = await this.executor(trx)
        .selectFrom('user_metadata')
        .select([
          'hide_linked_objects',
          'hide_recipe_objects',
          'hide_favorite_objects',
        ])
        .where('account', '=', account)
        .executeTakeFirst();
      return row ?? null;
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async findDeselectedObjectIds(
    account: string,
    trx?: CategoryScopeDbExecutor,
  ): Promise<string[]> {
    try {
      const rows = await this.executor(trx)
        .selectFrom('user_shop_deselect')
        .select('object_id')
        .where('account', '=', account)
        .execute();
      return rows.map((r) => r.object_id);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * Every user scope key (`account:type`) with members (`object_favorite` ∪ `post_objects`
   * authors) of a category type, plus every stored user scope of a category type (so a scope
   * that lost its members is rebuilt empty). Optionally one account. Sorted.
   */
  async listUserScopeKeys(account: string | null): Promise<string[]> {
    const types = [...CATEGORY_OBJECT_TYPES];
    const memberFilter = account
      ? sql`WHERE members.account = ${account}`
      : sql``;
    const storedFilter = account
      ? sql`AND split_part(scope_key, ':', 1) = ${account}`
      : sql``;
    try {
      const { rows } = await sql<{ scope_key: string }>`
        SELECT members.account || ':' || oc.object_type AS scope_key
        FROM (
          SELECT object_id, account FROM object_favorite
          UNION
          SELECT object_id, author AS account FROM post_objects
        ) members
        INNER JOIN objects_core oc
          ON oc.object_id = members.object_id AND oc.object_type = ANY(${types}::text[])
        ${memberFilter}
        UNION
        SELECT scope_key
        FROM object_categories_related
        WHERE scope_type = 'user'
          AND regexp_replace(scope_key, '^.*:', '') = ANY(${types}::text[])
          AND strpos(scope_key, ':') > 1
          ${storedFilter}
        ORDER BY 1
      `.execute(this.db);
      return rows.map((r) => r.scope_key);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * One user category scope (`account:objectType`): `object_favorite(account)` ∪
   * `post_objects(author = account)`, active objects of `objectType` only. The uncategorized
   * sentinel is written only when its count > 0.
   * @see docs/apps/query-api/spec/users-favorites-endpoint.md
   */
  async aggregateUserScope(
    scopeKey: string,
    opts: UserCategoryScopeAggOptions,
    trx: CategoryScopeDbExecutor,
  ): Promise<NewObjectCategoriesRelatedRow[]> {
    const account = opts.account.trim();
    const objectType = opts.objectType.trim();
    const sentinel = UNCATEGORIZED_CATEGORY_SENTINEL;
    const postPred = this.postLinkedPredicate(opts);

    const { rows } = await sql<AggregationRowRaw>`
      WITH scope_ids AS (
        SELECT ofav.object_id
        FROM object_favorite ofav
        WHERE ofav.account = ${account}
        UNION
        SELECT po.object_id
        FROM post_objects po
        WHERE (${postPred})
      ),
      scoped_objects AS (
        SELECT
          oc.object_id,
          COALESCE(oc.meta_group_id, oc.object_id) AS group_key,
          cat.category_names AS category_names
        FROM scope_ids s
        INNER JOIN objects_core oc ON oc.object_id = s.object_id
          AND oc.status = 'active'
          AND oc.object_type = ${objectType}
        LEFT JOIN object_categories cat ON cat.object_id = oc.object_id
      ),
      exploded AS (
        SELECT
          so.group_key,
          u.cat_name AS cat_name
        FROM scoped_objects so
        CROSS JOIN LATERAL unnest(
          CASE
            WHEN so.category_names IS NOT NULL AND cardinality(so.category_names) > 0
            THEN so.category_names
            ELSE ARRAY[]::text[]
          END
        ) AS u(cat_name)
      ),
      group_keys_per_cat AS (
        SELECT cat_name, array_agg(DISTINCT group_key ORDER BY group_key) AS group_keys
        FROM exploded
        GROUP BY cat_name
      ),
      related_per_cat AS (
        SELECT
          e1.cat_name,
          array_agg(DISTINCT e2.cat_name ORDER BY e2.cat_name)
            FILTER (WHERE e2.cat_name <> e1.cat_name) AS related_names
        FROM exploded e1
        INNER JOIN exploded e2 ON e1.group_key = e2.group_key
        GROUP BY e1.cat_name
      ),
      uncategorized AS (
        SELECT COUNT(DISTINCT group_key)::bigint AS cnt
        FROM scoped_objects
        WHERE category_names IS NULL OR cardinality(category_names) = 0
      )
      SELECT
        g.cat_name AS category_name,
        cardinality(g.group_keys)::bigint AS objects_count,
        g.group_keys AS group_keys,
        COALESCE(r.related_names, ARRAY[]::text[]) AS related_names
      FROM group_keys_per_cat g
      LEFT JOIN related_per_cat r ON r.cat_name = g.cat_name
      UNION ALL
      SELECT
        ${sentinel}::text,
        u.cnt,
        ARRAY[]::text[],
        ARRAY[]::text[]
      FROM uncategorized u
      WHERE u.cnt > 0
    `.execute(trx);

    return rows.map((r) =>
      toInsertRow(
        'user',
        scopeKey,
        r.category_name,
        r.objects_count,
        r.group_keys,
        r.related_names,
      ),
    );
  }

  /** Global catalogue scope (`group_keys` stored empty arrays). */
  async aggregateGlobalScope(
    trx: CategoryScopeDbExecutor,
  ): Promise<NewObjectCategoriesRelatedRow[]> {
    const sentinel = UNCATEGORIZED_CATEGORY_SENTINEL;
    const { rows } = await sql<AggregationRowRaw>`
      WITH scoped_objects AS (
        SELECT
          oc.object_id,
          COALESCE(oc.meta_group_id, oc.object_id) AS group_key,
          cat.category_names
        FROM objects_core oc
        LEFT JOIN object_categories cat ON cat.object_id = oc.object_id
        WHERE oc.status = 'active'
      ),
      exploded AS (
        SELECT
          so.group_key,
          u.cat_name AS cat_name
        FROM scoped_objects so
        CROSS JOIN LATERAL unnest(
          CASE
            WHEN so.category_names IS NOT NULL AND cardinality(so.category_names) > 0
            THEN so.category_names
            ELSE ARRAY[]::text[]
          END
        ) AS u(cat_name)
      ),
      cnt_per_cat AS (
        SELECT cat_name, COUNT(DISTINCT group_key)::bigint AS objects_count
        FROM exploded
        GROUP BY cat_name
      ),
      related_per_cat AS (
        SELECT
          e1.cat_name,
          array_agg(DISTINCT e2.cat_name ORDER BY e2.cat_name)
            FILTER (WHERE e2.cat_name <> e1.cat_name) AS related_names
        FROM exploded e1
        INNER JOIN exploded e2 ON e1.group_key = e2.group_key
        GROUP BY e1.cat_name
      ),
      uncategorized AS (
        SELECT COUNT(DISTINCT group_key)::bigint AS cnt
        FROM scoped_objects
        WHERE category_names IS NULL OR cardinality(category_names) = 0
      )
      SELECT
        c.cat_name AS category_name,
        c.objects_count,
        ARRAY[]::text[] AS group_keys,
        COALESCE(r.related_names, ARRAY[]::text[]) AS related_names
      FROM cnt_per_cat c
      LEFT JOIN related_per_cat r ON r.cat_name = c.cat_name
      UNION ALL
      SELECT
        ${sentinel}::text,
        u.cnt,
        ARRAY[]::text[],
        ARRAY[]::text[]
      FROM uncategorized u
    `.execute(trx);

    return rows.map((r) =>
      toInsertRow(
        'global',
        GLOBAL_CATEGORY_SCOPE_KEY,
        r.category_name,
        r.objects_count,
        r.group_keys,
        r.related_names,
      ),
    );
  }

  /**
   * One type scope (key = object type): all active objects of the type, counts in groups
   * (`COALESCE(meta_group_id, object_id)`), `related_names` by co-occurrence with
   * `related_counts` = shared groups per related name, plus a `__total__` row (every active group
   * of the type, uncategorized included). `group_keys` are not stored (a whole type is too large)
   * and there is no uncategorized sentinel.
   */
  async aggregateTypeScope(
    objectType: string,
    trx: CategoryScopeDbExecutor,
  ): Promise<NewObjectCategoriesRelatedRow[]> {
    const { rows } = await sql<
      AggregationRowRaw & { related_counts: number[] }
    >`
      WITH exploded AS (
        SELECT DISTINCT
          COALESCE(oc.meta_group_id, oc.object_id) AS group_key,
          u.cat_name AS cat_name
        FROM objects_core oc
        INNER JOIN object_categories cat ON cat.object_id = oc.object_id
        CROSS JOIN LATERAL unnest(cat.category_names) AS u(cat_name)
        WHERE oc.status = 'active'
          AND oc.object_type = ${objectType}
      ),
      cnt_per_cat AS (
        SELECT cat_name, COUNT(*)::bigint AS objects_count
        FROM exploded
        GROUP BY cat_name
      ),
      pair_counts AS (
        SELECT e1.cat_name AS first_name, e2.cat_name AS second_name, COUNT(*)::int AS shared
        FROM exploded e1
        INNER JOIN exploded e2 ON e1.group_key = e2.group_key AND e2.cat_name <> e1.cat_name
        GROUP BY e1.cat_name, e2.cat_name
      ),
      related_per_cat AS (
        SELECT
          first_name AS cat_name,
          array_agg(second_name ORDER BY second_name) AS related_names,
          array_agg(shared ORDER BY second_name) AS related_counts
        FROM pair_counts
        GROUP BY first_name
      ),
      total AS (
        SELECT COUNT(DISTINCT COALESCE(oc.meta_group_id, oc.object_id))::bigint AS cnt
        FROM objects_core oc
        WHERE oc.status = 'active'
          AND oc.object_type = ${objectType}
      )
      SELECT
        c.cat_name AS category_name,
        c.objects_count,
        ARRAY[]::text[] AS group_keys,
        COALESCE(r.related_names, ARRAY[]::text[]) AS related_names,
        COALESCE(r.related_counts, ARRAY[]::int[]) AS related_counts
      FROM cnt_per_cat c
      LEFT JOIN related_per_cat r ON r.cat_name = c.cat_name
      UNION ALL
      SELECT ${TYPE_SCOPE_TOTAL_SENTINEL}::text, t.cnt, ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::int[]
      FROM total t
      WHERE t.cnt > 0
    `.execute(trx);

    return rows.map((r) => ({
      ...toInsertRow(
        'type',
        objectType,
        r.category_name,
        r.objects_count,
        r.group_keys,
        r.related_names,
      ),
      related_counts: r.related_counts.map(Number),
    }));
  }

  private postLinkedPredicate(opts: UserCategoryScopeAggOptions) {
    if (!opts.includePostObjects) {
      return sql`FALSE`;
    }
    const deselectIds = [...opts.deselectIds];
    return sql`po.author = ${opts.account.trim()} AND po.object_id <> ALL(${deselectIds}::text[])`;
  }
}

function toInsertRow(
  scopeType: ObjectCategoriesRelatedScopeType,
  scopeKey: string,
  categoryName: string,
  objectsCount: bigint | string | number,
  groupKeys: string[],
  relatedNames: string[],
): NewObjectCategoriesRelatedRow {
  return {
    scope_type: scopeType,
    scope_key: scopeKey,
    category_name: categoryName,
    objects_count: Number(objectsCount),
    group_keys: groupKeys,
    related_names: relatedNames,
  };
}
