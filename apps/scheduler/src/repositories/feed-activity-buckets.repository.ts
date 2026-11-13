import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder, type Transaction } from 'kysely';
import type { FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';
import { KYSELY, type Database } from '../database';
import { FEED_ACTIVITY_BUCKET_SEC } from '../constants/feed-activity-buckets.constants';

type DbExecutor = Kysely<Database> | Transaction<Database>;

/**
 * Hub feed counters (`feed_activity_buckets`) and presence (`feed_activity_presence`).
 * Both are derived from one item list per tab, so "has items on the tab" and
 * "new items on the tab" always agree. Data access only: the service decides ranges
 * and owns the transactions.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
@Injectable()
export class FeedActivityBucketsRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  private executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  /** Serializes writers of one table + tab until the transaction ends. */
  async lock(
    scope: 'buckets' | 'presence',
    tab: FeedActivityBucketTab,
    trx: Transaction<Database>,
  ): Promise<void> {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`feed_activity_${scope}:${tab}`}))`.execute(trx);
  }

  async deleteBucketsFromHour(
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

  async deleteBucketsBeforeHour(beforeHour: number, trx?: DbExecutor): Promise<number> {
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
  async insertBucketsFromHour(
    tab: FeedActivityBucketTab,
    fromHour: number,
    trx?: DbExecutor,
  ): Promise<number> {
    const width = sql.lit(FEED_ACTIVITY_BUCKET_SEC);
    const result = await sql`
      INSERT INTO feed_activity_buckets (tab, entity_kind, entity_id, bucket_hour, item_count)
      SELECT ${tab}, i.entity_kind, i.entity_id, (i.item_unix / ${width}) * ${width}, COUNT(*)::int
      FROM (${tabItemsSql(tab, fromHour)}) AS i
      GROUP BY i.entity_kind, i.entity_id, 4
      ON CONFLICT (tab, entity_kind, entity_id, bucket_hour)
      DO UPDATE SET item_count = EXCLUDED.item_count, updated_at = NOW()
    `.execute(this.executor(trx));
    return Number(result.numAffectedRows ?? 0);
  }

  /** Marks entities with items of `tab` since `fromUnix` as present, keeping the latest time. */
  async upsertPresenceSince(
    tab: FeedActivityBucketTab,
    fromUnix: number,
    trx?: DbExecutor,
  ): Promise<number> {
    const result = await sql`
      INSERT INTO feed_activity_presence (tab, entity_kind, entity_id, last_item_unix)
      SELECT ${tab}, i.entity_kind, i.entity_id, MAX(i.item_unix)
      FROM (${tabItemsSql(tab, fromUnix)}) AS i
      GROUP BY i.entity_kind, i.entity_id
      ON CONFLICT (tab, entity_kind, entity_id)
      DO UPDATE SET
        last_item_unix = GREATEST(feed_activity_presence.last_item_unix, EXCLUDED.last_item_unix),
        updated_at = NOW()
    `.execute(this.executor(trx));
    return Number(result.numAffectedRows ?? 0);
  }

  async deletePresence(tab: FeedActivityBucketTab, trx?: DbExecutor): Promise<number> {
    const result = await this.executor(trx)
      .deleteFrom('feed_activity_presence')
      .where('tab', '=', tab)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}

/**
 * `(entity_kind, entity_id, item_unix)`: one row per item and entity it belongs to, for
 * items of `tab` at or after `fromUnix`. Predicates match what the hub feed shows for the
 * author / object filter of that tab.
 */
function tabItemsSql(tab: FeedActivityBucketTab, fromUnix: number): RawBuilder<unknown> {
  switch (tab) {
    case 'posts':
      return postItemsSql(fromUnix);
    case 'threads':
      return threadItemsSql(fromUnix);
    case 'activity':
      return activityItemsSql(fromUnix);
    case 'updates':
      return updateItemsSql(fromUnix);
  }
}

/** Root posts by author, and by every object linked through `post_objects`. */
function postItemsSql(fromUnix: number): RawBuilder<unknown> {
  return sql`
    SELECT 'user' AS entity_kind, p.author AS entity_id, p.created_unix AS item_unix
    FROM posts AS p
    WHERE (p.depth = 0 OR p.depth IS NULL)
      AND p.created_unix >= ${fromUnix}
    UNION ALL
    SELECT 'object', po.object_id, p.created_unix
    FROM posts AS p
    INNER JOIN post_objects AS po
      ON po.author = p.author AND po.permlink = p.permlink
    WHERE (p.depth = 0 OR p.depth IS NULL)
      AND p.created_unix >= ${fromUnix}
  `;
}

/** Own non-bulk threads by author; threads whose `hashtags` name an object (once each). */
function threadItemsSql(fromUnix: number): RawBuilder<unknown> {
  return sql`
    SELECT 'user' AS entity_kind, t.author AS entity_id, t.created_unix AS item_unix
    FROM threads AS t
    WHERE t.deleted = false
      AND t.bulk_message = false
      AND t.created_unix >= ${fromUnix}
    UNION ALL
    SELECT 'object', tag.object_id, t.created_unix
    FROM threads AS t
    CROSS JOIN LATERAL (
      SELECT DISTINCT h AS object_id FROM unnest(t.hashtags) AS h
    ) AS tag
    INNER JOIN objects_core AS oc ON oc.object_id = tag.object_id
    WHERE t.deleted = false
      AND t.created_unix >= ${fromUnix}
  `;
}

/**
 * Canonical messages of object channels at their effective time
 * (`COALESCE(original_created_at_unix, created_at_unix)`); an object counts a message
 * once whether it is the channel object or a linked object.
 */
function activityItemsSql(fromUnix: number): RawBuilder<unknown> {
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
        AND COALESCE(m.original_created_at_unix, m.created_at_unix) >= ${fromUnix}
    )
    SELECT 'user' AS entity_kind, r.author AS entity_id, r.effective_unix AS item_unix
    FROM recent AS r
    UNION ALL
    SELECT 'object', o.object_id, r.effective_unix
    FROM recent AS r
    CROSS JOIN LATERAL (
      SELECT DISTINCT x AS object_id
      FROM unnest(array_append(r.linked_object_ids, r.channel_object_id)) AS x
      WHERE x IS NOT NULL
    ) AS o
  `;
}

/** Object updates by creator and by object. */
function updateItemsSql(fromUnix: number): RawBuilder<unknown> {
  return sql`
    SELECT 'user' AS entity_kind, ou.creator AS entity_id, ou.created_at_unix AS item_unix
    FROM object_updates AS ou
    WHERE ou.created_at_unix >= ${fromUnix}
    UNION ALL
    SELECT 'object', ou.object_id, ou.created_at_unix
    FROM object_updates AS ou
    WHERE ou.created_at_unix >= ${fromUnix}
  `;
}
