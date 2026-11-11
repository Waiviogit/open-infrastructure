import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { UNCATEGORIZED_CATEGORY_SENTINEL } from '@opden-data-layer/core';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { ObjectCategoriesRelatedRepository } from './object-categories-related.repository';
import { ObjectCategoriesRelatedSyncQueueRepository } from './object-categories-related-sync-queue.repository';
import { ObjectCategoriesSyncQueueRepository } from './object-categories-sync-queue.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

/** Fixture prefix; rows are committed (the repository opens its own transaction) and removed after. */
const P = 'ocrdb';
const ACCOUNT = `${P}-alice`;
const SCOPE_KEY = `${ACCOUNT}:recipe`;
const RETRY_AFTER_SEC = 60;

type Db = Kysely<OdlDatabase>;

async function insertObject(
  db: Db,
  objectId: string,
  objectType: string,
  opts: { status?: string; categories?: string[] } = {},
): Promise<void> {
  await sql`
    INSERT INTO objects_core (object_id, object_type, creator, transaction_id, status)
    VALUES (${objectId}, ${objectType}, 'creator', ${`tx-${objectId}`}, ${opts.status ?? 'active'})
  `.execute(db);
  if (opts.categories) {
    await sql`
      INSERT INTO object_categories (object_id, meta_group_id, category_names, updated_at_seq)
      VALUES (${objectId}, NULL, ${opts.categories}::text[], 1)
    `.execute(db);
  }
}

async function favorite(db: Db, objectId: string, account: string): Promise<void> {
  await sql`
    INSERT INTO object_favorite (object_id, account, event_seq, created_at)
    VALUES (${objectId}, ${account}, 1, NOW())
  `.execute(db);
}

async function linkFromPost(db: Db, objectId: string, author: string, permlink: string): Promise<void> {
  await sql`
    INSERT INTO posts (author, permlink, created_unix) VALUES (${author}, ${permlink}, 1)
    ON CONFLICT DO NOTHING
  `.execute(db);
  await sql`
    INSERT INTO post_objects (author, permlink, object_id) VALUES (${author}, ${permlink}, ${objectId})
  `.execute(db);
}

async function scopeCounts(db: Db, scopeKey: string): Promise<Record<string, number>> {
  const { rows } = await sql<{ category_name: string; objects_count: string }>`
    SELECT category_name, objects_count
    FROM object_categories_related
    WHERE scope_type = 'user' AND scope_key = ${scopeKey}
  `.execute(db);
  return Object.fromEntries(rows.map((r) => [r.category_name, Number(r.objects_count)]));
}

/** The single row a claim returned. */
function onlyRow<T>(rows: T[]): T {
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    throw new Error(`expected exactly one claimed row, got ${rows.length}`);
  }
  return row;
}

async function cleanup(db: Db): Promise<void> {
  await sql`DELETE FROM object_categories_related WHERE scope_key LIKE ${`${P}-%`}`.execute(db);
  await sql`DELETE FROM posts WHERE author LIKE ${`${P}-%`}`.execute(db);
  await sql`DELETE FROM objects_core WHERE object_id LIKE ${`${P}-%`}`.execute(db);
}

describeDb('object categories repositories (db)', () => {
  const db = createTestDb();

  beforeAll(async () => {
    await migrateToLatest({ connectionString: resolveTestPostgresUrl() });
    await cleanup(db);
  });

  afterEach(async () => {
    await cleanup(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('ObjectCategoriesRelatedRepository.replaceUserCategoryScope', () => {
    const repo = () => new ObjectCategoriesRelatedRepository(db as unknown as Kysely<Database>);

    it('aggregates favorites ∪ authored posts of the one type, active only, without ownership', async () => {
      await insertObject(db, `${P}-fav`, 'recipe', { categories: ['Soups'] });
      await insertObject(db, `${P}-post`, 'recipe', { categories: ['Soups', 'Comfort'] });
      await insertObject(db, `${P}-plain`, 'recipe');
      await insertObject(db, `${P}-owned`, 'recipe', { categories: ['Owned'] });
      await insertObject(db, `${P}-dead`, 'recipe', { status: 'unavailable', categories: ['Dead'] });
      await insertObject(db, `${P}-book`, 'book', { categories: ['Fiction'] });
      await favorite(db, `${P}-fav`, ACCOUNT);
      await favorite(db, `${P}-plain`, ACCOUNT);
      await favorite(db, `${P}-dead`, ACCOUNT);
      await favorite(db, `${P}-book`, ACCOUNT);
      await linkFromPost(db, `${P}-post`, ACCOUNT, 'p1');
      await sql`
        INSERT INTO object_ownership (object_id, account, ownership_type, event_seq, created_at)
        VALUES (${`${P}-owned`}, ${ACCOUNT}, 'exclusive', 1, NOW())
      `.execute(db);

      await repo().replaceUserCategoryScope(SCOPE_KEY, {
        account: ACCOUNT,
        objectType: 'recipe',
        includePostObjects: true,
        deselectIds: [],
      });

      expect(await scopeCounts(db, SCOPE_KEY)).toEqual({
        Soups: 2,
        Comfort: 1,
        [UNCATEGORIZED_CATEGORY_SENTINEL]: 1,
      });
    });

    it('drops post-linked objects when hidden or deselected, but keeps favorites', async () => {
      await insertObject(db, `${P}-post`, 'recipe', { categories: ['Comfort'] });
      await insertObject(db, `${P}-both`, 'recipe', { categories: ['Soups'] });
      await favorite(db, `${P}-both`, ACCOUNT);
      await linkFromPost(db, `${P}-post`, ACCOUNT, 'p1');
      await linkFromPost(db, `${P}-both`, ACCOUNT, 'p1');

      await repo().replaceUserCategoryScope(SCOPE_KEY, {
        account: ACCOUNT,
        objectType: 'recipe',
        includePostObjects: true,
        deselectIds: [`${P}-post`, `${P}-both`],
      });
      expect(await scopeCounts(db, SCOPE_KEY)).toEqual({ Soups: 1 });

      await repo().replaceUserCategoryScope(SCOPE_KEY, {
        account: ACCOUNT,
        objectType: 'recipe',
        includePostObjects: false,
        deselectIds: [],
      });
      expect(await scopeCounts(db, SCOPE_KEY)).toEqual({ Soups: 1 });
    });

    it('an empty scope removes stale rows and writes nothing (no zero sentinel)', async () => {
      await sql`
        INSERT INTO object_categories_related (scope_type, scope_key, category_name, objects_count)
        VALUES ('user', ${SCOPE_KEY}, 'Stale', 29), ('user', ${SCOPE_KEY}, ${UNCATEGORIZED_CATEGORY_SENTINEL}, 0)
      `.execute(db);

      await repo().replaceUserCategoryScope(SCOPE_KEY, {
        account: ACCOUNT,
        objectType: 'recipe',
        includePostObjects: true,
        deselectIds: [],
      });

      expect(await scopeCounts(db, SCOPE_KEY)).toEqual({});
    });

    it('deleteUserScope removes a legacy key', async () => {
      const legacy = `${ACCOUNT}:book,product`;
      await sql`
        INSERT INTO object_categories_related (scope_type, scope_key, category_name, objects_count)
        VALUES ('user', ${legacy}, 'Fiction', 3)
      `.execute(db);

      await repo().deleteUserScope(legacy);

      expect(await scopeCounts(db, legacy)).toEqual({});
    });
  });

  describe('sync queues: enqueue during a claimed task is not lost', () => {
    it('related queue keeps a scope re-enqueued after the claim, in the same second', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_related_sync_queue`.execute(trx);
        const queue = new ObjectCategoriesRelatedSyncQueueRepository(
          trx as unknown as Kysely<Database>,
        );
        await queue.enqueueMany('user', [SCOPE_KEY, SCOPE_KEY, `${ACCOUNT}:book`], 1000);

        const claimed = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(claimed).toHaveLength(2);
        const task = onlyRow(claimed.filter((t) => t.scope_key === SCOPE_KEY));

        await queue.enqueue('user', SCOPE_KEY, 1000);

        await expect(queue.deleteClaimed('user', SCOPE_KEY, task.enqueued_at)).resolves.toBe(false);
        await queue.resetAttempt('user', SCOPE_KEY);
        const again = await queue.claimBatch(10, RETRY_AFTER_SEC);
        const retried = onlyRow(again);
        expect(retried.scope_key).toBe(SCOPE_KEY);
        expect(retried.attempts).toBe(1);

        await expect(queue.deleteClaimed('user', SCOPE_KEY, retried.enqueued_at)).resolves.toBe(true);
      });
    });

    it('object queue deletes the claimed row when nothing was enqueued meanwhile', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_sync_queue`.execute(trx);
        const queue = new ObjectCategoriesSyncQueueRepository(trx as unknown as Kysely<Database>);
        await queue.enqueue(`${P}-o1`, 1000);
        const task = onlyRow(await queue.claimBatch(10, RETRY_AFTER_SEC));

        await expect(queue.deleteClaimed(`${P}-o1`, task.enqueued_at)).resolves.toBe(true);
      });
    });

    it('object queue keeps a row re-enqueued after the claim', async () => {
      await withRollback(db, async (trx) => {
        await sql`DELETE FROM object_categories_sync_queue`.execute(trx);
        const queue = new ObjectCategoriesSyncQueueRepository(trx as unknown as Kysely<Database>);
        await queue.enqueue(`${P}-o1`, 1000);
        const task = onlyRow(await queue.claimBatch(10, RETRY_AFTER_SEC));

        await queue.enqueue(`${P}-o1`, 999);

        await expect(queue.deleteClaimed(`${P}-o1`, task.enqueued_at)).resolves.toBe(false);
      });
    });
  });
});
