import { sql, type Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { HubActivityFeedRepository } from './hub-activity-feed.repository';
import { HubPostsFeedRepository } from './hub-posts-feed.repository';
import { HubThreadsFeedRepository } from './hub-threads-feed.repository';
import { HubUpdatesFeedRepository } from './hub-updates-feed.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const LIMIT = 50;

function asDb(trx: Trx): Kysely<Database> {
  return trx as unknown as Kysely<Database>;
}

async function insertObject(
  trx: Trx,
  objectId: string,
  status: 'active' | 'unavailable' = 'active',
): Promise<void> {
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

async function ensureAccount(trx: Trx, name: string): Promise<void> {
  await trx
    .insertInto('accounts_current')
    .values({
      name,
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
}

async function followUser(trx: Trx, follower: string, following: string): Promise<void> {
  await ensureAccount(trx, follower);
  await ensureAccount(trx, following);
  await trx.insertInto('user_subscriptions').values({ follower, following, bell: null }).execute();
}

async function followObject(trx: Trx, account: string, objectId: string): Promise<void> {
  await ensureAccount(trx, account);
  await trx
    .insertInto('user_object_follows')
    .values({ account, object_id: objectId, bell: false })
    .execute();
}

async function favoriteObject(trx: Trx, account: string, objectId: string): Promise<void> {
  await ensureAccount(trx, account);
  await trx
    .insertInto('object_favorite')
    .values({ account, object_id: objectId, event_seq: BigInt(1), created_at: new Date() })
    .execute();
}

async function insertPost(
  trx: Trx,
  input: {
    author: string;
    permlink: string;
    created: number;
    depth?: number;
    netRshares?: number;
    children?: number;
    objects?: string[];
  },
): Promise<void> {
  await sql`
    INSERT INTO posts (author, permlink, created_unix, depth, net_rshares, children)
    VALUES (${input.author}, ${input.permlink}, ${input.created}, ${input.depth ?? 0},
            ${input.netRshares ?? 0}, ${input.children ?? 0})
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
    hashtags?: string[];
    bulk?: boolean;
    netRshares?: number | null;
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
      deleted: false,
      tickers: [],
      mentions: [],
      hashtags: input.hashtags ?? [],
      links: [],
      images: [],
      threadstorm: false,
      net_rshares: input.netRshares == null ? null : BigInt(input.netRshares),
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
      creator: 'admin',
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
      original_created_at_unix: null,
      event_seq: BigInt(input.created),
      transaction_id: `tx-${input.messageId}`,
      dup_group_id: input.dupGroupId ?? input.messageId,
      image_phashes: [],
    })
    .execute();
}

async function insertUpdate(
  trx: Trx,
  input: { updateId: string; objectId: string; creator: string; created: number; rank?: number },
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
      rank_score: input.rank ?? null,
    })
    .execute();
}

describeDb('hub feed repositories (db)', () => {
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

  describe('HubPostsFeedRepository', () => {
    it('new: root posts newest first, skips replies and excluded authors, pages by keyset', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubPostsFeedRepository(asDb(trx));
        await insertPost(trx, { author: 'hubf-alice', permlink: 'a1', created: 100 });
        await insertPost(trx, { author: 'hubf-bob', permlink: 'b1', created: 300 });
        await insertPost(trx, { author: 'hubf-carol', permlink: 'c1', created: 200 });
        await insertPost(trx, { author: 'hubf-alice', permlink: 'reply', created: 400, depth: 1 });
        await insertPost(trx, { author: 'hubf-spam', permlink: 's1', created: 500 });

        const first = await repo.findNew(['hubf-spam'], null, 2);
        expect(first.map((r) => r.permlink)).toEqual(['b1', 'c1']);

        const second = await repo.findNew(['hubf-spam'], { feedAt: 200, author: 'hubf-carol', permlink: 'c1' }, 2);
        expect(second.map((r) => r.permlink)).toEqual(['a1']);
      });
    });

    it('ranked: only the window, ordered by metric, pages by score keyset', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubPostsFeedRepository(asDb(trx));
        await insertPost(trx, { author: 'a', permlink: 'old', created: 10, netRshares: 9_000 });
        await insertPost(trx, { author: 'a', permlink: 'low', created: 1_000, netRshares: 5, children: 9 });
        await insertPost(trx, { author: 'b', permlink: 'high', created: 1_000, netRshares: 500, children: 1 });
        await insertPost(trx, { author: 'c', permlink: 'mid', created: 1_000, netRshares: 50, children: 4 });

        const trending = await repo.findRanked('net_rshares', 100, [], null, LIMIT);
        expect(trending.map((r) => r.permlink)).toEqual(['high', 'mid', 'low']);
        expect(trending[0].score).toBe('500');

        const page2 = await repo.findRanked('net_rshares', 100, [], { score: '500', author: 'b', permlink: 'high' }, LIMIT);
        expect(page2.map((r) => r.permlink)).toEqual(['mid', 'low']);

        const hot = await repo.findRanked('children', 100, [], null, LIMIT);
        expect(hot.map((r) => r.permlink)).toEqual(['low', 'mid', 'high']);
      });
    });

    it('my: followed authors and posts on followed / favorited active objects, deduped', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubPostsFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-follow');
        await insertObject(trx, 'hubf-obj-fav');
        await insertObject(trx, 'hubf-obj-gone', 'unavailable');
        await followUser(trx, 'hubf-viewer', 'hubf-alice');
        await followObject(trx, 'hubf-viewer', 'hubf-obj-follow');
        await followObject(trx, 'hubf-viewer', 'hubf-obj-gone');
        await favoriteObject(trx, 'hubf-viewer', 'hubf-obj-fav');
        await insertPost(trx, { author: 'hubf-alice', permlink: 'by-alice', created: 500, objects: ['hubf-obj-follow'] });
        await insertPost(trx, { author: 'hubf-zed', permlink: 'on-follow', created: 400, objects: ['hubf-obj-follow'] });
        await insertPost(trx, { author: 'hubf-zed', permlink: 'on-fav', created: 300, objects: ['hubf-obj-fav'] });
        await insertPost(trx, { author: 'hubf-zed', permlink: 'on-gone', created: 200, objects: ['hubf-obj-gone'] });
        await insertPost(trx, { author: 'hubf-zed', permlink: 'unrelated', created: 100 });

        const rows = await repo.findMy('hubf-viewer', [], null, LIMIT);
        expect(rows.map((r) => r.permlink)).toEqual(['by-alice', 'on-follow', 'on-fav']);

        const muted = await repo.findMy('hubf-viewer', ['hubf-zed'], null, LIMIT);
        expect(muted.map((r) => r.permlink)).toEqual(['by-alice']);
      });
    });

    it('author and object filters', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubPostsFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await insertPost(trx, { author: 'hubf-alice', permlink: 'p1', created: 100, objects: ['hubf-obj-a'] });
        await insertPost(trx, { author: 'hubf-bob', permlink: 'p2', created: 200, objects: ['hubf-obj-a'] });
        await insertPost(trx, { author: 'hubf-alice', permlink: 'p3', created: 300 });

        expect((await repo.findByAuthor('hubf-alice', null, LIMIT)).map((r) => r.permlink)).toEqual(['p3', 'p1']);
        expect((await repo.findByObject('hubf-obj-a', [], null, LIMIT)).map((r) => r.permlink)).toEqual(['p2', 'p1']);
        expect((await repo.findByObject('hubf-obj-a', ['hubf-bob'], null, LIMIT)).map((r) => r.permlink)).toEqual(['p1']);
      });
    });
  });

  describe('HubThreadsFeedRepository', () => {
    it('my: own non-bulk threads of followed accounts plus threads on viewer objects', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubThreadsFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await followUser(trx, 'hubf-viewer', 'hubf-alice');
        await followObject(trx, 'hubf-viewer', 'hubf-obj-a');
        await insertThread(trx, { author: 'hubf-alice', permlink: 't-own', created: 400 });
        await insertThread(trx, { author: 'hubf-alice', permlink: 't-bulk', created: 300, bulk: true });
        await insertThread(trx, { author: 'hubf-zed', permlink: 't-tag', created: 200, hashtags: ['hubf-obj-a'] });
        await insertThread(trx, { author: 'hubf-zed', permlink: 't-other', created: 100, hashtags: ['other'] });

        const rows = await repo.findMy('hubf-viewer', [], null, LIMIT);
        expect(rows.map((r) => r.permlink)).toEqual(['t-own', 't-tag']);
      });
    });

    it('ranked, author and object filters', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubThreadsFeedRepository(asDb(trx));
        await insertThread(trx, { author: 'hubf-alice', permlink: 't1', created: 1_000, hashtags: ['hubf-obj-a'], netRshares: 10 });
        await insertThread(trx, { author: 'hubf-bob', permlink: 't2', created: 1_000, hashtags: ['hubf-obj-a'], netRshares: null });
        await insertThread(trx, { author: 'hubf-alice', permlink: 't3', created: 1_000, netRshares: 99, bulk: true });

        expect((await repo.findRanked('net_rshares', 500, [], null, LIMIT)).map((r) => r.permlink)).toEqual(['t3', 't1', 't2']);
        expect((await repo.findByAuthor('hubf-alice', null, LIMIT)).map((r) => r.permlink)).toEqual(['t1']);
        expect((await repo.findByObject('hubf-obj-a', ['hubf-bob'], null, LIMIT)).map((r) => r.permlink)).toEqual(['t1']);
      });
    });
  });

  describe('HubActivityFeedRepository', () => {
    it('new: canonical object-channel messages only', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubActivityFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await insertChannel(trx, { channelId: 'hubf-ch-a', kind: 'object', objectId: 'hubf-obj-a' });
        await insertChannel(trx, { channelId: 'hubf-ch-g', kind: 'group' });
        await insertMessage(trx, { messageId: 'm1', channelId: 'hubf-ch-a', author: 'hubf-alice', created: 100 });
        await insertMessage(trx, { messageId: 'm1-dup', channelId: 'hubf-ch-a', author: 'hubf-alice', created: 101, dupGroupId: 'm1' });
        await insertMessage(trx, { messageId: 'm2', channelId: 'hubf-ch-g', author: 'hubf-alice', created: 200 });

        const rows = await repo.findNew([], null, LIMIT);
        expect(rows.map((r) => r.message_id)).toEqual(['m1']);
        expect(rows[0].channel_object_id).toBe('hubf-obj-a');
        expect(rows[0].duplicate_count).toBe(2);
      });
    });

    it('my: followed authors, viewer object channels and linked objects, deduped and paged', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubActivityFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await insertObject(trx, 'hubf-obj-b');
        await insertObject(trx, 'hubf-obj-x');
        await followUser(trx, 'hubf-viewer', 'hubf-alice');
        await followObject(trx, 'hubf-viewer', 'hubf-obj-a');
        await favoriteObject(trx, 'hubf-viewer', 'hubf-obj-b');
        await insertChannel(trx, { channelId: 'hubf-ch-a', kind: 'object', objectId: 'hubf-obj-a' });
        await insertChannel(trx, { channelId: 'hubf-ch-x', kind: 'object', objectId: 'hubf-obj-x' });
        await insertMessage(trx, { messageId: 'by-alice-in-a', channelId: 'hubf-ch-a', author: 'hubf-alice', created: 400 });
        await insertMessage(trx, { messageId: 'by-alice-in-x', channelId: 'hubf-ch-x', author: 'hubf-alice', created: 300 });
        await insertMessage(trx, { messageId: 'links-b', channelId: 'hubf-ch-x', author: 'hubf-zed', created: 200, linked: ['hubf-obj-b'] });
        await insertMessage(trx, { messageId: 'unrelated', channelId: 'hubf-ch-x', author: 'hubf-zed', created: 100 });

        const rows = await repo.findMy('hubf-viewer', [], null, LIMIT);
        expect(rows.map((r) => r.message_id)).toEqual(['by-alice-in-a', 'by-alice-in-x', 'links-b']);

        const page2 = await repo.findMy('hubf-viewer', [], { createdAtUnix: 300, eventSeq: BigInt(300) }, LIMIT);
        expect(page2.map((r) => r.message_id)).toEqual(['links-b']);

        expect((await repo.findByAuthor('hubf-zed', null, LIMIT)).map((r) => r.message_id)).toEqual(['links-b', 'unrelated']);
      });
    });
  });

  describe('HubUpdatesFeedRepository', () => {
    it('new skips inactive objects and excluded creators; trending orders by rank in the window', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubUpdatesFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await insertObject(trx, 'hubf-obj-gone', 'unavailable');
        await insertUpdate(trx, { updateId: 'u1', objectId: 'hubf-obj-a', creator: 'hubf-alice', created: 1_000, rank: 10 });
        await insertUpdate(trx, { updateId: 'u2', objectId: 'hubf-obj-a', creator: 'hubf-bob', created: 1_100, rank: 90 });
        await insertUpdate(trx, { updateId: 'u3', objectId: 'hubf-obj-gone', creator: 'hubf-alice', created: 1_200 });
        await insertUpdate(trx, { updateId: 'u4', objectId: 'hubf-obj-a', creator: 'hubf-alice', created: 10, rank: 9_999 });

        expect((await repo.findNew(['hubf-bob'], null, LIMIT)).map((r) => r.row.update_id)).toEqual(['u1', 'u4']);
        expect((await repo.findTrending(500, [], null, LIMIT)).map((r) => r.row.update_id)).toEqual(['u2', 'u1']);
        expect(
          (await repo.findTrending(500, [], { score: 90, createdAtUnix: 1_100, updateId: 'u2' }, LIMIT)).map(
            (r) => r.row.update_id,
          ),
        ).toEqual(['u1']);
      });
    });

    it('my, creator and object filters', async () => {
      await withRollback(db, async (trx) => {
        const repo = new HubUpdatesFeedRepository(asDb(trx));
        await insertObject(trx, 'hubf-obj-a');
        await insertObject(trx, 'hubf-obj-b');
        await followUser(trx, 'hubf-viewer', 'hubf-alice');
        await followObject(trx, 'hubf-viewer', 'hubf-obj-b');
        await insertUpdate(trx, { updateId: 'u-alice', objectId: 'hubf-obj-a', creator: 'hubf-alice', created: 300 });
        await insertUpdate(trx, { updateId: 'u-on-b', objectId: 'hubf-obj-b', creator: 'hubf-alice', created: 200 });
        await insertUpdate(trx, { updateId: 'u-zed-b', objectId: 'hubf-obj-b', creator: 'hubf-zed', created: 100 });
        await insertUpdate(trx, { updateId: 'u-zed-a', objectId: 'hubf-obj-a', creator: 'hubf-zed', created: 50 });

        expect((await repo.findMy('hubf-viewer', [], null, LIMIT)).map((r) => r.row.update_id)).toEqual([
          'u-alice',
          'u-on-b',
          'u-zed-b',
        ]);
        expect((await repo.findByCreator('hubf-zed', null, LIMIT)).map((r) => r.row.update_id)).toEqual(['u-zed-b', 'u-zed-a']);
        expect((await repo.findByObject('hubf-obj-a', ['hubf-zed'], null, LIMIT)).map((r) => r.row.update_id)).toEqual(['u-alice']);
      });
    });
  });
});
