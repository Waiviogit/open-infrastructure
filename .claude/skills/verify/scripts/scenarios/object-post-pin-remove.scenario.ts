/**
 * Object Posts feed Pin / Remove (docs/apps/web/spec/object-post-pin-remove.md).
 * seed:   object `pinv-drink` (drink) + 8 root posts by `bob` linked via post_objects (post rows are seed data).
 * drive:  pin / remove / vote events through the real ODL parser, built with the web's hive-broadcast builders:
 *         pins on post-1..post-5 by different accounts (post-5 by viewer `vic`), pin + remove on post-6,
 *         a malformed pin, a duplicate pin, `grace` votes for the post-4 pin, `vic` votes for the post-1 pin.
 * probe:  object_updates / validity_votes rows.
 * unpin:  `vic` votes against his own post-5 pin (what the menu's Unpin broadcasts).
 */
import { buildOdlUpdateCreateOp, buildOdlUpdateVoteOp } from '@opden-data-layer/hive-broadcast';
import { sql } from 'kysely';
import type { Harness, Scenario } from '../indexer-harness';

const ODL_ID = 'odl-mainnet';
const OBJECT_ID = 'pinv-drink';
const AUTHOR = 'bob';
const POST_COUNT = 8;
const ACCOUNTS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'vic'];
const BASE_CREATED_UNIX = 1_760_000_000;

const ref = (n: number) => `${AUTHOR}/post-${n}`;

function create(creator: string, updateType: 'pin' | 'remove', value: string) {
  return buildOdlUpdateCreateOp({
    id: ODL_ID,
    objectId: OBJECT_ID,
    updateType,
    creator,
    valueKind: 'text',
    value,
    required_posting_auths: [creator],
  });
}

function vote(voter: string, updateId: string, value: 'for' | 'against') {
  return buildOdlUpdateVoteOp({
    id: ODL_ID,
    updateId,
    objectId: OBJECT_ID,
    voter,
    vote: value,
    required_posting_auths: [voter],
  });
}

async function updateIdFor(h: Harness, updateType: string, value: string): Promise<string> {
  const row = await h.db
    .selectFrom('object_updates')
    .select('update_id')
    .where('object_id', '=', OBJECT_ID)
    .where('update_type', '=', updateType)
    .where('value_text', '=', value)
    .executeTakeFirstOrThrow();
  return row.update_id;
}

const scenario: Scenario = {
  async seed(h) {
    for (const name of ACCOUNTS) {
      await sql`INSERT INTO accounts_current (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`.execute(h.db);
    }
    await h.hiveBlock([
      {
        id: ODL_ID,
        required_auths: [],
        required_posting_auths: ['alice'],
        json: JSON.stringify({
          events: [
            { action: 'object_create', v: 1, payload: { object_id: OBJECT_ID, object_type: 'drink' } },
            {
              action: 'update_create',
              v: 1,
              payload: { object_id: OBJECT_ID, update_type: 'name', value_text: 'Kopi Talua', locale: 'en-US' },
            },
          ],
        }),
      },
    ]);
    for (let n = 1; n <= POST_COUNT; n++) {
      const permlink = `post-${n}`;
      await h.db
        .insertInto('posts')
        .values({
          author: AUTHOR,
          permlink,
          title: `Kopi Talua review ${n}`,
          body: `Review number ${n} of the egg coffee.`,
          depth: 0,
          created: new Date((BASE_CREATED_UNIX + n * 3600) * 1000).toISOString(),
          created_unix: BASE_CREATED_UNIX + n * 3600,
          root_author: AUTHOR,
          root_permlink: permlink,
        } as never)
        .onConflict((oc) => oc.doNothing())
        .execute();
      await h.db
        .insertInto('post_objects')
        .values({ author: AUTHOR, permlink, object_id: OBJECT_ID, percent: 100, object_type: 'drink' })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    h.log('object', await h.db.selectFrom('objects_core').select(['object_id', 'object_type', 'status']).where('object_id', '=', OBJECT_ID).execute());
    h.log('posts', await h.db.selectFrom('post_objects').select(['author', 'permlink']).where('object_id', '=', OBJECT_ID).execute());
  },

  async drive(h) {
    await h.hiveBlock([
      create('carol', 'pin', ref(1)),
      create('dave', 'pin', ref(2)),
      create('erin', 'pin', ref(3)),
      create('frank', 'pin', ref(4)),
      create('vic', 'pin', ref(5)),
      create('carol', 'pin', ref(6)),
      create('carol', 'remove', ref(6)),
      create('carol', 'pin', 'not-a-post-ref'),
      create('dave', 'pin', ref(1)),
    ]);
    await h.hiveBlock([
      vote('grace', await updateIdFor(h, 'pin', ref(4)), 'for'),
      vote('vic', await updateIdFor(h, 'pin', ref(1)), 'for'),
    ]);
  },

  async probe(h) {
    h.log(
      'object_updates (pin/remove)',
      await h.db
        .selectFrom('object_updates')
        .select(['update_id', 'update_type', 'creator', 'value_text'])
        .where('object_id', '=', OBJECT_ID)
        .where('update_type', 'in', ['pin', 'remove'])
        .orderBy('event_seq')
        .execute(),
    );
    h.log(
      'validity_votes',
      await h.db
        .selectFrom('validity_votes')
        .select(['update_id', 'voter', 'vote'])
        .where('object_id', '=', OBJECT_ID)
        .orderBy('event_seq')
        .execute(),
    );
  },

  async unpin(h) {
    await h.hiveBlock([vote('vic', await updateIdFor(h, 'pin', ref(5)), 'against')]);
    h.log(
      'votes on post-5 pin',
      await h.db
        .selectFrom('validity_votes')
        .select(['update_id', 'voter', 'vote'])
        .where('update_id', '=', await updateIdFor(h, 'pin', ref(5)))
        .execute(),
    );
  },
};

export default scenario;
