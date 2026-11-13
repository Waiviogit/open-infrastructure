import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder } from 'kysely';

import type { Database } from '../database';
import { KYSELY } from '../database';
import type { FeedBranchRow } from './posts.repository';
import {
  notInAuthorsSql,
  scoreKeysetBeforeSql,
  timeKeysetBeforeSql,
  viewerObjectIdsSql,
  type HubRankedMetric,
  type ScoreKeysetCursor,
  type TimeKeysetCursor,
} from './hub-feed-scope.sql';

/** Ranked page row: the score travels as a string (bigint `net_rshares`). */
export type RankedFeedBranchRow = FeedBranchRow & { score: string };

/**
 * `(depth = 0 OR depth IS NULL)` exactly matches the partial index
 * `idx_posts_root_created_unix`, so newest-first scans use it.
 */
const ROOT = sql<boolean>`(p.depth = 0 OR p.depth IS NULL)`;
const TIME_BEFORE = (cursor: TimeKeysetCursor | null) =>
  timeKeysetBeforeSql(sql`p.created_unix`, sql`p.author`, sql`p.permlink`, cursor);
const NEWEST_FIRST = sql`ORDER BY p.created_unix DESC, p.author DESC, p.permlink DESC`;

interface RawBranchRow {
  author: string;
  permlink: string;
  feed_at: number | string;
}

/**
 * Hub "Posts" tab: root posts for each rail filter (site-wide new / ranked, My feed,
 * one author, one object). Returns keys only; hydration happens in the domain layer.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class HubPostsFeedRepository {
  private readonly logger = new Logger(HubPostsFeedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findNew(
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<FeedBranchRow[]> {
    return this.timePage(sql<RawBranchRow>`
      SELECT p.author, p.permlink, p.created_unix AS feed_at
      FROM posts AS p
      WHERE ${ROOT}
        AND ${notInAuthorsSql(sql`p.author`, excludedAuthors)}
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Root posts created since `windowStart`, highest `metric` first. */
  async findRanked(
    metric: HubRankedMetric,
    windowStart: number,
    excludedAuthors: readonly string[],
    cursor: ScoreKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<RankedFeedBranchRow[]> {
    const score = metric === 'net_rshares' ? sql`COALESCE(p.net_rshares, 0)` : sql`COALESCE(p.children, 0)`;
    try {
      const result = await sql<RawBranchRow & { score: string | number }>`
        SELECT p.author, p.permlink, p.created_unix AS feed_at, ${score}::text AS score
        FROM posts AS p
        WHERE ${ROOT}
          AND p.created_unix >= ${windowStart}
          AND ${notInAuthorsSql(sql`p.author`, excludedAuthors)}
          AND ${scoreKeysetBeforeSql(score, sql`p.author`, sql`p.permlink`, cursor)}
        ORDER BY ${score} DESC, p.author DESC, p.permlink DESC
        LIMIT ${limitPlusOne}
      `.execute(this.db);
      return result.rows.map((r) => ({ ...toBranchRow(r), score: String(r.score) }));
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }

  /**
   * My feed: posts by followed accounts, plus posts linked to the viewer's followed,
   * favorited or owned objects. Each branch is limited before the merge; `UNION` dedupes.
   */
  async findMy(
    viewer: string,
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<FeedBranchRow[]> {
    const excluded = notInAuthorsSql(sql`p.author`, excludedAuthors);
    return this.timePage(sql<RawBranchRow>`
      SELECT u.author, u.permlink, u.feed_at
      FROM (
        (
          SELECT b.author, b.permlink, b.feed_at
          FROM user_subscriptions AS us
          CROSS JOIN LATERAL (
            SELECT p.author, p.permlink, p.created_unix AS feed_at
            FROM posts AS p
            WHERE p.author = us.following
              AND ${ROOT}
              AND ${excluded}
              AND ${TIME_BEFORE(cursor)}
            ${NEWEST_FIRST}
            LIMIT ${limitPlusOne}
          ) AS b
          WHERE us.follower = ${viewer}
        )
        UNION
        (
          SELECT p.author, p.permlink, p.created_unix AS feed_at
          FROM posts AS p
          WHERE ${ROOT}
            AND ${excluded}
            AND ${TIME_BEFORE(cursor)}
            AND EXISTS (
              SELECT 1
              FROM post_objects AS po
              WHERE po.author = p.author
                AND po.permlink = p.permlink
                AND po.object_id IN ${viewerObjectIdsSql(viewer)}
            )
          ${NEWEST_FIRST}
          LIMIT ${limitPlusOne}
        )
      ) AS u
      ORDER BY u.feed_at DESC, u.author DESC, u.permlink DESC
      LIMIT ${limitPlusOne}
    `);
  }

  /** Own root posts of one account (no reblogs — matches the rail counter). */
  async findByAuthor(
    author: string,
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<FeedBranchRow[]> {
    return this.timePage(sql<RawBranchRow>`
      SELECT p.author, p.permlink, p.created_unix AS feed_at
      FROM posts AS p
      WHERE p.author = ${author}
        AND ${ROOT}
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Root posts linked to one object through `post_objects`. */
  async findByObject(
    objectId: string,
    excludedAuthors: readonly string[],
    cursor: TimeKeysetCursor | null,
    limitPlusOne: number,
  ): Promise<FeedBranchRow[]> {
    return this.timePage(sql<RawBranchRow>`
      SELECT p.author, p.permlink, p.created_unix AS feed_at
      FROM post_objects AS po
      INNER JOIN posts AS p
        ON p.author = po.author AND p.permlink = po.permlink
      WHERE po.object_id = ${objectId}
        AND ${ROOT}
        AND ${notInAuthorsSql(sql`p.author`, excludedAuthors)}
        AND ${TIME_BEFORE(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  private async timePage(query: RawBuilder<RawBranchRow>): Promise<FeedBranchRow[]> {
    try {
      const result = await query.execute(this.db);
      return result.rows.map(toBranchRow);
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }
}

function toBranchRow(row: RawBranchRow): FeedBranchRow {
  return {
    author: row.author,
    permlink: row.permlink,
    feed_at: Number(row.feed_at),
    reblogged_by: null,
  };
}
