import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely, type RawBuilder } from 'kysely';

import type { Database } from '../database';
import { KYSELY } from '../database';
import type { MessageCursorPayload } from '../domain/messaging/message-feed-cursor';
import { normalizeActivityRow, type ObjectActivityMessageRow } from './messaging.repository';
import { notInAuthorsSql, viewerObjectIdsSql } from './hub-feed-scope.sql';

const EFFECTIVE = sql`COALESCE(m.original_created_at_unix, m.created_at_unix)`;
const CANONICAL = sql<boolean>`m.message_id = m.dup_group_id`;
const NEWEST_FIRST = sql`ORDER BY ${EFFECTIVE} DESC, m.event_seq DESC`;
const DUPLICATE_COUNT = sql`(
  SELECT COUNT(*)::int FROM messages AS d WHERE d.dup_group_id = m.dup_group_id
)`;

function beforeCursorSql(cursor: MessageCursorPayload | null): RawBuilder<boolean> {
  if (!cursor) {
    return sql<boolean>`TRUE`;
  }
  return sql<boolean>`(
    ${EFFECTIVE} < ${cursor.createdAtUnix}
    OR (${EFFECTIVE} = ${cursor.createdAtUnix} AND m.event_seq < ${cursor.eventSeq})
  )`;
}

/**
 * Hub "Activity" tab: canonical messages of object channels for the site-wide,
 * My feed and author filters (the object filter reuses
 * `MessagingRepository.listObjectActivityMessages`). Newest first by effective time.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class HubActivityFeedRepository {
  private readonly logger = new Logger(HubActivityFeedRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findNew(
    excludedAuthors: readonly string[],
    cursor: MessageCursorPayload | null,
    limitPlusOne: number,
  ): Promise<ObjectActivityMessageRow[]> {
    return this.page(sql<ObjectActivityMessageRow>`
      SELECT m.*, c.object_id AS channel_object_id, ${DUPLICATE_COUNT} AS duplicate_count
      FROM messages AS m
      INNER JOIN channels AS c ON c.channel_id = m.channel_id
      WHERE c.kind = 'object'
        AND ${CANONICAL}
        AND ${notInAuthorsSql(sql`m.author`, excludedAuthors)}
        AND ${beforeCursorSql(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  async findByAuthor(
    author: string,
    cursor: MessageCursorPayload | null,
    limitPlusOne: number,
  ): Promise<ObjectActivityMessageRow[]> {
    return this.page(sql<ObjectActivityMessageRow>`
      SELECT m.*, c.object_id AS channel_object_id, ${DUPLICATE_COUNT} AS duplicate_count
      FROM messages AS m
      INNER JOIN channels AS c ON c.channel_id = m.channel_id
      WHERE m.author = ${author}
        AND c.kind = 'object'
        AND ${CANONICAL}
        AND ${beforeCursorSql(cursor)}
      ${NEWEST_FIRST}
      LIMIT ${limitPlusOne}
    `);
  }

  /**
   * My feed: messages by followed accounts, in channels of the viewer's objects, or
   * linking those objects. Branches return keys; `DISTINCT ON` dedupes before paging.
   */
  async findMy(
    viewer: string,
    excludedAuthors: readonly string[],
    cursor: MessageCursorPayload | null,
    limitPlusOne: number,
  ): Promise<ObjectActivityMessageRow[]> {
    const rowFilter = sql<boolean>`${CANONICAL}
      AND ${notInAuthorsSql(sql`m.author`, excludedAuthors)}
      AND ${beforeCursorSql(cursor)}`;
    const keyColumns = sql`m.message_id, ${EFFECTIVE} AS effective_unix, m.event_seq`;

    return this.page(sql<ObjectActivityMessageRow>`
      WITH viewer_objects AS ${viewerObjectIdsSql(viewer)},
      branch_keys AS (
        (
          SELECT b.*
          FROM user_subscriptions AS us
          CROSS JOIN LATERAL (
            SELECT ${keyColumns}
            FROM messages AS m
            INNER JOIN channels AS c ON c.channel_id = m.channel_id
            WHERE m.author = us.following
              AND c.kind = 'object'
              AND ${rowFilter}
            ${NEWEST_FIRST}
            LIMIT ${limitPlusOne}
          ) AS b
          WHERE us.follower = ${viewer}
        )
        UNION ALL
        (
          SELECT b.*
          FROM channels AS vc
          INNER JOIN viewer_objects AS vo ON vo.object_id = vc.object_id
          CROSS JOIN LATERAL (
            SELECT ${keyColumns}
            FROM messages AS m
            WHERE m.channel_id = vc.channel_id
              AND ${rowFilter}
            ${NEWEST_FIRST}
            LIMIT ${limitPlusOne}
          ) AS b
          WHERE vc.kind = 'object'
        )
        UNION ALL
        (
          SELECT ${keyColumns}
          FROM messages AS m
          INNER JOIN channels AS c ON c.channel_id = m.channel_id
          WHERE c.kind = 'object'
            AND m.linked_object_ids && ARRAY(SELECT object_id FROM viewer_objects)
            AND ${rowFilter}
          ${NEWEST_FIRST}
          LIMIT ${limitPlusOne}
        )
      ),
      page_keys AS (
        SELECT u.message_id, u.effective_unix, u.event_seq
        FROM (
          SELECT DISTINCT ON (k.message_id) k.message_id, k.effective_unix, k.event_seq
          FROM branch_keys AS k
          ORDER BY k.message_id
        ) AS u
        ORDER BY u.effective_unix DESC, u.event_seq DESC
        LIMIT ${limitPlusOne}
      )
      SELECT m.*, c.object_id AS channel_object_id, ${DUPLICATE_COUNT} AS duplicate_count
      FROM page_keys AS pk
      INNER JOIN messages AS m ON m.message_id = pk.message_id
      INNER JOIN channels AS c ON c.channel_id = m.channel_id
      ORDER BY pk.effective_unix DESC, pk.event_seq DESC
    `);
  }

  private async page(
    query: RawBuilder<ObjectActivityMessageRow>,
  ): Promise<ObjectActivityMessageRow[]> {
    try {
      const result = await query.execute(this.db);
      return result.rows.map(normalizeActivityRow);
    } catch (error) {
      this.logger.error((error as Error).message);
      return [];
    }
  }
}
