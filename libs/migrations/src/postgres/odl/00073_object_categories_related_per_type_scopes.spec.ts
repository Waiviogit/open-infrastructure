import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { createTestDb, withRollback } from '@opden-data-layer/test-postgres';
import { down, up } from './00073_object_categories_related_per_type_scopes';

type Trx = Kysely<OdlDatabase>;

async function insertObject(trx: Trx, objectId: string, objectType: string): Promise<void> {
  await sql`
    INSERT INTO objects_core (object_id, object_type, creator, transaction_id, status)
    VALUES (${objectId}, ${objectType}, 'creator', ${`tx-${objectId}`}, 'active')
  `.execute(trx);
}

async function insertRelatedRow(trx: Trx, scopeType: string, scopeKey: string): Promise<void> {
  await sql`
    INSERT INTO object_categories_related (scope_type, scope_key, category_name, objects_count)
    VALUES (${scopeType}, ${scopeKey}, 'Soups', 1)
  `.execute(trx);
}

async function insertQueueRow(trx: Trx, scopeType: string, scopeKey: string): Promise<void> {
  await sql`
    INSERT INTO object_categories_related_sync_queue (scope_type, scope_key, enqueued_at, attempts)
    VALUES (${scopeType}, ${scopeKey}, 1, 0)
  `.execute(trx);
}

async function relatedKeys(trx: Trx): Promise<string[]> {
  const { rows } = await sql<{ key: string }>`
    SELECT scope_type || '/' || scope_key AS key FROM object_categories_related ORDER BY 1
  `.execute(trx);
  return rows.map((r) => r.key);
}

async function queueKeys(trx: Trx): Promise<string[]> {
  const { rows } = await sql<{ key: string }>`
    SELECT scope_type || '/' || scope_key AS key
    FROM object_categories_related_sync_queue
    ORDER BY 1
  `.execute(trx);
  return rows.map((r) => r.key);
}

describe('00073_object_categories_related_per_type_scopes', () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.destroy();
  });

  it('deletes legacy user scopes and keeps canonical per-type and global scopes', async () => {
    await withRollback(db, async (trx) => {
      await sql`DELETE FROM object_categories_related`.execute(trx);
      await sql`DELETE FROM object_categories_related_sync_queue`.execute(trx);
      for (const key of ['alice', 'alice:book,product', 'alice:place', ':recipe', 'alice:recipe']) {
        await insertRelatedRow(trx, 'user', key);
        await insertQueueRow(trx, 'user', key);
      }
      await insertRelatedRow(trx, 'global', '_');
      await insertQueueRow(trx, 'global', '_');

      await up(trx as unknown as Kysely<unknown>);

      expect(await relatedKeys(trx)).toEqual(['global/_', 'user/alice:recipe']);
      expect(await queueKeys(trx)).toEqual(['global/_', 'user/alice:recipe']);
    });
  });

  it('enqueues account:type for favorites and authored post objects of category types only', async () => {
    await withRollback(db, async (trx) => {
      await sql`DELETE FROM object_categories_related`.execute(trx);
      await sql`DELETE FROM object_categories_related_sync_queue`.execute(trx);
      await insertObject(trx, 'm73-book', 'book');
      await insertObject(trx, 'm73-product', 'product');
      await insertObject(trx, 'm73-recipe', 'recipe');
      await insertObject(trx, 'm73-place', 'place');
      await insertObject(trx, 'm73-owned', 'service');
      await sql`
        INSERT INTO object_favorite (object_id, account, event_seq, created_at)
        VALUES
          ('m73-book', 'fan', 1, NOW()),
          ('m73-product', 'fan', 1, NOW()),
          ('m73-place', 'fan', 1, NOW())
      `.execute(trx);
      await sql`
        INSERT INTO object_ownership (object_id, account, ownership_type, event_seq, created_at)
        VALUES ('m73-owned', 'owner', 'exclusive', 1, NOW())
      `.execute(trx);
      await sql`
        INSERT INTO posts (author, permlink, created_unix) VALUES ('writer', 'p1', 1)
      `.execute(trx);
      await sql`
        INSERT INTO post_objects (author, permlink, object_id, object_type)
        VALUES ('writer', 'p1', 'm73-recipe', 'recipe')
      `.execute(trx);

      await up(trx as unknown as Kysely<unknown>);

      expect(await queueKeys(trx)).toEqual([
        'user/fan:book',
        'user/fan:product',
        'user/writer:recipe',
      ]);
    });
  });

  it('re-enqueues surviving per-type user scopes so rows built with ownership are rebuilt', async () => {
    await withRollback(db, async (trx) => {
      await sql`DELETE FROM object_categories_related`.execute(trx);
      await sql`DELETE FROM object_categories_related_sync_queue`.execute(trx);
      await insertRelatedRow(trx, 'user', 'owner:recipe');

      await up(trx as unknown as Kysely<unknown>);

      expect(await queueKeys(trx)).toEqual(['user/owner:recipe']);
    });
  });

  it('down is a no-op', async () => {
    await withRollback(db, async (trx) => {
      await sql`DELETE FROM object_categories_related`.execute(trx);
      await insertRelatedRow(trx, 'user', 'alice:recipe');

      await down(trx as unknown as Kysely<unknown>);

      expect(await relatedKeys(trx)).toEqual(['user/alice:recipe']);
    });
  });
});
