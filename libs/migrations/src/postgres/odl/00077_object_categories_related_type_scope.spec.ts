import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { createTestDb, withRollback } from '@opden-data-layer/test-postgres';
import { down, up } from './00077_object_categories_related_type_scope';

type Trx = Kysely<OdlDatabase>;

async function insertTypeRow(trx: Trx): Promise<void> {
  await sql`
    INSERT INTO object_categories_related (scope_type, scope_key, category_name, objects_count)
    VALUES ('type', 'product', 'Audio', 3)
  `.execute(trx);
}

async function queuedTypeScopes(trx: Trx): Promise<string[]> {
  const { rows } = await sql<{ scope_key: string }>`
    SELECT scope_key FROM object_categories_related_sync_queue
    WHERE scope_type = 'type'
    ORDER BY scope_key
  `.execute(trx);
  return rows.map((r) => r.scope_key);
}

describe('00077_object_categories_related_type_scope', () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.destroy();
  });

  it('accepts the type scope and enqueues every category type', async () => {
    await withRollback(db, async (trx) => {
      await sql`DELETE FROM object_categories_related_sync_queue`.execute(trx);
      await up(trx as unknown as Kysely<unknown>);

      await expect(insertTypeRow(trx)).resolves.toBeUndefined();
      const { rows } = await sql<{ related_counts: number[] }>`
        SELECT related_counts FROM object_categories_related
        WHERE scope_type = 'type' AND scope_key = 'product'
      `.execute(trx);
      expect(rows[0]?.related_counts).toEqual([]);
      expect(await queuedTypeScopes(trx)).toEqual([
        'book',
        'link',
        'person',
        'product',
        'recipe',
        'service',
        'service_offer',
        'service_request',
      ]);
    });
  });

  it('down removes type rows and rejects the type scope again', async () => {
    await withRollback(db, async (trx) => {
      await insertTypeRow(trx);
      await down(trx as unknown as Kysely<unknown>);

      const { rows } = await sql<{ n: string }>`
        SELECT count(*)::text AS n FROM object_categories_related WHERE scope_type = 'type'
      `.execute(trx);
      expect(rows[0]?.n).toBe('0');
      expect(await queuedTypeScopes(trx)).toEqual([]);
      const { rows: columns } = await sql<{ n: string }>`
        SELECT count(*)::text AS n FROM information_schema.columns
        WHERE table_name = 'object_categories_related' AND column_name = 'related_counts'
      `.execute(trx);
      expect(columns[0]?.n).toBe('0');
      // Last: the failing insert aborts the transaction.
      await expect(insertTypeRow(trx)).rejects.toThrow(/scope_type_check/);
    });
  });
});
