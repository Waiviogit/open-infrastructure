/**
 * Unified profile Favorites tab (docs/apps/web/spec/pages/user-profile/routes/favorites.md).
 * seed: objects + category / tag updates + favorites for `alice` through the real ODL parser,
 *       then the category, tag and related-scope workers are drained synchronously.
 * probe: precomputed scope rows next to live lineage counts.
 */
import { buildCustomJsonOp } from '@opden-data-layer/hive-broadcast';
import { sql } from 'kysely';
import type { Harness, Scenario } from '../indexer-harness';

const ODL_ID = 'odl-mainnet';
const ACCOUNT = 'alice';
const OPS_PER_BLOCK = 20;
const WORKER_ROUNDS = 10;

export const GERMAN = 'German Cuisine';
export const ITALIAN = 'Italian Cuisine';
export const COMFORT = 'Comfort Food';
const GERMAN_CHILDREN = [COMFORT, 'Dumplings', 'Desserts', 'Soups', 'Baking'];
const PER_GERMAN_CHILD = 12;
const ITALIAN_COMFORT_COUNT = 6;
const UNCATEGORIZED_RECIPES = 5;
const RESTAURANTS = 25;
const RESTAURANT_CUISINES = ['pizza', 'sushi', 'burgers'];

type ObjectSpec = {
  objectId: string;
  objectType: string;
  name: string;
  categories: string[];
  tags: Array<{ category: string; value: string }>;
};

function objectOp(spec: ObjectSpec) {
  const events: unknown[] = [
    { action: 'object_create', v: 1, payload: { object_id: spec.objectId, object_type: spec.objectType } },
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
    ...spec.tags.map((tag) => ({
      action: 'update_create',
      v: 1,
      payload: { object_id: spec.objectId, update_type: 'tagCategoryItem', value_json: tag, locale: 'en-US' },
    })),
    { action: 'object_favorite', v: 1, payload: { object_id: spec.objectId, method: 'add' } },
  ];
  return buildCustomJsonOp({
    required_auths: [],
    required_posting_auths: [ACCOUNT],
    id: ODL_ID,
    json: JSON.stringify({ events }),
  });
}

function buildSpecs(): ObjectSpec[] {
  const specs: ObjectSpec[] = [];
  GERMAN_CHILDREN.forEach((child, ci) => {
    for (let i = 1; i <= PER_GERMAN_CHILD; i++) {
      specs.push({
        objectId: `fav-de-${ci}-${i}`,
        objectType: 'recipe',
        name: `${child} recipe ${i} (German)`,
        categories: [GERMAN, child],
        tags: [{ category: 'Cuisine', value: 'german' }],
      });
    }
  });
  for (let i = 1; i <= ITALIAN_COMFORT_COUNT; i++) {
    specs.push({
      objectId: `fav-it-${i}`,
      objectType: 'recipe',
      name: `Comfort recipe ${i} (Italian)`,
      categories: [ITALIAN, COMFORT],
      tags: [{ category: 'Cuisine', value: 'italian' }],
    });
  }
  for (let i = 1; i <= UNCATEGORIZED_RECIPES; i++) {
    specs.push({ objectId: `fav-unc-${i}`, objectType: 'recipe', name: `Loose recipe ${i}`, categories: [], tags: [] });
  }
  for (let i = 1; i <= RESTAURANTS; i++) {
    specs.push({
      objectId: `fav-rest-${i}`,
      objectType: 'restaurant',
      name: `Restaurant ${i}`,
      categories: [],
      tags: [{ category: 'Cuisine', value: RESTAURANT_CUISINES[i % RESTAURANT_CUISINES.length] }],
    });
  }
  for (let i = 1; i <= 3; i++) {
    specs.push({ objectId: `fav-prod-${i}`, objectType: 'product', name: `Gadget ${i}`, categories: ['Gadgets'], tags: [] });
  }
  specs.push({ objectId: 'fav-book-1', objectType: 'book', name: 'Uncategorized book', categories: [], tags: [] });
  return specs;
}

async function drainWorkers(h: Harness): Promise<void> {
  const { ObjectCategoriesWorker } = require('../../../../../apps/chain-indexer/src/domain/odl-parser/object-categories.worker');
  const { ObjectTagCategoriesWorker } = require('../../../../../apps/chain-indexer/src/domain/odl-parser/object-tag-categories.worker');
  const { ObjectCategoriesRelatedWorker } = require('../../../../../apps/chain-indexer/src/domain/odl-parser/object-categories-related.worker');
  const workers = [ObjectCategoriesWorker, ObjectTagCategoriesWorker, ObjectCategoriesRelatedWorker].map(
    (token) => h.get<{ runBatch(): Promise<void> }>(token),
  );
  for (let round = 0; round < WORKER_ROUNDS; round++) {
    for (const worker of workers) {
      await worker.runBatch();
    }
  }
}

const scenario: Scenario = {
  async seed(h) {
    // The profile route 404s without an account row; the viewer needs one too.
    await sql`
      INSERT INTO accounts_current (name) VALUES (${ACCOUNT}), ('carol')
      ON CONFLICT (name) DO NOTHING
    `.execute(h.db);
    const specs = buildSpecs();
    for (let i = 0; i < specs.length; i += OPS_PER_BLOCK) {
      await h.hiveBlock(specs.slice(i, i + OPS_PER_BLOCK).map(objectOp));
    }
    await drainWorkers(h);
    const byType = await h.db
      .selectFrom('object_favorite as f')
      .innerJoin('objects_core as oc', 'oc.object_id', 'f.object_id')
      .select(['oc.object_type', 'oc.status'])
      .select((eb) => eb.fn.countAll().as('n'))
      .where('f.account', '=', ACCOUNT)
      .groupBy(['oc.object_type', 'oc.status'])
      .execute();
    h.log('favorites by type/status', byType);
  },

  async probe(h) {
    await drainWorkers(h);
    const queues = await Promise.all([
      h.db.selectFrom('object_categories_sync_queue').select((eb) => eb.fn.countAll().as('n')).executeTakeFirst(),
      h.db.selectFrom('object_categories_related_sync_queue').select((eb) => eb.fn.countAll().as('n')).executeTakeFirst(),
    ]);
    h.log('queues (categories, related)', queues);
    const related = await h.db
      .selectFrom('object_categories_related')
      .select(['scope_key', 'category_name', 'objects_count'])
      .where('scope_type', '=', 'user')
      .orderBy('scope_key')
      .orderBy('objects_count', 'desc')
      .execute();
    h.log('user scope rows', related);
    const tags = await h.db
      .selectFrom('object_tag_category_items')
      .select(['object_type', 'category', 'value'])
      .select((eb) => eb.fn.countAll().as('n'))
      .groupBy(['object_type', 'category', 'value'])
      .execute();
    h.log('tag items', tags);
  },
};

export default scenario;
