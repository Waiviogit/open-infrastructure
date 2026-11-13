import type { Kysely, Transaction } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { HubFeedFilterCountsRepository } from './hub-feed-filter-counts.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const HOUR = 3_600;
const SINCE = 1_000 * HOUR;

async function ensureAccount(trx: Trx, name: string, weight = 0): Promise<void> {
  await trx
    .insertInto('accounts_current')
    .values({
      name,
      comment_count: 0,
      lifetime_vote_count: 0,
      post_count: 0,
      object_reputation: 0,
      wobjects_weight: weight,
      last_posts_count: 0,
      users_following_count: 0,
      followers_count: 0,
      stage_version: 0,
    })
    .onConflict((oc) => oc.column('name').doNothing())
    .execute();
}

async function insertObject(trx: Trx, objectId: string, status: 'active' | 'unavailable' = 'active') {
  await trx
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: 'restaurant',
      creator: 'admin',
      transaction_id: `tx-${objectId}`,
      status,
    })
    .execute();
}

async function present(
  trx: Trx,
  entityKind: 'user' | 'object',
  entityId: string,
  lastItem: number,
  tab: 'posts' | 'threads' = 'posts',
): Promise<void> {
  await trx
    .insertInto('feed_activity_presence')
    .values({ tab, entity_kind: entityKind, entity_id: entityId, last_item_unix: lastItem })
    .execute();
}

async function bucket(
  trx: Trx,
  entityKind: 'user' | 'object',
  entityId: string,
  hour: number,
  count: number,
  tab: 'posts' | 'threads' = 'posts',
): Promise<void> {
  await trx
    .insertInto('feed_activity_buckets')
    .values({ tab, entity_kind: entityKind, entity_id: entityId, bucket_hour: hour, item_count: count })
    .execute();
}

describeDb('HubFeedFilterCountsRepository (db)', () => {
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

  it('lists only follows present on the tab, sums window buckets, skips inactive objects', async () => {
    await withRollback(db, async (trx) => {
      const repo = new HubFeedFilterCountsRepository(trx as unknown as Kysely<Database>);
      await ensureAccount(trx, 'hfc-viewer');
      await ensureAccount(trx, 'hfc-alice', 70);
      await ensureAccount(trx, 'hfc-quiet');
      await insertObject(trx, 'hfc-obj');
      await insertObject(trx, 'hfc-gone', 'unavailable');
      await trx
        .insertInto('user_subscriptions')
        .values([
          { follower: 'hfc-viewer', following: 'hfc-alice', bell: null },
          { follower: 'hfc-viewer', following: 'hfc-quiet', bell: null },
        ])
        .execute();
      await trx
        .insertInto('user_object_follows')
        .values([
          { account: 'hfc-viewer', object_id: 'hfc-obj', bell: false },
          { account: 'hfc-viewer', object_id: 'hfc-gone', bell: false },
        ])
        .execute();
      await ensureAccount(trx, 'hfc-no-posts');
      await trx
        .insertInto('user_subscriptions')
        .values({ follower: 'hfc-viewer', following: 'hfc-no-posts', bell: null })
        .execute();
      await present(trx, 'user', 'hfc-alice', SINCE + HOUR);
      await present(trx, 'user', 'hfc-quiet', 100);
      await present(trx, 'user', 'hfc-no-posts', 200, 'threads');
      await present(trx, 'object', 'hfc-obj', SINCE);
      await present(trx, 'object', 'hfc-gone', SINCE);
      await bucket(trx, 'user', 'hfc-alice', SINCE, 2);
      await bucket(trx, 'user', 'hfc-alice', SINCE + HOUR, 3);
      await bucket(trx, 'user', 'hfc-alice', SINCE - HOUR, 50);
      await bucket(trx, 'user', 'hfc-alice', SINCE, 9, 'threads');
      await bucket(trx, 'object', 'hfc-obj', SINCE, 4);
      await bucket(trx, 'object', 'hfc-gone', SINCE, 8);

      const query = { account: 'hfc-viewer', tab: 'posts' as const, sinceHour: SINCE, maxFollows: 100 };
      const rows = await repo.findFollowsWithCounts(query, 1_000, trx as unknown as Transaction<Database>);

      expect(rows).toEqual(
        expect.arrayContaining([
          { kind: 'user', id: 'hfc-alice', object_type: null, count: 5, last_item_unix: SINCE + HOUR },
          { kind: 'user', id: 'hfc-quiet', object_type: null, count: 0, last_item_unix: 100 },
          { kind: 'object', id: 'hfc-obj', object_type: 'restaurant', count: 4, last_item_unix: SINCE },
        ]),
      );
      expect(rows).toHaveLength(3);

      const plain = await repo.findFollows(query);
      expect(plain.every((row) => row.count === null)).toBe(true);
      expect(plain).toHaveLength(3);
    });
  });
});
