/**
 * Discover category tree (docs/apps/query-api/spec/discover-categories.md).
 * seed:  products with category / tag updates through the real ODL parser (creator `alice`),
 *        a few favorited by `carol` (Favorites tree under the same display rules); then the
 *        category, tag and related-scope workers are drained (type scope `('type','product')`).
 * probe: the type scope rows, then the rate limit: a re-enqueued type scope is not claimed while
 *        its throttle key lives.
 *
 * Shape (product): Electronics 34 = Audio 20 (5 also Headphones) + Video 12 + Cables 2,
 * Kitchen 14, Garden 2, 8 uncategorized; `Everything` on every Electronics + Kitchen product
 * (> 60%, must be hidden without suppressing Electronics / Kitchen). Color:Black on 6 Audio,
 * 4 Video and 5 Kitchen.
 */
import { buildCustomJsonOp } from '@opden-data-layer/hive-broadcast';
import { RedisClientFactory } from '@opden-data-layer/clients';
import { sql } from 'kysely';
import type { Harness, Scenario } from '../indexer-harness';

const ODL_ID = 'odl-mainnet';
const CREATOR = 'alice';
const FAN = 'carol';
const OPS_PER_BLOCK = 20;
const WORKER_ROUNDS = 20;
const TYPE = 'product';

type Spec = {
  objectId: string;
  name: string;
  categories: string[];
  black?: boolean;
  favoritedByFan?: boolean;
};

function objectOp(spec: Spec) {
  const events: unknown[] = [
    { action: 'object_create', v: 1, payload: { object_id: spec.objectId, object_type: TYPE } },
    {
      action: 'update_create',
      v: 1,
      payload: { object_id: spec.objectId, update_type: 'name', value_text: spec.name, locale: 'en-US' },
    },
    ...spec.categories.map((category) => ({
      action: 'update_create',
      v: 1,
      payload: { object_id: spec.objectId, update_type: 'category', value_text: category, locale: 'en-US' },
    })),
    ...(spec.black
      ? [
          {
            action: 'update_create',
            v: 1,
            payload: {
              object_id: spec.objectId,
              update_type: 'tagCategoryItem',
              value_json: { category: 'Color', value: 'Black' },
              locale: 'en-US',
            },
          },
        ]
      : []),
  ];
  return buildCustomJsonOp({
    required_auths: [],
    required_posting_auths: [CREATOR],
    id: ODL_ID,
    json: JSON.stringify({ events }),
  });
}

function favoriteOp(objectIds: string[]) {
  return buildCustomJsonOp({
    required_auths: [],
    required_posting_auths: [FAN],
    id: ODL_ID,
    json: JSON.stringify({
      events: objectIds.map((object_id) => ({
        action: 'object_favorite',
        v: 1,
        payload: { object_id, method: 'add' },
      })),
    }),
  });
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  for (const i of range(20)) {
    specs.push({
      objectId: `dc-audio-${i}`,
      name: i <= 5 ? `Headphones ${i}` : `Speaker ${i}`,
      categories: i <= 5 ? ['Everything', 'Electronics', 'Audio', 'Headphones'] : ['Everything', 'Electronics', 'Audio'],
      black: i > 14,
      favoritedByFan: i > 14,
    });
  }
  for (const i of range(12)) {
    specs.push({ objectId: `dc-video-${i}`, name: `TV ${i}`, categories: ['Everything', 'Electronics', 'Video'], black: i <= 4 });
  }
  for (const i of range(2)) {
    specs.push({ objectId: `dc-cable-${i}`, name: `Cable ${i}`, categories: ['Everything', 'Electronics', 'Cables'] });
  }
  for (const i of range(14)) {
    specs.push({
      objectId: `dc-kitchen-${i}`,
      name: `Pan ${i}`,
      categories: ['Everything', 'Kitchen'],
      black: i <= 5,
      favoritedByFan: i <= 4,
    });
  }
  for (const i of range(2)) {
    specs.push({ objectId: `dc-garden-${i}`, name: `Hose ${i}`, categories: ['Garden'] });
  }
  for (const i of range(8)) {
    specs.push({ objectId: `dc-plain-${i}`, name: `Plain product ${i}`, categories: [], favoritedByFan: i <= 3 });
  }
  return specs;
}

const worker = (h: Harness, file: string, name: string) =>
  h.get<{ runBatch(): Promise<void> }>(
    require(`../../../../../apps/chain-indexer/src/domain/odl-parser/${file}`)[name],
  );

async function clearThrottle(h: Harness): Promise<void> {
  const { redisKey } = require('../../../../../apps/chain-indexer/src/constants/redis-keys');
  await h.get<RedisClientFactory>(RedisClientFactory).getClient().del(redisKey.categoryTypeScopeThrottle(TYPE));
}

async function queueRows(h: Harness) {
  return h.db
    .selectFrom('object_categories_related_sync_queue')
    .select(['scope_type', 'scope_key', 'attempts'])
    .where('scope_type', '=', 'type')
    .execute();
}

const scenario: Scenario = {
  async seed(h) {
    await sql`
      INSERT INTO accounts_current (name) VALUES (${CREATOR}), (${FAN})
      ON CONFLICT (name) DO NOTHING
    `.execute(h.db);
    const specs = buildSpecs();
    for (let i = 0; i < specs.length; i += OPS_PER_BLOCK) {
      await h.hiveBlock(specs.slice(i, i + OPS_PER_BLOCK).map(objectOp));
    }
    await h.hiveBlock([favoriteOp(specs.filter((s) => s.favoritedByFan).map((s) => s.objectId))]);

    // Objects first, so the (rate-limited) type scope is built once from every category row.
    const objectWorkers = [
      worker(h, 'object-categories.worker', 'ObjectCategoriesWorker'),
      worker(h, 'object-tag-categories.worker', 'ObjectTagCategoriesWorker'),
    ];
    for (let round = 0; round < WORKER_ROUNDS; round++) {
      for (const w of objectWorkers) {
        await w.runBatch();
      }
    }
    await clearThrottle(h);
    const related = worker(h, 'object-categories-related.worker', 'ObjectCategoriesRelatedWorker');
    for (let round = 0; round < WORKER_ROUNDS; round++) {
      await related.runBatch();
    }
    h.log('type scope queue after drain', await queueRows(h));
  },

  async probe(h) {
    const rows = await h.db
      .selectFrom('object_categories_related')
      .select(['category_name', 'objects_count', 'related_names'])
      .where('scope_type', '=', 'type')
      .where('scope_key', '=', TYPE)
      .orderBy('objects_count', 'desc')
      .execute();
    h.log('type scope rows (product)', rows);
    const userRows = await h.db
      .selectFrom('object_categories_related')
      .select(['category_name', 'objects_count'])
      .where('scope_type', '=', 'user')
      .where('scope_key', '=', `${FAN}:${TYPE}`)
      .orderBy('objects_count', 'desc')
      .execute();
    h.log(`user scope rows (${FAN}:${TYPE})`, userRows);

    // Rate limit: the scope was just rebuilt, so a new enqueue must wait.
    const { ObjectCategoriesRelatedSyncQueueRepository } = require(
      '../../../../../apps/chain-indexer/src/repositories/object-categories-related-sync-queue.repository',
    );
    await h
      .get<{ enqueue(t: string, k: string, at: number): Promise<void> }>(
        ObjectCategoriesRelatedSyncQueueRepository,
      )
      .enqueue('type', TYPE, Math.floor(Date.now() / 1000));
    await worker(h, 'object-categories-related.worker', 'ObjectCategoriesRelatedWorker').runBatch();
    h.log('throttled: type scope still queued, attempts untouched', await queueRows(h));
  },
};

export default scenario;
