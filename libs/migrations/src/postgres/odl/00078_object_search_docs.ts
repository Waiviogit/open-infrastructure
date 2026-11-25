import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/** `enqueued_at` of bulk queue rows: claimed after every live row. */
const BULK_ENQUEUED_AT = 0;

/**
 * Search read model: one document per active object (`object_search_docs`), maintained by
 * chain-indexer through `object_search_docs_sync_queue`.
 *
 * - `idx_object_search_docs_vector` (GIN) serves every text condition; `geo` (GiST) the map box;
 *   `object_type` lets a small type combine with a broad text condition (BitmapAnd).
 * - No index on `weight` (weight-only updates stay HOT) or on `name_norm` ("starts with" is
 *   computed on rows the text condition already found).
 * - The queue's pending index matches the claim order (live rows before bulk rows).
 *
 * Every object is enqueued as a bulk row, so the table fills from the indexer even when nobody
 * runs `pnpm search-docs:rebuild`. No rebuild here: pending migrations share one transaction.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 * @see docs/architecture/adr/search-read-model.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE object_search_docs (
      object_id      TEXT PRIMARY KEY REFERENCES objects_core (object_id) ON DELETE CASCADE,
      object_type    TEXT NOT NULL,
      group_key      TEXT COLLATE "C" NOT NULL,
      weight         DOUBLE PRECISION,
      created_at     TIMESTAMPTZ NOT NULL,
      name           TEXT,
      name_norm      TEXT,
      search_vector  TSVECTOR NOT NULL,
      geo            GEOMETRY(Point, 4326),
      content_hash   TEXT NOT NULL,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    ) WITH (fillfactor = 90)
  `.execute(db);
  await sql`
    CREATE INDEX idx_object_search_docs_vector ON object_search_docs USING gin (search_vector)
  `.execute(db);
  await sql`
    CREATE INDEX idx_object_search_docs_geo ON object_search_docs USING gist (geo)
    WHERE geo IS NOT NULL
  `.execute(db);
  await sql`
    CREATE INDEX idx_object_search_docs_type ON object_search_docs (object_type)
  `.execute(db);

  await sql`
    CREATE TABLE object_search_docs_sync_queue (
      object_id       TEXT PRIMARY KEY,
      enqueued_at     BIGINT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at BIGINT NULL
    )
  `.execute(db);
  await sql`
    CREATE INDEX idx_object_search_docs_sync_queue_pending
    ON object_search_docs_sync_queue (last_attempt_at NULLS FIRST, enqueued_at DESC)
  `.execute(db);

  await sql`
    INSERT INTO object_search_docs_sync_queue (object_id, enqueued_at, attempts, last_attempt_at)
    SELECT object_id, ${BULK_ENQUEUED_AT}::bigint, 0, NULL
    FROM objects_core
    ON CONFLICT (object_id) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS object_search_docs_sync_queue`.execute(db);
  await sql`DROP TABLE IF EXISTS object_search_docs`.execute(db);
}
