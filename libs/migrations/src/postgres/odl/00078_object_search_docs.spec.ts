import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { createTestDb, withRollback } from '@opden-data-layer/test-postgres';
import { down, up } from './00078_object_search_docs';

type Trx = Kysely<OdlDatabase>;

const SEARCH_TABLES = ['object_search_docs', 'object_search_docs_sync_queue'];
const SEARCH_INDEXES = [
  'idx_object_search_docs_geo',
  'idx_object_search_docs_type',
  'idx_object_search_docs_vector',
  'idx_object_search_docs_sync_queue_pending',
];

async function seedObject(trx: Trx, objectId: string, status: 'active' | 'closed'): Promise<void> {
  await trx
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: 'restaurant',
      creator: 'alice',
      weight: null,
      meta_group_id: null,
      canonical: null,
      canonical_creator: null,
      transaction_id: `tx-${objectId}`,
      status,
    })
    .execute();
}

async function existingTables(trx: Trx): Promise<string[]> {
  const { rows } = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = ANY(${SEARCH_TABLES}::text[])
    ORDER BY table_name
  `.execute(trx);
  return rows.map((r) => r.table_name);
}

async function existingIndexes(trx: Trx): Promise<string[]> {
  const { rows } = await sql<{ indexname: string }>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema() AND indexname = ANY(${SEARCH_INDEXES}::text[])
    ORDER BY indexname
  `.execute(trx);
  return rows.map((r) => r.indexname);
}

describe('00078_object_search_docs', () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.destroy();
  });

  it('creates the tables and indexes and enqueues every object as a bulk row', async () => {
    await withRollback(db, async (trx) => {
      await down(trx as unknown as Kysely<unknown>);
      await seedObject(trx, 'm78-active', 'active');
      await seedObject(trx, 'm78-closed', 'closed');

      await up(trx as unknown as Kysely<unknown>);

      expect(await existingTables(trx)).toEqual(SEARCH_TABLES);
      expect(await existingIndexes(trx)).toEqual([...SEARCH_INDEXES].sort());
      const { rows } = await sql<{ object_id: string; enqueued_at: string }>`
        SELECT object_id, enqueued_at::text AS enqueued_at
        FROM object_search_docs_sync_queue
        WHERE object_id LIKE 'm78-%'
        ORDER BY object_id
      `.execute(trx);
      expect(rows).toEqual([
        { object_id: 'm78-active', enqueued_at: '0' },
        { object_id: 'm78-closed', enqueued_at: '0' },
      ]);
    });
  });

  it('down removes both tables', async () => {
    await withRollback(db, async (trx) => {
      await down(trx as unknown as Kysely<unknown>);
      expect(await existingTables(trx)).toEqual([]);
    });
  });
});
