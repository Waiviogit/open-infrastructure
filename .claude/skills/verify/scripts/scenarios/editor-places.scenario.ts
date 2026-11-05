/**
 * Editor `#` search + Google Maps places (docs/apps/web/spec/editor/hash-object-search.md).
 * seed: objects created through the real ODL parser with the same envelope shape as editor quick create.
 * probe: identifier rows the dedup lookup depends on.
 */
import { buildCustomJsonOp } from '@opden-data-layer/hive-broadcast';
import type { Harness, Scenario } from '../indexer-harness';

const ODL_ID = 'odl-mainnet';

/** Google place id already linked to an ODL object (the mock Google server returns it too). */
export const LINKED_PLACE_ID = 'ChIJlinkedPizzaPalace';

function createObjectOp(input: {
  objectId: string;
  name: string;
  identifier?: { type: string; value: string };
}) {
  const events: unknown[] = [
    { action: 'object_create', v: 1, payload: { object_id: input.objectId, object_type: 'restaurant' } },
    {
      action: 'update_create',
      v: 1,
      payload: { object_id: input.objectId, update_type: 'name', value_text: input.name, locale: 'en-US' },
    },
  ];
  if (input.identifier) {
    events.push({
      action: 'update_create',
      v: 1,
      payload: { object_id: input.objectId, update_type: 'identifier', value_json: input.identifier },
    });
  }
  return buildCustomJsonOp({
    required_auths: [],
    required_posting_auths: ['alice'],
    id: ODL_ID,
    json: JSON.stringify({ events }),
  });
}

async function dumpIdentifiers(h: Harness): Promise<void> {
  const rows = await h.db
    .selectFrom('object_updates')
    .select(['object_id', 'update_type', 'value_json'])
    .where('update_type', '=', 'identifier')
    .execute();
  h.log('identifier updates', rows);
}

const scenario: Scenario = {
  async seed(h) {
    await h.hiveBlock([
      createObjectOp({
        objectId: 'pzp-pizza-palace',
        name: 'Pizza Palace',
        identifier: { type: 'googleMaps', value: LINKED_PLACE_ID },
      }),
    ]);
    await h.hiveBlock([createObjectOp({ objectId: 'pzn-pizza-napoli', name: 'Pizza Napoli' })]);
    const objects = await h.db
      .selectFrom('objects_core')
      .select(['object_id', 'object_type', 'creator', 'status'])
      .execute();
    h.log('objects_core', objects);
    await dumpIdentifiers(h);
  },

  /** A second object claiming the same place id: the indexer must drop the duplicate identifier. */
  async probe(h) {
    await h.hiveBlock([
      createObjectOp({
        objectId: 'dup-pizza-palace',
        name: 'Pizza Palace copy',
        identifier: { type: 'googleMaps', value: LINKED_PLACE_ID },
      }),
    ]);
    await dumpIdentifiers(h);
  },
};

export default scenario;
