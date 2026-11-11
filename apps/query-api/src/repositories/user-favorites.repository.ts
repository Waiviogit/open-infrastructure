import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import {
  isEmptyUserFavoritesScope,
  userFavoritesScopeCte,
  type UserFavoritesScope,
} from './user-favorites-scope.sql';

/** Legacy map bbox: `[longitude, latitude]` pairs. */
export type MapBoundingBox = {
  topPoint: [number, number];
  bottomPoint: [number, number];
};

export type UserFavoritesTypeCountRow = {
  object_type: string;
  objects_count: number;
  /** Scope objects of this type with at least one materialized category. */
  categorized_count: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Read access to the unified profile Favorites scope (see `user-favorites-scope.sql.ts`). */
@Injectable()
export class UserFavoritesRepository {
  private readonly logger = new Logger(UserFavoritesRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async countByScope(scope: UserFavoritesScope): Promise<number> {
    if (isEmptyUserFavoritesScope(scope)) {
      return 0;
    }
    try {
      const row = await sql<{ c: number }>`
        WITH ${userFavoritesScopeCte(scope)}
        SELECT count(*)::int AS c FROM user_favorites_scope
      `.execute(this.db);
      return Number(row.rows[0]?.c ?? 0);
    } catch (error) {
      this.logger.error(`countByScope failed: ${errorMessage(error)}`);
      return 0;
    }
  }

  async findObjectIdsByScope(
    scope: UserFavoritesScope,
    skip: number,
    limit: number,
  ): Promise<string[]> {
    if (isEmptyUserFavoritesScope(scope) || limit <= 0) {
      return [];
    }
    try {
      const rows = await sql<{ object_id: string }>`
        WITH ${userFavoritesScopeCte(scope)}
        SELECT object_id
        FROM user_favorites_scope
        ORDER BY weight DESC NULLS LAST, object_id ASC
        OFFSET ${skip}
        LIMIT ${limit}
      `.execute(this.db);
      return rows.rows.map((r) => r.object_id);
    } catch (error) {
      this.logger.error(`findObjectIdsByScope failed: ${errorMessage(error)}`);
      return [];
    }
  }

  /** Object types present in scope with their object counts (count DESC, type ASC). */
  async findTypesByScope(scope: UserFavoritesScope): Promise<UserFavoritesTypeCountRow[]> {
    if (isEmptyUserFavoritesScope(scope)) {
      return [];
    }
    try {
      const rows = await sql<{
        object_type: string;
        objects_count: number | string;
        categorized_count: number | string;
      }>`
        WITH ${userFavoritesScopeCte(scope)}
        SELECT
          s.object_type,
          count(*)::int AS objects_count,
          count(*) FILTER (WHERE cardinality(ocat.category_names) > 0)::int AS categorized_count
        FROM user_favorites_scope s
        LEFT JOIN object_categories ocat ON ocat.object_id = s.object_id
        GROUP BY s.object_type
        ORDER BY count(*) DESC, s.object_type ASC
      `.execute(this.db);
      return rows.rows.map((r) => ({
        object_type: r.object_type,
        objects_count: Number(r.objects_count),
        categorized_count: Number(r.categorized_count),
      }));
    } catch (error) {
      this.logger.error(`findTypesByScope failed: ${errorMessage(error)}`);
      return [];
    }
  }

  /** Scope objects whose latest `geo` update lies inside `box` (scope types decide map types). */
  async findMapObjectIdsByScope(
    scope: UserFavoritesScope,
    box: MapBoundingBox,
    skip: number,
    limit: number,
  ): Promise<string[]> {
    if (isEmptyUserFavoritesScope(scope) || limit <= 0) {
      return [];
    }

    const [swLng, swLat] = box.bottomPoint;
    const [neLng, neLat] = box.topPoint;

    try {
      const rows = await sql<{ object_id: string }>`
        WITH ${userFavoritesScopeCte(scope)},
        geo_objects AS (
          SELECT s.object_id, s.weight
          FROM user_favorites_scope s
          INNER JOIN LATERAL (
            SELECT ou.value_geo
            FROM object_updates ou
            WHERE ou.object_id = s.object_id
              AND ou.update_type = 'geo'
              AND ou.value_geo IS NOT NULL
            ORDER BY ou.rank_score DESC NULLS LAST, ou.created_at_unix DESC
            LIMIT 1
          ) geo ON TRUE
          WHERE ST_Intersects(
            geo.value_geo::geometry,
            ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326)
          )
        )
        SELECT object_id
        FROM geo_objects
        ORDER BY weight DESC NULLS LAST, object_id ASC
        OFFSET ${skip}
        LIMIT ${limit}
      `.execute(this.db);
      return rows.rows.map((r) => r.object_id);
    } catch (error) {
      this.logger.error(`findMapObjectIdsByScope failed: ${errorMessage(error)}`);
      return [];
    }
  }
}
