import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Thread } from '@opden-data-layer/odl-db-types';

import type { Database } from '../database';
import { KYSELY } from '../database';
import {
  notInAuthorsSql,
  scoreKeysetBeforeSql,
  timeKeysetBeforeSql,
  viewerObjectIdsSql,
  type HubRankedMetric,
  type ScoreKeysetCursor,
  type TimeKeysetCursor,
} from './hub-feed-scope.sql';

const LIVE = sql<boolean>`t.deleted = false`;
const TIME_BEFORE = (cursor: TimeKeysetCursor | null) =>
  timeKeysetBeforeSql(sql`t.created_unix`, sql`t.author`, sql`t.permlink`, cursor);
const NEWEST_FIRST = sql`ORDER BY t.created_unix DESC, t.author DESC, t.permlink DESC`;

/** Score expression for a ranked thread page (also used to build the next cursor). */
function hubThreadScoreSql(metric: HubRankedMetric): RawBuilder<unknown> {
  return metric === 'net_rshares' ? sql`COALESCE(t.net_rshares, 0)` : sql`COALESCE(t.children, 0)`;
}

/**
 * Hub "Threads" tab: threads for each rail filter (site-wide new / ranked, My feed,
 * one author, one object). Object links are `threads.hashtags`.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class HubThreadsFeedRepository {
  private readonly logger = new Logger(HubThreadsFeedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findNew(
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<Thread[]> {
    return this.page(sql<Thread>`
      SELECT t.*
      FROM threads AS t
      WHERE ${LIVE}
        AND ${notInAuthorsSql(sql`t.author`, excludedAuthors)}
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Threads created since `windowStart`, highest `metric` first. */
  async findRanked(
    metric: HubRankedMetric,
    windowStart: number,
    excludedAuthors: readonly string[],
    cursor: ScoreKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<Thread[]> {
    const score = hubThreadScoreSql(metric);
    return this.page(sql<Thread>`
      SELECT t.*
      FROM threads AS t
      WHERE ${LIVE}
        AND t.created_unix >= ${windowStart}
        AND ${notInAuthorsSql(sql`t.author`, excludedAuthors)}
        AND ${scoreKeysetBeforeSql(score, sql`t.author`, sql`t.permlink`, cursor)}
      ORDER BY ${score} DESC, t.author DESC, t.permlink DESC
      LIMIT ${limitPlusOne}
    `);
  }

  /**
   * My feed: own non-bulk threads of followed accounts, plus threads whose hashtags name
   * the viewer's followed, favorited or owned objects.
   */
  async findMy(
    viewer: string,
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<Thread[]> {
    const excluded = notInAuthorsSql(sql`t.author`, excludedAuthors);
    return this.page(sql<Thread>`
      SELECT t.*
      FROM threads AS t
      INNER JOIN (
        (
          SELECT b.author, b.permlink
          FROM user_subscriptions AS us
          CROSS JOIN LATERAL (
            SELECT t.author, t.permlink
            FROM threads AS t
            WHERE t.author = us.following
              AND ${LIVE}
              AND t.bulk_message = false
              AND ${excluded}
              AND ${TIME_BEFORE(cursor)}
            ${NEWEST_FIRST}
            LIMIT ${limitPlusOne}
          ) AS b
          WHERE us.follower = ${viewer}
        )
        UNION
        (
          SELECT t.author, t.permlink
          FROM threads AS t
          WHERE ${LIVE}
            AND ${excluded}
            AND ${TIME_BEFORE(cursor)}
            AND t.hashtags && ARRAY${viewerObjectIdsSql(viewer)}
          ${NEWEST_FIRST}
          LIMIT ${limitPlusOne}
        )
      ) AS k
        ON k.author = t.author AND k.permlink = t.permlink
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Own non-bulk threads of one account (no mentions — matches the rail counter). */
  async findByAuthor(
    author: string,
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<Thread[]> {
    return this.page(sql<Thread>`
      SELECT t.*
      FROM threads AS t
      WHERE t.author = ${author}
        AND ${LIVE}
        AND t.bulk_message = false
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Threads whose hashtags contain one object id. */
  async findByObject(
    objectId: string,
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<Thread[]> {
    return this.page(sql<Thread>`
      SELECT t.*
      FROM threads AS t
      WHERE ${LIVE}
        AND t.hashtags @> ARRAY[${objectId}]::text[]
        AND ${notInAuthorsSql(sql`t.author`, excludedAuthors)}
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  private async page(query: RawBuilder<Thread>): Promise<Thread[]> {
    try {
      const result = await query.execute(this.db);
      return result.rows;
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }
}
