import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder } from 'kysely';

import type { Database } from '../database';
import { KYSELY } from '../database';
import { toUpdatesFeedJoinRow, type UpdatesFeedJoinRow } from './updates-feed.repository';
import { notInAuthorsSql, viewerObjectIdsSql } from './hub-feed-scope.sql';

/** Keyset position for newest-first update pages. */
export interface UpdateTimeCursor {
  createdAtUnix: number;
  updateId: string;
}

/** Keyset position for rank-ordered update pages. */
export interface UpdateRankCursor extends UpdateTimeCursor {
  score: number;
}

const RANK_SCORE = sql`COALESCE(ou.rank_score, 0)`;
const NEWEST_FIRST = sql`ORDER BY ou.created_at_unix DESC, ou.update_id DESC`;
const ACTIVE_OBJECT = sql`INNER JOIN objects_core AS oc ON oc.object_id = ou.object_id AND oc.status = 'active'`;

/** Same projection as `UpdatesFeedRepository`: row + creator weight + geo point. */
const JOINED_COLUMNS = sql`
  ou.*,
  COALESCE(ac.wobjects_weight, 0)::double precision AS creator_wobjects_weight,
  CASE WHEN ou.value_geo IS NULL THEN NULL ELSE ST_Y(ou.value_geo::geometry) END AS geo_lat,
  CASE WHEN ou.value_geo IS NULL THEN NULL ELSE ST_X(ou.value_geo::geometry) END AS geo_lon
`;
const CREATOR_JOIN = sql`LEFT JOIN accounts_current AS ac ON ac.name = ou.creator`;

function timeBeforeSql(cursor: UpdateTimeCursor | null): RawBuilder<boolean> {
  if (!cursor) {
    return sql<boolean>`TRUE`;
  }
  return sql<boolean>`(ou.created_at_unix, ou.update_id) < (${cursor.createdAtUnix}, ${cursor.updateId})`;
}

/**
 * Hub "Updates" tab: object updates for each rail filter (site-wide new / trending,
 * My feed, one creator, one object). Only updates of active objects.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class HubUpdatesFeedRepository {
  private readonly logger = new Logger(HubUpdatesFeedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findNew(
    excludedCreators: readonly string[],
    cursor: UpdateTimeCursor | null,
    limitPlusOne: number,
  ): Promise<UpdatesFeedJoinRow[]> {
    return this.page(sql`
      SELECT ${JOINED_COLUMNS}
      FROM object_updates AS ou
      ${ACTIVE_OBJECT}
      ${CREATOR_JOIN}
      WHERE ${notInAuthorsSql(sql`ou.creator`, excludedCreators)}
        AND ${timeBeforeSql(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /** Updates created since `windowStart`, highest `rank_score` first. */
  async findTrending(
    windowStart: number,
    excludedCreators: readonly string[],
    cursor: UpdateRankCursor | null,
    limitPlusOne: number,
  ): Promise<UpdatesFeedJoinRow[]> {
    const before = cursor
      ? sql<boolean>`(${RANK_SCORE}, ou.created_at_unix, ou.update_id) < (${cursor.score}::numeric, ${cursor.createdAtUnix}, ${cursor.updateId})`
      : sql<boolean>`TRUE`;
    return this.page(sql`
      SELECT ${JOINED_COLUMNS}
      FROM object_updates AS ou
      ${ACTIVE_OBJECT}
      ${CREATOR_JOIN}
      WHERE ou.created_at_unix >= ${windowStart}
        AND ${notInAuthorsSql(sql`ou.creator`, excludedCreators)}
        AND ${before}
      ORDER BY ${RANK_SCORE} DESC, ou.created_at_unix DESC, ou.update_id DESC
      LIMIT ${limitPlusOne}
    `);
  }

  /**
   * My feed: updates by followed accounts, plus updates of the viewer's followed,
   * favorited or owned objects. Branches return keys; `UNION` dedupes before paging.
   */
  async findMy(
    viewer: string,
    excludedCreators: readonly string[],
    cursor: UpdateTimeCursor | null,
    limitPlusOne: number,
  ): Promise<UpdatesFeedJoinRow[]> {
    const rowFilter = sql<boolean>`${notInAuthorsSql(sql`ou.creator`, excludedCreators)}
      AND ${timeBeforeSql(cursor)}`;
    return this.page(sql`
      WITH page_keys AS (
        SELECT u.update_id, u.created_at_unix
        FROM (
          (
            SELECT b.update_id, b.created_at_unix
            FROM user_subscriptions AS us
            CROSS JOIN LATERAL (
              SELECT ou.update_id, ou.created_at_unix
              FROM object_updates AS ou
              ${ACTIVE_OBJECT}
              WHERE ou.creator = us.following
                AND ${rowFilter}
              ${NEWEST_FIRST}
              LIMIT ${limitPlusOne}
            ) AS b
            WHERE us.follower = ${viewer}
          )
          UNION
          (
            SELECT b.update_id, b.created_at_unix
            FROM ${viewerObjectIdsSql(viewer)} AS vo
            CROSS JOIN LATERAL (
              SELECT ou.update_id, ou.created_at_unix
              FROM object_updates AS ou
              WHERE ou.object_id = vo.object_id
                AND ${rowFilter}
              ${NEWEST_FIRST}
              LIMIT ${limitPlusOne}
            ) AS b
          )
        ) AS u
        ORDER BY u.created_at_unix DESC, u.update_id DESC
        LIMIT ${limitPlusOne}
      )
      SELECT ${JOINED_COLUMNS}
      FROM page_keys AS pk
      INNER JOIN object_updates AS ou ON ou.update_id = pk.update_id
      ${CREATOR_JOIN}
      ORDER BY pk.created_at_unix DESC, pk.update_id DESC
    `);
  }

  async findByCreator(
    creator: string,
    cursor: UpdateTimeCursor | null,
    limitPlusOne: number,
  ): Promise<UpdatesFeedJoinRow[]> {
    return this.page(sql`
      SELECT ${JOINED_COLUMNS}
      FROM object_updates AS ou
      ${ACTIVE_OBJECT}
      ${CREATOR_JOIN}
      WHERE ou.creator = ${creator}
        AND ${timeBeforeSql(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  async findByObject(
    objectId: string,
    excludedCreators: readonly string[],
    cursor: UpdateTimeCursor | null,
    limitPlusOne: number,
  ): Promise<UpdatesFeedJoinRow[]> {
    return this.page(sql`
      SELECT ${JOINED_COLUMNS}
      FROM object_updates AS ou
      ${CREATOR_JOIN}
      WHERE ou.object_id = ${objectId}
        AND ${notInAuthorsSql(sql`ou.creator`, excludedCreators)}
        AND ${timeBeforeSql(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  private async page(query: RawBuilder<unknown>): Promise<UpdatesFeedJoinRow[]> {
    try {
      const result = await query.execute(this.db);
      return (result.rows as Record<string, unknown>[]).map(toUpdatesFeedJoinRow);
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }
}
