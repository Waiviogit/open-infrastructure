import { sql, type Kysely, type Transaction } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { FeedActivityBucketTab, OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { FeedActivityBucketsRepository } from './feed-activity-buckets.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const HOUR = 3_600;
const FROM_HOUR = 1_000 * HOUR;
const IN_WINDOW = FROM_HOUR + 120;
const BEFORE_WINDOW = FROM_HOUR - 1;

function repo(trx: Trx): FeedActivityBucketsRepository {
  return new FeedActivityBucketsRepository(trx as unknown as Kysely<Database>);
}

async function recount(trx: Trx, tab: FeedActivityBucketTab): Promise<void> {
  const r = repo(trx);
  const tx = trx as unknown as Transaction<Database>;
  await r.lockTab(tab, tx);
  await r.deleteFromHour(tab, FROM_HOUR, tx);
  await r.insertCountsFromHour(tab, FROM_HOUR, tx);
}

async function buckets(
  trx: Trx,
  tab: FeedActivityBucketTab,
): Promise<Record<string, number>> {
  const rows = await trx
    .selectFrom('feed_activity_buckets')
    .select(['entity_kind', 'entity_id', 'bucket_hour', 'item_count'])
    .where('tab', '=', tab)
    .execute();
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[`${row.entity_kind}:${row.entity_id}@${Number(row.bucket_hour) / HOUR}`] = row.item_count;
  }
  return out;
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
    })
    .execute();
}

async function insertPost(
  trx: Trx,
  input: { author: string; permlink: string; created: number; depth?: number; objects?: string[] },
): Promise<void> {
  await sql`
    INSERT INTO posts (author, permlink, created_unix, depth)
    VALUES (${input.author}, ${input.permlink}, ${input.created}, ${input.depth ?? 0})
  `.execute(trx);
  for (const objectId of input.objects ?? []) {
    await trx
      .insertInto('post_objects')
      .values({ author: input.author, permlink: input.permlink, object_id: objectId })
      .execute();
  }
}

async function insertThread(
  trx: Trx,
  input: {
    author: string;
    permlink: string;
    created: number;
    hashtags: string[];
    deleted?: boolean;
    bulk?: boolean;
  },
): Promise<void> {
  await trx
    .insertInto('threads')
    .values({
      author: input.author,
      permlink: input.permlink,
      parent_author: '',
      parent_permlink: '',
      body: 'body',
      created: null,
      replies: [],
      children: 0,
      depth: 0,
      author_reputation: null,
      deleted: input.deleted ?? false,
      tickers: [],
      mentions: [],
      hashtags: input.hashtags,
      links: [],
      images: [],
      threadstorm: false,
      net_rshares: null,
      pending_payout_value: null,
      total_payout_value: null,
      percent_hbd: null,
      cashout_time: null,
      bulk_message: input.bulk ?? false,
      type: 'ecencythreads',
      created_unix: input.created,
      updated_at_unix: input.created,
    })
    .execute();
}

async function insertChannel(
  trx: Trx,
  input: { channelId: string; kind: 'object' | 'group'; objectId?: string },
): Promise<void> {
  await trx
    .insertInto('channels')
    .values({
      channel_id: input.channelId,
      kind: input.kind,
      creator: 'alice',
      title: null,
      object_id: input.objectId ?? null,
      access: 'public_read',
      dissolved_at_unix: null,
      created_at_unix: 1,
      event_seq: BigInt(1),
      transaction_id: `tx-${input.channelId}`,
    })
    .execute();
}

async function insertMessage(
  trx: Trx,
  input: {
    messageId: string;
    channelId: string;
    author: string;
    created: number;
    original?: number | null;
    linked?: string[];
    dupGroupId?: string;
  },
): Promise<void> {
  await trx
    .insertInto('messages')
    .values({
      message_id: input.messageId,
      channel_id: input.channelId,
      author: input.author,
      body: 'body',
      mentions: [],
      linked_object_ids: input.linked ?? [],
      created_at_unix: input.created,
      original_created_at_unix: input.original ?? null,
      event_seq: BigInt(1),
      transaction_id: `tx-${input.messageId}`,
      dup_group_id: input.dupGroupId ?? input.messageId,
      image_phashes: [],
    })
    .execute();
}

async function insertUpdate(
  trx: Trx,
  input: { updateId: string; objectId: string; creator: string; created: number },
): Promise<void> {
  await trx
    .insertInto('object_updates')
    .values({
      update_id: input.updateId,
      object_id: input.objectId,
      update_type: 'name',
      creator: input.creator,
      locale: 'en-US',
      created_at_unix: input.created,
      event_seq: BigInt(1),
      transaction_id: `tx-${input.updateId}`,
      value_text: 'name',
      value_geo: null,
      value_json: null,
    })
    .execute();
}

describeDb('FeedActivityBucketsRepository (db)', () => {
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

  it('counts root posts by author and by each linked object, per hour', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'obj-a');
      await insertObject(trx, 'obj-b');
      await insertPost(trx, { author: 'alice', permlink: 'p1', created: IN_WINDOW, objects: ['obj-a', 'obj-b'] });
      await insertPost(trx, { author: 'alice', permlink: 'p2', created: IN_WINDOW + HOUR, objects: ['obj-a'] });
      await insertPost(trx, { author: 'alice', permlink: 'reply', created: IN_WINDOW, depth: 1 });
      await insertPost(trx, { author: 'alice', permlink: 'old', created: BEFORE_WINDOW, objects: ['obj-a'] });

      await recount(trx, 'posts');

      expect(await buckets(trx, 'posts')).toEqual({
        'user:alice@1000': 1,
        'user:alice@1001': 1,
        'object:obj-a@1000': 1,
        'object:obj-a@1001': 1,
        'object:obj-b@1000': 1,
      });
    });
  });

  it('counts own non-bulk threads per author and each distinct known object per thread', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'obj-a');
      await insertThread(trx, { author: 'bob', permlink: 't1', created: IN_WINDOW, hashtags: ['obj-a', 'obj-a', 'not-an-object'] });
      await insertThread(trx, { author: 'bob', permlink: 't2', created: IN_WINDOW, hashtags: ['obj-a'], bulk: true });
      await insertThread(trx, { author: 'bob', permlink: 't3', created: IN_WINDOW, hashtags: ['obj-a'], deleted: true });

      await recount(trx, 'threads');

      expect(await buckets(trx, 'threads')).toEqual({
        'user:bob@1000': 1,
        'object:obj-a@1000': 2,
      });
    });
  });

  it('counts canonical object-channel messages once per object at their effective time', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'obj-a');
      await insertObject(trx, 'obj-b');
      await insertChannel(trx, { channelId: 'ch-a', kind: 'object', objectId: 'obj-a' });
      await insertChannel(trx, { channelId: 'ch-group', kind: 'group' });
      await insertMessage(trx, { messageId: 'm1', channelId: 'ch-a', author: 'carol', created: IN_WINDOW, linked: ['obj-a', 'obj-b'] });
      await insertMessage(trx, { messageId: 'm1-dup', channelId: 'ch-a', author: 'carol', created: IN_WINDOW, dupGroupId: 'm1' });
      await insertMessage(trx, { messageId: 'm2', channelId: 'ch-a', author: 'carol', created: IN_WINDOW, original: BEFORE_WINDOW });
      await insertMessage(trx, { messageId: 'm3', channelId: 'ch-group', author: 'carol', created: IN_WINDOW });

      await recount(trx, 'activity');

      expect(await buckets(trx, 'activity')).toEqual({
        'user:carol@1000': 1,
        'object:obj-a@1000': 1,
        'object:obj-b@1000': 1,
      });
    });
  });

  it('counts object updates by creator and by object', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'obj-a');
      await insertUpdate(trx, { updateId: 'u1', objectId: 'obj-a', creator: 'dave', created: IN_WINDOW });
      await insertUpdate(trx, { updateId: 'u2', objectId: 'obj-a', creator: 'dave', created: IN_WINDOW });
      await insertUpdate(trx, { updateId: 'u3', objectId: 'obj-a', creator: 'dave', created: BEFORE_WINDOW });

      await recount(trx, 'updates');

      expect(await buckets(trx, 'updates')).toEqual({
        'user:dave@1000': 2,
        'object:obj-a@1000': 2,
      });
    });
  });

  it('replaces the range on a repeated run and leaves older hours alone', async () => {
    await withRollback(db, async (trx) => {
      await insertObject(trx, 'obj-a');
      await insertUpdate(trx, { updateId: 'u1', objectId: 'obj-a', creator: 'dave', created: IN_WINDOW });
      await insertUpdate(trx, { updateId: 'u2', objectId: 'obj-a', creator: 'erin', created: IN_WINDOW });
      await trx
        .insertInto('feed_activity_buckets')
        .values({ tab: 'updates', entity_kind: 'user', entity_id: 'old', bucket_hour: FROM_HOUR - HOUR, item_count: 7 })
        .execute();

      await recount(trx, 'updates');
      const first = await buckets(trx, 'updates');
      await recount(trx, 'updates');
      expect(await buckets(trx, 'updates')).toEqual(first);

      await trx.deleteFrom('object_updates').where('update_id', '=', 'u2').execute();
      await recount(trx, 'updates');

      expect(await buckets(trx, 'updates')).toEqual({
        'user:old@999': 7,
        'user:dave@1000': 1,
        'object:obj-a@1000': 1,
      });
    });
  });

  it('prunes buckets before the retention hour', async () => {
    await withRollback(db, async (trx) => {
      await trx
        .insertInto('feed_activity_buckets')
        .values([
          { tab: 'posts', entity_kind: 'user', entity_id: 'old', bucket_hour: FROM_HOUR - HOUR, item_count: 1 },
          { tab: 'posts', entity_kind: 'user', entity_id: 'new', bucket_hour: FROM_HOUR, item_count: 1 },
        ])
        .execute();

      const pruned = await repo(trx).deleteBeforeHour(FROM_HOUR);

      expect(pruned).toBe(1);
      expect(await buckets(trx, 'posts')).toEqual({ 'user:new@1000': 1 });
    });
  });
});
