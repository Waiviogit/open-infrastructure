import { sql, type Kysely, type Transaction } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import { ObjectSearchQueueRepository } from '@opden-data-layer/object-search';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../../database';
import { HiveEngineRatesRepository } from '../../repositories/hive-engine-rates.repository';
import { PostExpertiseRepository } from '../../repositories/post-expertise.repository';
import { PostObjectsRepository } from '../../repositories/post-objects.repository';
import { PostsRewardRepository } from '../../repositories/posts-reward.repository';
import { PostExpertiseService } from './post-expertise.service';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const AUTHOR = 'sched-expertise-author';
const PERMLINK = 'sched-expertise-post';
const OBJECT_A = 'sched-expertise-object-a';
const OBJECT_B = 'sched-expertise-object-b';
const OBJECT_UNTOUCHED = 'sched-expertise-object-c';
const TEST_OBJECT_IDS = [OBJECT_A, OBJECT_B, OBJECT_UNTOUCHED];
const CREATED_UNIX = 1_700_000_000;
const SAVEPOINT = 'post_expertise_service_spec';

/**
 * The service owns `db.transaction()`, which a test transaction cannot open; a savepoint inside
 * the test transaction gives the same commit / rollback semantics and is undone by `withRollback`.
 */
function savepointDb(trx: Trx): Kysely<Database> {
  return {
    transaction: () => ({
      execute: async <T>(
        cb: (inner: Transaction<Database>) => Promise<T>,
      ): Promise<T> => {
        await sql.raw(`SAVEPOINT ${SAVEPOINT}`).execute(trx);
        try {
          const result = await cb(trx as unknown as Transaction<Database>);
          await sql.raw(`RELEASE SAVEPOINT ${SAVEPOINT}`).execute(trx);
          return result;
        } catch (e) {
          await sql.raw(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`).execute(trx);
          throw e;
        }
      },
    }),
  } as unknown as Kysely<Database>;
}

/** The queue repository runs on its own pool connection: only the passed `trx` puts it inside. */
function makeService(
  trx: Trx,
  queue: ObjectSearchQueueRepository,
): PostExpertiseService {
  const db = trx as unknown as Kysely<Database>;
  return new PostExpertiseService(
    savepointDb(trx),
    new PostsRewardRepository(db),
    new PostObjectsRepository(db),
    new PostExpertiseRepository(db),
    new HiveEngineRatesRepository(db),
    queue,
  );
}

async function insertObject(trx: Trx, objectId: string): Promise<void> {
  await trx
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: 'restaurant',
      creator: AUTHOR,
      transaction_id: `tx-${objectId}`,
      status: 'active',
      weight: 0,
    })
    .execute();
}

async function seedFinalizedPost(trx: Trx): Promise<void> {
  await trx
    .insertInto('accounts_current')
    .values({
      name: AUTHOR,
      comment_count: 0,
      lifetime_vote_count: 0,
      post_count: 0,
      object_reputation: 0,
      wobjects_weight: 0,
      last_posts_count: 0,
      users_following_count: 0,
      followers_count: 0,
      stage_version: 0,
    })
    .onConflict((oc) => oc.column('name').doNothing())
    .execute();
  await sql`
    INSERT INTO posts (
      author, permlink, created_unix, depth, total_payout_value, curator_payout_value,
      pending_payout_value, max_accepted_payout, last_payout, rewards_finalized_at
    )
    VALUES (
      ${AUTHOR}, ${PERMLINK}, ${CREATED_UNIX}, 0, '6.000 HBD', '2.000 HBD',
      '0.000 HBD', '1000000.000 HBD', '2024-01-01T00:00:00', NOW()
    )
  `.execute(trx);
  for (const [objectId, percent] of [
    [OBJECT_A, 75],
    [OBJECT_B, 25],
  ] as const) {
    await trx
      .insertInto('post_objects')
      .values({
        author: AUTHOR,
        permlink: PERMLINK,
        object_id: objectId,
        percent,
      })
      .execute();
  }
}

async function queuedIds(executor: Kysely<OdlDatabase>): Promise<string[]> {
  const rows = await executor
    .selectFrom('object_search_docs_sync_queue')
    .select('object_id')
    .where('object_id', 'in', TEST_OBJECT_IDS)
    .orderBy('object_id')
    .execute();
  return rows.map((r) => r.object_id);
}

async function weightOf(trx: Trx, objectId: string): Promise<number> {
  const row = await trx
    .selectFrom('objects_core')
    .select('weight')
    .where('object_id', '=', objectId)
    .executeTakeFirstOrThrow();
  return Number(row.weight ?? 0);
}

describeDb('PostExpertiseService (db)', () => {
  const db = createTestDb();
  const queue = new ObjectSearchQueueRepository(db);

  beforeAll(async () => {
    const migrated = await migrateToLatest({
      connectionString: resolveTestPostgresUrl(),
    });
    if (migrated.error) {
      throw migrated.error;
    }
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Only a broken implementation (enqueue outside the transaction) leaves rows behind.
    await db
      .deleteFrom('object_search_docs_sync_queue')
      .where('object_id', 'in', TEST_OBJECT_IDS)
      .execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('enqueues the objects whose weight changed inside the expertise transaction', async () => {
    await withRollback(db, async (trx) => {
      for (const objectId of TEST_OBJECT_IDS) {
        await insertObject(trx, objectId);
      }
      await seedFinalizedPost(trx);
      await trx
        .deleteFrom('object_search_docs_sync_queue')
        .where('object_id', 'in', TEST_OBJECT_IDS)
        .execute();

      const ok = await makeService(trx, queue).applyForPost(AUTHOR, PERMLINK);

      expect(ok).toBe(true);
      expect(await weightOf(trx, OBJECT_A)).toBeGreaterThan(0);
      expect(await queuedIds(trx)).toEqual([OBJECT_A, OBJECT_B]);
      const live = await trx
        .selectFrom('object_search_docs_sync_queue')
        .select(['enqueued_at', 'last_attempt_at'])
        .where('object_id', '=', OBJECT_A)
        .executeTakeFirstOrThrow();
      expect(Number(live.enqueued_at)).toBeGreaterThan(CREATED_UNIX);
      expect(live.last_attempt_at).toBeNull();
      // Not committed on its own connection: the rows belong to the service transaction.
      expect(await queuedIds(db)).toEqual([]);
    });
  });

  it('rolls the enqueue back with the weight write when the transaction fails', async () => {
    await withRollback(db, async (trx) => {
      for (const objectId of TEST_OBJECT_IDS) {
        await insertObject(trx, objectId);
      }
      await seedFinalizedPost(trx);
      await trx
        .deleteFrom('object_search_docs_sync_queue')
        .where('object_id', 'in', TEST_OBJECT_IDS)
        .execute();

      const enqueueMany = queue.enqueueMany.bind(queue);
      jest
        .spyOn(queue, 'enqueueMany')
        .mockImplementation(async (ids, enqueuedAt, executor) => {
          await enqueueMany(ids, enqueuedAt, executor);
          throw new Error('fail after enqueue');
        });

      const ok = await makeService(trx, queue).applyForPost(AUTHOR, PERMLINK);

      expect(ok).toBe(false);
      expect(await queuedIds(trx)).toEqual([]);
      expect(await weightOf(trx, OBJECT_A)).toBe(0);
      const post = await trx
        .selectFrom('posts')
        .select('expertise_applied_at')
        .where('author', '=', AUTHOR)
        .where('permlink', '=', PERMLINK)
        .executeTakeFirstOrThrow();
      expect(post.expertise_applied_at).toBeNull();
    });
  });
});
