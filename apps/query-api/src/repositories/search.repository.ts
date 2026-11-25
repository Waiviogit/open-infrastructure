import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  buildPrefixTsQuery,
  normalizeSearchText,
} from '@opden-data-layer/object-search';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { SEARCH_COUNTS_MATCH_CAP } from '../constants/search.constants';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { escapeIlikePattern, prefixUpperBound } from './search-prefix.utils';

export interface SearchObjectCandidateRow {
  object_id: string;
  object_type: string;
  weight: number | null;
}

export interface SearchUserRow {
  name: string;
  posting_json_metadata: string | null;
  json_metadata: string | null;
  profile_image: string | null;
  object_reputation: number;
  wobjects_weight: number;
  followers_count: number;
  is_following: boolean;
}

/** Matching objects per `object_type`, counted in groups; `capped` = the match cap was hit. */
export interface SearchObjectTypeCounts {
  counts: Record<string, number>;
  capped: boolean;
}

function toCount(raw: number | string): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

@Injectable()
export class SearchRepository {
  private readonly logger = new Logger(SearchRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Object hits from the search documents (one per active object): every query word must match a
   * word prefix of the object's names, titles, identifiers, locality, id words or descriptions
   * (GIN on `search_vector`). One hit per group (`group_key`). Order: exact `object_id`, exact
   * name, name starts with the query, `weight`, `object_id`. The caller projects the ids through
   * active cores only, so a stale document of a deactivated object is dropped there.
   * @see docs/apps/query-api/spec/search.md
   */
  async searchObjects(
    queryText: string,
    limit: number,
  ): Promise<SearchObjectCandidateRow[]> {
    const trimmed = queryText.trim();
    const tsQuery = buildPrefixTsQuery(trimmed);
    if (tsQuery === null) {
      return [];
    }
    const qNorm = normalizeSearchText(trimmed);

    try {
      const result = await sql<SearchObjectCandidateRow>`
        WITH matched AS (
          SELECT d.object_id, d.object_type, d.group_key, d.weight,
            (d.object_id = ${trimmed}) AS is_exact_id,
            (d.name_norm = ${qNorm}) AS is_exact_name,
            (d.name_norm LIKE ${qNorm} || '%') AS is_name_prefix
          FROM object_search_docs d
          WHERE d.search_vector @@ to_tsquery('simple', ${tsQuery})
        ),
        collapsed AS (
          SELECT DISTINCT ON (group_key) *
          FROM matched
          ORDER BY group_key, is_exact_id DESC, is_exact_name DESC, is_name_prefix DESC,
            weight DESC NULLS LAST, object_id COLLATE "C"
        )
        SELECT object_id, object_type, weight
        FROM collapsed
        ORDER BY is_exact_id DESC, is_exact_name DESC, is_name_prefix DESC,
          weight DESC NULLS LAST, object_id COLLATE "C"
        LIMIT ${limit}
      `.execute(this.db);

      return result.rows;
    } catch (error) {
      this.logger.error(
        `searchObjects failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Prefix match on `accounts_current.name` (btree range on PK), ordered by exact name match,
   * then Waiv object weight then followers.
   */
  async searchUsers(
    queryText: string,
    limit: number,
    viewer?: string | null,
  ): Promise<SearchUserRow[]> {
    const trimmed = queryText.trim();
    if (!trimmed) {
      return [];
    }

    const prefix = escapeIlikePattern(trimmed).toLowerCase();
    const upper = prefixUpperBound(prefix);
    const viewerTrimmed = viewer?.trim() || '';

    try {
      const rows = await this.db
        .selectFrom('accounts_current')
        .select([
          'name',
          'posting_json_metadata',
          'json_metadata',
          'profile_image',
          'object_reputation',
          'wobjects_weight',
          'followers_count',
          viewerTrimmed.length === 0
            ? sql<boolean>`false`.as('is_following')
            : sql<boolean>`EXISTS (
              SELECT 1 FROM user_subscriptions us
              WHERE us.follower = ${viewerTrimmed}
                AND us.following = accounts_current.name
            )`.as('is_following'),
        ])
        .where('name', '>=', prefix)
        .where('name', '<', upper)
        .orderBy(sql`CASE WHEN name = ${prefix} THEN 0 ELSE 1 END`)
        .orderBy(sql`wobjects_weight desc nulls last`)
        .orderBy('followers_count', 'desc')
        .limit(limit)
        .execute();

      return rows.map((r) => ({
        name: r.name,
        posting_json_metadata: r.posting_json_metadata,
        json_metadata: r.json_metadata,
        profile_image: r.profile_image,
        object_reputation: r.object_reputation,
        wobjects_weight: r.wobjects_weight ?? 0,
        followers_count: r.followers_count,
        is_following: Boolean(r.is_following),
      }));
    } catch (error) {
      this.logger.error(
        `searchUsers failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Matching objects per `object_type` for query `q`, counted in groups (`group_key`). At most
   * `matchCap` documents are counted; `capped` is true when more match, and the counts are then
   * lower bounds.
   * @see docs/apps/query-api/spec/search.md
   */
  async countObjectsByType(
    queryText: string,
    matchCap: number = SEARCH_COUNTS_MATCH_CAP,
  ): Promise<SearchObjectTypeCounts> {
    const tsQuery = buildPrefixTsQuery(queryText.trim());
    if (tsQuery === null) {
      return { counts: {}, capped: false };
    }

    try {
      const result = await sql<{
        object_type: string;
        matched: number | string;
        cnt: number | string;
      }>`
        SELECT m.object_type,
          count(*)::int AS matched,
          count(DISTINCT m.group_key)::int AS cnt
        FROM (
          SELECT d.object_type, d.group_key
          FROM object_search_docs d
          WHERE d.search_vector @@ to_tsquery('simple', ${tsQuery})
          LIMIT ${matchCap + 1}
        ) m
        GROUP BY m.object_type
      `.execute(this.db);

      const counts: Record<string, number> = {};
      let matchedTotal = 0;
      for (const row of result.rows) {
        counts[row.object_type] = toCount(row.cnt);
        matchedTotal += toCount(row.matched);
      }
      return { counts, capped: matchedTotal > matchCap };
    } catch (error) {
      this.logger.error(
        `countObjectsByType failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { counts: {}, capped: false };
    }
  }

  /** Total users matching the name prefix for `q` (no row cap). */
  async countUsers(queryText: string): Promise<number> {
    const trimmed = queryText.trim();
    if (!trimmed) {
      return 0;
    }

    const prefix = escapeIlikePattern(trimmed).toLowerCase();
    const upper = prefixUpperBound(prefix);

    try {
      const row = await this.db
        .selectFrom('accounts_current')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('name', '>=', prefix)
        .where('name', '<', upper)
        .executeTakeFirst();

      const raw = row?.n;
      const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    } catch (error) {
      this.logger.error(
        `countUsers failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
