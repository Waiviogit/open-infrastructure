import { sql, type RawBuilder } from 'kysely';

/** Keyset position for newest-first feeds ordered by `(time, author, permlink)`. */
export interface TimeKeysetCursor {
  feedAt: number;
  author: string;
  permlink: string;
}

/** Keyset position for ranked feeds ordered by `(score, author, permlink)`; bigint score as string. */
export interface ScoreKeysetCursor {
  score: string;
  author: string;
  permlink: string;
}

/** Vote-based ranking column shared by posts and threads. */
export type HubRankedMetric = 'net_rshares' | 'children';

/**
 * Active objects in the viewer's "My feed" set: followed, favorited or owned.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
export function viewerObjectIdsSql(viewer: string): RawBuilder<unknown> {
  return sql`(
    SELECT vo.object_id
    FROM (
      SELECT object_id FROM user_object_follows WHERE account = ${viewer}
      UNION
      SELECT object_id FROM object_favorite WHERE account = ${viewer}
      UNION
      SELECT object_id FROM object_ownership WHERE account = ${viewer}
    ) AS vo
    INNER JOIN objects_core AS voc
      ON voc.object_id = vo.object_id
     AND voc.status = 'active'
  )`;
}

/** `column NOT IN (...)`, or `TRUE` when nothing is excluded. */
export function notInAuthorsSql(
  column: RawBuilder<unknown>,
  excludedAuthors: readonly string[],
): RawBuilder<boolean> {
  if (excludedAuthors.length === 0) {
    return sql<boolean>`TRUE`;
  }
  return sql<boolean>`${column} NOT IN (${sql.join(excludedAuthors.map((a) => sql`${a}`))})`;
}

/** `(time, author, permlink) < cursor`, or `TRUE` on the first page. */
export function timeKeysetBeforeSql(
  timeColumn: RawBuilder<unknown>,
  authorColumn: RawBuilder<unknown>,
  permlinkColumn: RawBuilder<unknown>,
  cursor: TimeKeysetCursor | null,
): RawBuilder<boolean> {
  if (!cursor) {
    return sql<boolean>`TRUE`;
  }
  return sql<boolean>`(${timeColumn}, ${authorColumn}, ${permlinkColumn}) < (${cursor.feedAt}, ${cursor.author}, ${cursor.permlink})`;
}

/** `(score, author, permlink) < cursor` with a numeric score, or `TRUE` on the first page. */
export function scoreKeysetBeforeSql(
  scoreExpression: RawBuilder<unknown>,
  authorColumn: RawBuilder<unknown>,
  permlinkColumn: RawBuilder<unknown>,
  cursor: ScoreKeysetCursor | null,
): RawBuilder<boolean> {
  if (!cursor) {
    return sql<boolean>`TRUE`;
  }
  return sql<boolean>`(${scoreExpression}, ${authorColumn}, ${permlinkColumn}) < (${cursor.score}::numeric, ${cursor.author}, ${cursor.permlink})`;
}
