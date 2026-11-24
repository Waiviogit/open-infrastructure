import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { ObjectCategoriesRelatedSyncQueueRepository } from './object-categories-related-sync-queue.repository';
import { ObjectCategoriesSyncQueueRepository } from './object-categories-sync-queue.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

const P = 'ocrdb';
const ACCOUNT = `${P}-alice`;
const SCOPE_KEY = `${ACCOUNT}:recipe`;
const RETRY_AFTER_SEC = 60;

/** The single row a claim returned. */
function onlyRow<T>(rows: T[]): T {
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    throw new Error(`expected exactly one claimed row, got ${rows.length}`);
  }
  return row;
}

describeDb('object categories sync queues (db)', () => {
  const db = createTestDb();

  beforeAll(async () => {
    await migrateToLatest({ connectionString: resolveTestPostgresUrl() });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('sync queues: enqueue during a claimed task is not lost', () => {
    it('related queue keeps a scope re-enqueued after the claim, in the same second', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_related_sync_queue`.execute(
          trx,
        );
        const queue = new ObjectCategoriesRelatedSyncQueueRepository(
          trx as unknown as Kysely<Database>,
        );
        await queue.enqueueMany(
          'user',
          [SCOPE_KEY, SCOPE_KEY, `${ACCOUNT}:book`],
          1000,
        );

        const claimed = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(claimed).toHaveLength(2);
        const task = onlyRow(claimed.filter((t) => t.scope_key === SCOPE_KEY));

        await queue.enqueue('user', SCOPE_KEY, 1000);

        await expect(
          queue.deleteClaimed('user', SCOPE_KEY, task.enqueued_at),
        ).resolves.toBe(false);
        await queue.resetAttempt('user', SCOPE_KEY);
        const again = await queue.claimBatch(10, RETRY_AFTER_SEC);
        const retried = onlyRow(again);
        expect(retried.scope_key).toBe(SCOPE_KEY);
        expect(retried.attempts).toBe(1);

        await expect(
          queue.deleteClaimed('user', SCOPE_KEY, retried.enqueued_at),
        ).resolves.toBe(true);
      });
    });

    it('object queue deletes the claimed row when nothing was enqueued meanwhile', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_sync_queue`.execute(trx);
        const queue = new ObjectCategoriesSyncQueueRepository(
          trx as unknown as Kysely<Database>,
        );
        await queue.enqueue(`${P}-o1`, 1000);
        const task = onlyRow(await queue.claimBatch(10, RETRY_AFTER_SEC));

        await expect(
          queue.deleteClaimed(`${P}-o1`, task.enqueued_at),
        ).resolves.toBe(true);
      });
    });

    it('object queue keeps a row re-enqueued after the claim', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_sync_queue`.execute(trx);
        const queue = new ObjectCategoriesSyncQueueRepository(
          trx as unknown as Kysely<Database>,
        );
        await queue.enqueue(`${P}-o1`, 1000);
        const task = onlyRow(await queue.claimBatch(10, RETRY_AFTER_SEC));

        await queue.enqueue(`${P}-o1`, 999);

        await expect(
          queue.deleteClaimed(`${P}-o1`, task.enqueued_at),
        ).resolves.toBe(false);
      });
    });
  });
});
