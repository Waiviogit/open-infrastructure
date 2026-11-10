/**
 * Activity message permalink (docs/apps/web/spec/pages/object/routes/social.md → "Activity message permalink").
 * seed: a person object + its object channel + 40 activity messages (one Instagram reel) through the real
 *       ODL / OSL parsers, and carol follows the object (home Activity feed).
 * probe: message ids the web / query-api checks use.
 */
import {
  buildCustomJsonOp,
  buildMessageCreatePayload,
  buildObjectChannelCreatePayload,
  buildOslEnvelopeOp,
} from '@opden-data-layer/hive-broadcast';
import type { Harness, Scenario } from '../indexer-harness';

const ODL_ID = 'odl-mainnet';
const OSL_ID = 'osl-mainnet';
const OBJECT_ID = 'justin-bellware';
const CHANNEL_ID = `obj-ch-${OBJECT_ID}`;
const MESSAGE_COUNT = 40;
const DAY_SEC = 86_400;
const BASE_UNIX = 1_793_750_400;

function odlOp(account: string, events: unknown[]) {
  return buildCustomJsonOp({
    required_auths: [],
    required_posting_auths: [account],
    id: ODL_ID,
    json: JSON.stringify({ events }),
  });
}

function oslOp(account: string, action: string, payload: Record<string, unknown>) {
  return buildOslEnvelopeOp({ id: OSL_ID, action, payload, required_posting_auths: [account] });
}

async function dumpMessages(h: Harness): Promise<void> {
  const rows = await h.db
    .selectFrom('messages')
    .select(['message_id', 'author', 'body', 'original_created_at_unix'])
    .where('channel_id', '=', CHANNEL_ID)
    .orderBy('event_seq', 'desc')
    .limit(3)
    .execute();
  h.log('latest messages', rows);
}

const scenario: Scenario = {
  async seed(h) {
    await h.hiveBlock([
      odlOp('alice', [
        { action: 'object_create', v: 1, payload: { object_id: OBJECT_ID, object_type: 'person' } },
        {
          action: 'update_create',
          v: 1,
          payload: { object_id: OBJECT_ID, update_type: 'name', value_text: 'Justin Bellware', locale: 'en-US' },
        },
      ]),
    ]);
    await h.hiveBlock([
      oslOp('alice', 'channel_create', buildObjectChannelCreatePayload({ objectId: OBJECT_ID, objectName: 'Justin Bellware' })),
    ]);

    const ops = [];
    for (let i = 0; i < MESSAGE_COUNT; i += 1) {
      ops.push(
        oslOp(
          'insta.agent',
          'message_create',
          buildMessageCreatePayload({
            channelId: CHANNEL_ID,
            body: `Activity note ${i + 1}: building AI agents for businesses.`,
            originalCreatedAtUnix: BASE_UNIX - (MESSAGE_COUNT - i) * DAY_SEC,
          }),
        ),
      );
    }
    ops.push(
      oslOp(
        'insta.agent',
        'message_create',
        buildMessageCreatePayload({
          channelId: CHANNEL_ID,
          body:
            'A video showcasing a custom AI agent system featuring dedicated computers.\n\nhttps://www.instagram.com/reel/DQx1AbCdEfG/',
          originalCreatedAtUnix: BASE_UNIX,
          source: { platform: 'instagram', id: 'DQx1AbCdEfG' },
        }),
      ),
    );
    await h.hiveBlock(ops);

    const objects = await h.db.selectFrom('objects_core').select(['object_id', 'object_type', 'status']).execute();
    h.log('objects_core', objects);
    const channels = await h.db.selectFrom('channels').select(['channel_id', 'kind', 'object_id']).execute();
    h.log('channels', channels);
    await dumpMessages(h);
  },

  /** carol follows the object (home Activity feed). The account row is a test-DB fixture (no chain account sync). */
  async follow(h) {
    await h.db
      .insertInto('accounts_current')
      .values([{ name: 'carol' }, { name: 'insta.agent' }])
      .onConflict((oc) => oc.column('name').doNothing())
      .execute();
    await h.hiveBlock([
      odlOp('carol', [{ action: 'object_follow', v: 1, payload: { object_id: OBJECT_ID, method: 'follow' } }]),
    ]);
    const follows = await h.db.selectFrom('user_object_follows').selectAll().execute();
    h.log('user_object_follows', follows);
  },

  /** A message with an image and a reply to it (quote_json as the web compose sends it). */
  async reply(h) {
    const parentBody = 'Studio setup ![studio](https://images.hive.blog/DQmStudioSetupVerify/studio.jpg)';
    await h.hiveBlock([
      oslOp('insta.agent', 'message_create', buildMessageCreatePayload({ channelId: CHANNEL_ID, body: parentBody })),
    ]);
    const parent = await h.db
      .selectFrom('messages')
      .select('message_id')
      .where('body', '=', parentBody)
      .executeTakeFirstOrThrow();
    await h.hiveBlock([
      oslOp(
        'carol',
        'message_create',
        buildMessageCreatePayload({
          channelId: CHANNEL_ID,
          body: 'Love this setup!',
          replyTo: parent.message_id,
          quoteJson: { author: 'insta.agent', body: parentBody },
        }),
      ),
    ]);
    const rows = await h.db
      .selectFrom('messages')
      .select(['message_id', 'author', 'body', 'reply_to'])
      .where('channel_id', '=', CHANNEL_ID)
      .orderBy('event_seq', 'desc')
      .limit(2)
      .execute();
    h.log('parent + reply', rows);
  },

  async probe(h) {
    await dumpMessages(h);
    const count = await h.db
      .selectFrom('messages')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('channel_id', '=', CHANNEL_ID)
      .executeTakeFirst();
    h.log('message count', [count]);
  },
};

export default scenario;
