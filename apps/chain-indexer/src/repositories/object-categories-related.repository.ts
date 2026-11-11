import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { UNCATEGORIZED_CATEGORY_SENTINEL } from '@opden-data-layer/core';
import type { NewObjectCategoriesRelatedRow, ObjectCategoriesRelatedScopeType } from '@opden-data-layer/odl-db-types';

type DbExecutor = Kysely<Database> | Transaction<Database>;

type AggregationRowRaw = {
  category_name: string;
  objects_count: bigint;
  group_keys: string[];
  related_names: string[];
};

export type UserCategoryScopeAggOptions = {
  account: string;
  /** The single category object type of this scope (`objects_core.object_type`). */
  objectType: string;
  /** When false, the post-linked branch contributes no rows. */
  includePostObjects: boolean;
  /** `user_shop_deselect` object ids; excluded from the post-linked branch only. */
  deselectIds: readonly string[];
};

/**
 * Aggregation SQL and replace for `object_categories_related` rows (per-scope full refresh).
 */
@Injectable()
export class ObjectCategoriesRelatedRepository {
  private readonly logger = new Logger(ObjectCategoriesRelatedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  private executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  /**
   * Replaces one user category scope (`account:objectType`) in a single transaction: deletes
   * its rows, then inserts the aggregation over `object_favorite(account)` ∪
   * `post_objects(author = account)`, restricted to active objects of `objectType`.
   * An empty scope leaves no rows; the uncategorized sentinel is written only when its count > 0.
   * @see docs/apps/query-api/spec/users-favorites-endpoint.md
   */
  async replaceUserCategoryScope(
    scopeKeyFull: string,
    opts: UserCategoryScopeAggOptions,
  ): Promise<void> {
    const key = scopeKeyFull.trim();
    if (
      key.length === 0 ||
      opts.account.trim().length === 0 ||
      opts.objectType.trim().length === 0
    ) {
      return;
    }
    try {
      await this.db.transaction().execute(async (trx) => {
        await this.deleteUserScope(key, trx);
        const rows = await this.loadUserCategoryScopeRows(trx, key, opts);
        if (rows.length > 0) {
          await trx.insertInto('object_categories_related').values(rows).execute();
        }
      });
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Deletes every row of one user scope (canonical or legacy key). */
  async deleteUserScope(scopeKeyFull: string, trx?: DbExecutor): Promise<void> {
    try {
      await this.executor(trx)
        .deleteFrom('object_categories_related')
        .where('scope_type', '=', 'user')
        .where('scope_key', '=', scopeKeyFull)
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Global catalogue scope (`group_keys` stored empty arrays). */
  async replaceGlobalScope(): Promise<void> {
    try {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .deleteFrom('object_categories_related')
          .where('scope_type', '=', 'global')
          .where('scope_key', '=', '_')
          .execute();

        const rows = await this.loadGlobalScopeRows(trx);
        if (rows.length > 0) {
          await trx.insertInto('object_categories_related').values(rows).execute();
        }
      });
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  private postLinkedPredicate(opts: UserCategoryScopeAggOptions) {
    if (!opts.includePostObjects) {
      return sql`FALSE`;
    }
    const deselectIds = [...opts.deselectIds];
    return sql`po.author = ${opts.account.trim()} AND po.object_id <> ALL(${deselectIds}::text[])`;
  }

  private async loadUserCategoryScopeRows(
    trx: DbExecutor,
    scopeKeyFull: string,
    opts: UserCategoryScopeAggOptions,
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
      this.rowToInsert(
        'user',
        scopeKeyFull,
        r.category_name,
        r.objects_count,
        r.group_keys,
        r.related_names,
      ),
    );
  }

  private async loadGlobalScopeRows(
    trx: DbExecutor,
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
      this.rowToInsert(
        'global',
        '_',
        r.category_name,
        r.objects_count,
        r.group_keys,
        r.related_names,
      ),
    );
  }

  private rowToInsert(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    categoryName: string,
    objectsCount: bigint,
    groupKeys: string[],
    relatedNames: string[],
  ): NewObjectCategoriesRelatedRow {
    return {
      scope_type: scopeType,
      scope_key: scopeKey,
      category_name: categoryName,
      objects_count:
        typeof objectsCount === 'bigint'
          ? Number(objectsCount)
          : Number(objectsCount),
      group_keys: groupKeys,
      related_names: relatedNames,
    };
  }
}
