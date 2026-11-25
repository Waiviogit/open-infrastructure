import { Logger } from '@nestjs/common';
import type {
  AggregatedObject,
  VoterWaivPowerMap,
} from '@opden-data-layer/objects-domain';
import type {
  ObjectOwnership,
  ObjectUpdate,
  OdlDatabase,
  ValidityVote,
} from '@opden-data-layer/odl-db-types';
import { sql, type Kysely } from 'kysely';

import {
  SEARCH_DOC_UPDATE_TYPES,
  type GeoPointByUpdateId,
  type ObjectSearchGeoPoint,
} from '../document';

/** Everything `buildObjectSearchDocument` needs for a batch of objects. */
export interface ObjectSearchSourceBatch {
  /** One entry per `objects_core` row found (any status); `favorites` is always empty. */
  objects: AggregatedObject[];
  voterWaivPowers: VoterWaivPowerMap;
  geoByUpdateId: GeoPointByUpdateId;
}

/** Loads search sources for object ids; must throw on failure (never return a partial batch). */
export interface ObjectSearchSourceLoader {
  load(objectIds: readonly string[]): Promise<ObjectSearchSourceBatch>;
}

type SearchUpdateRow = Omit<
  ObjectUpdate,
  'value_text_normalized' | 'search_vector'
> & {
  longitude: number | null;
  latitude: number | null;
};

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) {
      group.push(row);
    } else {
      groups.set(id, [row]);
    }
  }
  return groups;
}

/** Resolver input: the coordinates live in `geoByUpdateId`, the search columns are not loaded. */
function toObjectUpdate(row: SearchUpdateRow): ObjectUpdate {
  return {
    update_id: row.update_id,
    object_id: row.object_id,
    update_type: row.update_type,
    creator: row.creator,
    locale: row.locale,
    created_at_unix: row.created_at_unix,
    event_seq: row.event_seq,
    transaction_id: row.transaction_id,
    value_text: row.value_text,
    value_geo: null,
    value_json: row.value_json,
    value_text_normalized: null,
    search_vector: null,
    rank_score: row.rank_score,
    rank_context: row.rank_context,
    rank_decisive_event_seq: row.rank_decisive_event_seq,
  };
}

/**
 * Trimmed batch loader for search documents: `objects_core` rows, only the
 * `SEARCH_DOC_UPDATE_TYPES` updates and their validity votes, ownerships, voter powers and the
 * coordinates of `geo` updates.
 *
 * Unlike the app loaders it **throws** on a database error: an empty result would read as
 * "object gone" and delete documents.
 */
export class ObjectSearchSourceRepository implements ObjectSearchSourceLoader {
  private readonly logger = new Logger(ObjectSearchSourceRepository.name);

  constructor(private readonly db: Kysely<OdlDatabase>) {}

  async load(objectIds: readonly string[]): Promise<ObjectSearchSourceBatch> {
    const ids = [...new Set(objectIds)];
    if (ids.length === 0) {
      return {
        objects: [],
        voterWaivPowers: new Map(),
        geoByUpdateId: new Map(),
      };
    }
    const updateTypes = [...SEARCH_DOC_UPDATE_TYPES];

    try {
      const [cores, updates, votes, ownerships] = await Promise.all([
        this.db
          .selectFrom('objects_core')
          .selectAll()
          .where('object_id', 'in', ids)
          .execute(),
        this.db
          .selectFrom('object_updates')
          .select([
            'update_id',
            'object_id',
            'update_type',
            'creator',
            'locale',
            'created_at_unix',
            'event_seq',
            'transaction_id',
            'value_text',
            'value_json',
            'rank_score',
            'rank_context',
            'rank_decisive_event_seq',
            sql<null>`NULL`.as('value_geo'),
            sql<
              number | null
            >`CASE WHEN value_geo IS NULL THEN NULL ELSE ST_X(value_geo::geometry) END`.as(
              'longitude',
            ),
            sql<
              number | null
            >`CASE WHEN value_geo IS NULL THEN NULL ELSE ST_Y(value_geo::geometry) END`.as(
              'latitude',
            ),
          ])
          .where('object_id', 'in', ids)
          .where('update_type', 'in', updateTypes)
          .execute(),
        this.db
          .selectFrom('validity_votes as vv')
          .innerJoin('object_updates as ou', 'ou.update_id', 'vv.update_id')
          .selectAll('vv')
          .where('vv.object_id', 'in', ids)
          .where('ou.update_type', 'in', updateTypes)
          .execute(),
        this.db
          .selectFrom('object_ownership')
          .selectAll()
          .where('object_id', 'in', ids)
          .execute(),
      ]);

      const voterWaivPowers = await this.loadVoterPowers(votes);
      return {
        objects: this.groupObjects(cores, updates, votes, ownerships),
        voterWaivPowers,
        geoByUpdateId: this.collectGeoPoints(updates),
      };
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  private async loadVoterPowers(
    votes: readonly ValidityVote[],
  ): Promise<VoterWaivPowerMap> {
    const voters = [...new Set(votes.map((vote) => vote.voter))];
    const powers: VoterWaivPowerMap = new Map();
    if (voters.length === 0) {
      return powers;
    }
    const rows = await this.db
      .selectFrom('user_object_powers')
      .select(['account', 'waiv_power'])
      .where('account', 'in', voters)
      .execute();
    for (const row of rows) {
      powers.set(row.account, row.waiv_power);
    }
    return powers;
  }

  private groupObjects(
    cores: AggregatedObject['core'][],
    updates: readonly SearchUpdateRow[],
    votes: readonly ValidityVote[],
    ownerships: readonly ObjectOwnership[],
  ): AggregatedObject[] {
    const updatesById = groupBy(updates, (row) => row.object_id);
    const votesById = groupBy(votes, (row) => row.object_id);
    const ownershipsById = groupBy(ownerships, (row) => row.object_id);

    return cores.map((core) => ({
      core,
      updates: (updatesById.get(core.object_id) ?? []).map(toObjectUpdate),
      validity_votes: votesById.get(core.object_id) ?? [],
      favorites: [],
      ownerships: ownershipsById.get(core.object_id) ?? [],
    }));
  }

  private collectGeoPoints(
    updates: readonly SearchUpdateRow[],
  ): GeoPointByUpdateId {
    const points = new Map<string, ObjectSearchGeoPoint>();
    for (const update of updates) {
      if (update.longitude === null || update.latitude === null) {
        continue;
      }
      points.set(update.update_id, {
        longitude: Number(update.longitude),
        latitude: Number(update.latitude),
      });
    }
    return points;
  }
}
