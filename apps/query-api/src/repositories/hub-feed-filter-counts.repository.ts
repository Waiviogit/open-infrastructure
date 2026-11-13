import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder, type Transaction } from 'kysely';
import type { FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';

import type { Database } from '../database';
import { KYSELY } from '../database';

/**
 * One followed account or object that has items on the tab: item count in the window
 * (`null` when not counted) and the time of its latest item.
 */
export interface HubFeedFollowCountRow {
  kind: 'user' | 'object';
  id: string;
  object_type: string | null;
  count: number | null;
  last_item_unix: number;
}

export interface HubFeedFollowCountsQuery {
  account: string;
  tab: FeedActivityBucketTab;
  sinceHour: number;
  maxFollows: number;
}

interface RawRow {
  kind: 'user' | 'object';
  id: string;
  object_type: string | null;
  count: number | string | null;
  last_item_unix: number | string;
}

/**
 * Rail of one tab: the account's follows (accounts, active objects) that have any item of
 * the tab (`feed_activity_presence`), with item counts summed from `feed_activity_buckets`.
 * Presence is a primary-key join and each count a primary-key range read (at most one row
 * per hour), so cost grows with the follow list, not with content.
 * @see docs/apps/query-api/spec/hub-feed-filters.md
 */
@Injectable()
export class HubFeedFilterCountsRepository {
  private readonly logger = new Logger(HubFeedFilterCountsRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Follows with counts, under `statement_timeout = timeoutMs` local to the transaction:
   * `trx` when given, otherwise a transaction of this one read. Returns `null` on timeout
   * or failure.
   */
  async findFollowsWithCounts(
    query: HubFeedFollowCountsQuery,
    timeoutMs: number,
    trx?: Transaction<Database>,
  ): Promise<HubFeedFollowCountRow[] | null> {
    const run = async (executor: Transaction<Database>) => {
      await sql`SET LOCAL statement_timeout = ${sql.lit(Math.max(1, Math.trunc(timeoutMs)))}`.execute(
        executor,
      );
      const result = await this.followsSql(query, true).execute(executor);
      return result.rows.map(toRow);
    };
    try {
      return trx ? await run(trx) : await this.db.transaction().execute(run);
    } catch (error) {
      this.logger.warn(`hub feed counters unavailable: ${(error as Error).message}`);
      return null;
    }
  }

  /** Present follows only (`count = null`): the fallback when counting timed out. */
  async findFollows(query: HubFeedFollowCountsQuery): Promise<HubFeedFollowCountRow[]> {
    try {
      const result = await this.followsSql(query, false).execute(this.db);
      return result.rows.map(toRow);
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }

  private followsSql(query: HubFeedFollowCountsQuery, withCounts: boolean): RawBuilder<RawRow> {
    const countOf = (kind: 'user' | 'object', idColumn: RawBuilder<unknown>) =>
      withCounts
        ? sql`COALESCE((
            SELECT SUM(fab.item_count)
            FROM feed_activity_buckets AS fab
            WHERE fab.tab = ${query.tab}
              AND fab.entity_kind = ${kind}
              AND fab.entity_id = ${idColumn}
              AND fab.bucket_hour >= ${query.sinceHour}
          ), 0)::int`
        : sql`NULL::int`;

    return sql<RawRow>`
      WITH followed_users AS (
        SELECT us.following AS id
        FROM user_subscriptions AS us
        WHERE us.follower = ${query.account}
        ORDER BY us.created_at DESC
        LIMIT ${query.maxFollows}
      ),
      followed_objects AS (
        SELECT uof.object_id AS id
        FROM user_object_follows AS uof
        WHERE uof.account = ${query.account}
        ORDER BY uof.created_at DESC
        LIMIT ${query.maxFollows}
      )
      SELECT
        'user' AS kind,
        fu.id,
        NULL::text AS object_type,
        ${countOf('user', sql`fu.id`)} AS count,
        fap.last_item_unix
      FROM followed_users AS fu
      INNER JOIN feed_activity_presence AS fap
        ON fap.tab = ${query.tab}
       AND fap.entity_kind = 'user'
       AND fap.entity_id = fu.id
      UNION ALL
      SELECT
        'object' AS kind,
        fo.id,
        oc.object_type,
        ${countOf('object', sql`fo.id`)} AS count,
        fap.last_item_unix
      FROM followed_objects AS fo
      INNER JOIN objects_core AS oc
        ON oc.object_id = fo.id
       AND oc.status = 'active'
      INNER JOIN feed_activity_presence AS fap
        ON fap.tab = ${query.tab}
       AND fap.entity_kind = 'object'
       AND fap.entity_id = fo.id
    `;
  }
}

function toRow(row: RawRow): HubFeedFollowCountRow {
  return {
    kind: row.kind,
    id: row.id,
    object_type: row.object_type,
    count: row.count == null ? null : Number(row.count),
    last_item_unix: Number(row.last_item_unix),
  };
}
