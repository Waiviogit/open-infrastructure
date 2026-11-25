import { Logger } from '@nestjs/common';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { sql, type Kysely } from 'kysely';

import { computeContentHash, type ObjectSearchDocument } from '../document';
import { normalizeSearchText } from '../text';
import type {
  ObjectSearchSink,
  ObjectSearchSinkBatch,
  ObjectSearchSinkOptions,
} from './object-search-sink';

/** One row of the JSONB batch parameter (`jsonb_to_recordset`). */
interface PostgresSearchDocRecord {
  object_id: string;
  object_type: string;
  group_key: string;
  weight: number | null;
  created_at: string;
  name: string | null;
  name_norm: string | null;
  /** Normalized texts per vector weight: A names, B titles, C identifiers / locality / id, D descriptions. */
  text_a: string;
  text_b: string;
  text_c: string;
  text_d: string;
  longitude: number | null;
  latitude: number | null;
  content_hash: string;
}

function joinNormalized(texts: readonly (string | null)[]): string {
  return texts
    .filter((text): text is string => text !== null)
    .map(normalizeSearchText)
    .filter((text) => text.length > 0)
    .join(' ');
}

/** Each identifier as words and once without separators (`978-3-16` → `978 3 16` and `978316`). */
function identifierTexts(identifiers: readonly string[]): string[] {
  return identifiers.flatMap((identifier) => {
    const words = normalizeSearchText(identifier);
    const compact = words.replace(/ /g, '');
    return compact === words ? [words] : [words, compact];
  });
}

function toRecord(doc: ObjectSearchDocument): PostgresSearchDocRecord {
  return {
    object_id: doc.objectId,
    object_type: doc.objectType,
    group_key: doc.groupKey,
    weight: doc.weight,
    created_at: doc.createdAt.toISOString(),
    name: doc.name,
    name_norm: doc.name === null ? null : normalizeSearchText(doc.name),
    text_a: joinNormalized(doc.names),
    text_b: joinNormalized(doc.titles),
    text_c: joinNormalized([
      ...identifierTexts(doc.identifiers),
      doc.locality,
      doc.objectId,
    ]),
    text_d: joinNormalized(doc.descriptions),
    longitude: doc.geo?.longitude ?? null,
    latitude: doc.geo?.latitude ?? null,
    content_hash: computeContentHash(doc),
  };
}

/**
 * Writes documents to `object_search_docs` in one transaction of three statements, the batch
 * passed as one JSONB parameter:
 * 1. upsert of rows that are new or whose `content_hash` differs (every row with `force`); the
 *    vector is built here from normalized text. Rows go in `object_id` order, so every writer
 *    locks in the same order; `ON CONFLICT` locks unchanged rows too;
 * 2. `weight` of rows whose hash is unchanged — a separate statement that sets only `weight`, so
 *    the update is HOT and the GIN index is not touched;
 * 3. delete of `deleteIds`.
 * Documents of objects without a `objects_core` row are skipped (FK). Constructed with a
 * transaction, the sink writes inside it instead of opening its own.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
export class PostgresObjectSearchSink implements ObjectSearchSink {
  private readonly logger = new Logger(PostgresObjectSearchSink.name);

  constructor(private readonly db: Kysely<OdlDatabase>) {}

  async apply(
    batch: ObjectSearchSinkBatch,
    options: ObjectSearchSinkOptions = {},
  ): Promise<void> {
    if (batch.upserts.length === 0 && batch.deleteIds.length === 0) {
      return;
    }
    const records = JSON.stringify(batch.upserts.map(toRecord));
    const deleteIds = [...batch.deleteIds];
    const force = options.force === true;

    try {
      await this.inTransaction(async (trx) => {
        if (batch.upserts.length > 0) {
          await sql`
            INSERT INTO object_search_docs AS d (
              object_id, object_type, group_key, weight, created_at, name, name_norm,
              search_vector, geo, content_hash, updated_at
            )
            SELECT
              r.object_id, r.object_type, r.group_key, r.weight, r.created_at, r.name, r.name_norm,
              setweight(to_tsvector('simple', r.text_a), 'A')
                || setweight(to_tsvector('simple', r.text_b), 'B')
                || setweight(to_tsvector('simple', r.text_c), 'C')
                || setweight(to_tsvector('simple', r.text_d), 'D'),
              CASE
                WHEN r.longitude IS NULL OR r.latitude IS NULL THEN NULL
                ELSE ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
              END,
              r.content_hash,
              now()
            FROM jsonb_to_recordset(${records}::jsonb) AS r(
              object_id text, object_type text, group_key text, weight double precision,
              created_at timestamptz, name text, name_norm text,
              text_a text, text_b text, text_c text, text_d text,
              longitude double precision, latitude double precision, content_hash text
            )
            WHERE EXISTS (SELECT 1 FROM objects_core oc WHERE oc.object_id = r.object_id)
            ORDER BY r.object_id COLLATE "C"
            ON CONFLICT (object_id) DO UPDATE SET
              object_type = EXCLUDED.object_type,
              group_key = EXCLUDED.group_key,
              weight = EXCLUDED.weight,
              created_at = EXCLUDED.created_at,
              name = EXCLUDED.name,
              name_norm = EXCLUDED.name_norm,
              search_vector = EXCLUDED.search_vector,
              geo = EXCLUDED.geo,
              content_hash = EXCLUDED.content_hash,
              updated_at = now()
            WHERE ${force} OR d.content_hash <> EXCLUDED.content_hash
          `.execute(trx);

          await sql`
            UPDATE object_search_docs AS d
            SET weight = r.weight
            FROM jsonb_to_recordset(${records}::jsonb) AS r(
              object_id text, weight double precision, content_hash text
            )
            WHERE d.object_id = r.object_id
              AND d.content_hash = r.content_hash
              AND d.weight IS DISTINCT FROM r.weight
          `.execute(trx);
        }

        if (deleteIds.length > 0) {
          await sql`
            DELETE FROM object_search_docs
            WHERE object_id = ANY(${deleteIds}::text[])
          `.execute(trx);
        }
      });
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Built on a transaction: write in it (the caller owns the boundary). Otherwise open one. */
  private async inTransaction(
    work: (trx: Kysely<OdlDatabase>) => Promise<void>,
  ): Promise<void> {
    if (this.db.isTransaction) {
      await work(this.db);
      return;
    }
    await this.db.transaction().execute(work);
  }
}
