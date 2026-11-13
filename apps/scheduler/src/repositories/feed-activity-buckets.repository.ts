import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder, type Transaction } from 'kysely';
import type { FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';
import { KYSELY, type Database } from '../database';
import { FEED_ACTIVITY_BUCKET_SEC } from '../constants/feed-activity-buckets.constants';

type DbExecutor = Kysely<Database> | Transaction<Database>;

/**
 * Hourly item counts per author / object and hub tab (`feed_activity_buckets`).
 * Data access only: the service decides ranges and owns the transaction.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
@Injectable()
export class FeedActivityBucketsRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  private executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  /** Serializes writers of one tab until the transaction ends. */
  async lockTab(tab: FeedActivityBucketTab, trx: Transaction<Database>): Promise<void> {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`feed_activity_buckets:${tab}`}))`.execute(trx);
  }

  async deleteFromHour(
    tab: FeedActivityBucketTab,
    fromHour: number,
    trx?: DbExecutor,
  ): Promise<number> {
    const result = await this.executor(trx)
      .deleteFrom('feed_activity_buckets')
      .where('tab', '=', tab)
      .where('bucket_hour', '>=', fromHour)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  async deleteBeforeHour(beforeHour: number, trx?: DbExecutor): Promise<number> {
    const result = await this.executor(trx)
      .deleteFrom('feed_activity_buckets')
      .where('bucket_hour', '<', beforeHour)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  /**
   * Counts items of `tab` whose time is at or after `fromHour` and writes one row per
   * (entity, hour). Rows for the same key are overwritten, so a repeated run is idempotent.
   */
  async insertCountsFromHour(
    tab: FeedActivityBucketTab,
    fromHour: number,
    trx?: DbExecutor,
  ): Promise<number> {
    const result = await sql`
      INSERT INTO feed_activity_buckets (tab, entity_kind, entity_id, bucket_hour, item_count)
      ${countsSelect(tab, fromHour)}
      ON CONFLICT (tab, entity_kind, entity_id, bucket_hour)
      DO UPDATE SET item_count = EXCLUDED.item_count, updated_at = NOW()
    `.execute(this.executor(trx));
    return Number(result.numAffectedRows ?? 0);
  }
}

function hourOf(column: RawBuilder<unknown>): RawBuilder<number> {
  const width = sql.lit(FEED_ACTIVITY_BUCKET_SEC);
  return sql<number>`(${column} / ${width}) * ${width}`;
}

/**
 * `SELECT tab, entity_kind, entity_id, bucket_hour, item_count` for one tab.
 * Each predicate matches what the hub feed shows for that tab and filter.
 */
function countsSelect(tab: FeedActivityBucketTab, fromHour: number): RawBuilder<unknown> {
  switch (tab) {
    case 'posts':
      return postsCountsSelect(fromHour);
    case 'threads':
      return threadsCountsSelect(fromHour);
    case 'activity':
      return activityCountsSelect(fromHour);
    case 'updates':
      return updatesCountsSelect(fromHour);
  }
}

/** Root posts by author, and by every object linked through `post_objects`. */
function postsCountsSelect(fromHour: number): RawBuilder<unknown> {
  const hour = hourOf(sql`p.created_unix`);
  return sql`
    SELECT 'posts', 'user', p.author, ${hour}, COUNT(*)::int
    FROM posts AS p
    WHERE (p.depth = 0 OR p.depth IS NULL)
      AND p.created_unix >= ${fromHour}
    GROUP BY p.author, 4
    UNION ALL
    SELECT 'posts', 'object', po.object_id, ${hour}, COUNT(*)::int
    FROM posts AS p
    INNER JOIN post_objects AS po
      ON po.author = p.author AND po.permlink = p.permlink
    WHERE (p.depth = 0 OR p.depth IS NULL)
      AND p.created_unix >= ${fromHour}
    GROUP BY po.object_id, 4
  `;
}

/** Own non-bulk threads by author; threads whose `hashtags` name an object. */
function threadsCountsSelect(fromHour: number): RawBuilder<unknown> {
  const hour = hourOf(sql`t.created_unix`);
  return sql`
    SELECT 'threads', 'user', t.author, ${hour}, COUNT(*)::int
    FROM threads AS t
    WHERE t.deleted = false
      AND t.bulk_message = false
      AND t.created_unix >= ${fromHour}
    GROUP BY t.author, 4
    UNION ALL
    SELECT 'threads', 'object', tag.object_id, ${hour}, COUNT(*)::int
    FROM threads AS t
    CROSS JOIN LATERAL (
      SELECT DISTINCT h AS object_id FROM unnest(t.hashtags) AS h
    ) AS tag
    INNER JOIN objects_core AS oc ON oc.object_id = tag.object_id
    WHERE t.deleted = false
      AND t.created_unix >= ${fromHour}
    GROUP BY tag.object_id, 4
  `;
}

/**
 * Canonical messages of object channels at their effective time
 * (`COALESCE(original_created_at_unix, created_at_unix)`); an object counts a message
 * once whether it is the channel object or a linked object.
 */
function activityCountsSelect(fromHour: number): RawBuilder<unknown> {
  return sql`
    WITH recent AS (
      SELECT
        m.author,
        c.object_id AS channel_object_id,
        m.linked_object_ids,
        COALESCE(m.original_created_at_unix, m.created_at_unix) AS effective_unix
      FROM messages AS m
      INNER JOIN channels AS c ON c.channel_id = m.channel_id
      WHERE c.kind = 'object'
        AND m.message_id = m.dup_group_id
        AND COALESCE(m.original_created_at_unix, m.created_at_unix) >= ${fromHour}
    )
    SELECT 'activity', 'user', r.author, ${hourOf(sql`r.effective_unix`)}, COUNT(*)::int
    FROM recent AS r
    GROUP BY r.author, 4
    UNION ALL
    SELECT 'activity', 'object', o.object_id, ${hourOf(sql`r.effective_unix`)}, COUNT(*)::int
    FROM recent AS r
    CROSS JOIN LATERAL (
      SELECT DISTINCT x AS object_id
      FROM unnest(array_append(r.linked_object_ids, r.channel_object_id)) AS x
      WHERE x IS NOT NULL
    ) AS o
    GROUP BY o.object_id, 4
  `;
}

/** Object updates by creator and by object. */
function updatesCountsSelect(fromHour: number): RawBuilder<unknown> {
  const hour = hourOf(sql`ou.created_at_unix`);
  return sql`
    SELECT 'updates', 'user', ou.creator, ${hour}, COUNT(*)::int
    FROM object_updates AS ou
    WHERE ou.created_at_unix >= ${fromHour}
    GROUP BY ou.creator, 4
    UNION ALL
    SELECT 'updates', 'object', ou.object_id, ${hour}, COUNT(*)::int
    FROM object_updates AS ou
    WHERE ou.created_at_unix >= ${fromHour}
    GROUP BY ou.object_id, 4
  `;
}
