import type { Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { ObjectIdentifiersRepository } from './object-identifiers.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

function repo(trx: Trx): ObjectIdentifiersRepository {
  return new ObjectIdentifiersRepository(trx as unknown as Kysely<Database>);
}

async function insertObject(trx: Trx, objectId: string): Promise<void> {
  await trx
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: 'restaurant',
      creator: 'alice',
      transaction_id: `tx-${objectId}`,
      status: 'active',
      weight: null,
      meta_group_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    .execute();
}

async function insertIdentifier(
  trx: Trx,
  objectId: string,
  identifier: { type: string; value: string },
): Promise<void> {
  await trx
    .insertInto('object_updates')
    .values({
      update_id: `upd-${objectId}-${identifier.type}`,
      object_id: objectId,
      update_type: 'identifier',
      creator: 'alice',
      locale: null,
      created_at_unix: 1,
      event_seq: BigInt(1),
      transaction_id: `tx-${objectId}-identifier`,
      value_text: null,
      value_geo: null,
      value_json: identifier,
    })
    .execute();
}

describeDb('ObjectIdentifiersRepository', () => {
  const db = createTestDb();

  beforeAll(async () => {
    const migrated = await migrateToLatest({ connectionString: resolveTestPostgresUrl() });
    if (migrated.error) {
      throw migrated.error;
    }
  }, 60_000);

  afterAll(async () => {
    await db.destroy();
  });

  it('finds the object by exact googleMaps place id, ignoring other types and case variants', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'abc-cafe');
      await insertIdentifier(trx, 'abc-cafe', { type: 'googleMaps', value: 'ChIJAbC' });
      await insertObject(trx, 'xyz-product');
      await insertIdentifier(trx, 'xyz-product', { type: 'instacart', value: 'ChIJAbC2' });

      const found = await repo(trx).findObjectIdsByIdentifier('googleMaps', [
        'ChIJAbC',
        'ChIJabc',
        'ChIJAbC2',
        'none',
      ]);

      expect([...found.entries()]).toEqual([['ChIJAbC', 'abc-cafe']]);
    });
  });

  it('does not match an identifier value stored under another type', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'xyz-product');
      await insertIdentifier(trx, 'xyz-product', { type: 'instacart', value: 'ChIJsame' });

      const found = await repo(trx).findObjectIdsByIdentifier('googleMaps', ['ChIJsame']);

      expect(found.size).toBe(0);
    });
  });
});
