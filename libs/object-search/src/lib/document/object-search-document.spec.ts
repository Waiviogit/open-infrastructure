import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  ObjectViewService,
  type AggregatedObject,
  type GovernanceSnapshot,
} from '@opden-data-layer/objects-domain';
import {
  OBJECT_STATUS_VALUES,
  type JsonValue,
  type ObjectStatus,
  type ObjectUpdate,
  type ObjectsCore,
  type ValidityVote,
} from '@opden-data-layer/odl-db-types';

import { buildObjectSearchDocument } from './build-object-search-document';
import { computeContentHash } from './compute-content-hash';
import {
  SEARCH_DOC_DESCRIPTION_MAX_CHARS,
  type ObjectSearchDocument,
} from './object-search-document';

const OBJECT_ID = 'abc-greek-taverna';
const ADMIN = 'admin';
const resolver = new ObjectViewService();
const governance: GovernanceSnapshot = {
  ...DEFAULT_GOVERNANCE_SNAPSHOT,
  admins: [ADMIN],
};

function core(overrides: Partial<ObjectsCore> = {}): ObjectsCore {
  return {
    object_id: OBJECT_ID,
    object_type: 'restaurant',
    creator: 'alice',
    weight: 12,
    meta_group_id: null,
    canonical: null,
    canonical_creator: null,
    transaction_id: 'tx',
    status: 'active',
    seq: 0,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

let seq = 0;
function update(
  updateType: string,
  value: { text?: string; json?: JsonValue },
  overrides: Partial<ObjectUpdate> = {},
): ObjectUpdate {
  seq += 1;
  return {
    update_id: `u${seq}`,
    object_id: OBJECT_ID,
    update_type: updateType,
    creator: 'alice',
    locale: null,
    created_at_unix: 1000 + seq,
    event_seq: BigInt(seq),
    transaction_id: `tx${seq}`,
    value_text: value.text ?? null,
    value_geo: null,
    value_json: value.json ?? null,
    value_text_normalized: null,
    search_vector: null,
    rank_score: null,
    rank_context: null,
    rank_decisive_event_seq: null,
    ...overrides,
  };
}

function rejectVote(target: ObjectUpdate): ValidityVote {
  return {
    update_id: target.update_id,
    object_id: OBJECT_ID,
    voter: ADMIN,
    vote: 'against',
    event_seq: BigInt(1_000_000),
    transaction_id: 'vote',
  };
}

function aggregated(
  updates: ObjectUpdate[],
  votes: ValidityVote[] = [],
  coreOverrides: Partial<ObjectsCore> = {},
): AggregatedObject {
  return {
    core: core(coreOverrides),
    updates,
    validity_votes: votes,
    favorites: [],
    ownerships: [],
  };
}

function build(
  object: AggregatedObject,
  geo: ReadonlyMap<string, { longitude: number; latitude: number }> = new Map(),
): ObjectSearchDocument | null {
  return buildObjectSearchDocument(
    object,
    new Map(),
    governance,
    resolver,
    geo,
  );
}

describe('buildObjectSearchDocument', () => {
  it('holds only winners: rejected and losing names are absent', () => {
    const oldName = update('name', { text: 'Old Name' });
    const rejected = update('name', { text: 'Spam Name' });
    const current = update('name', { text: 'Greek Taverna' });
    const doc = build(
      aggregated([oldName, current, rejected], [rejectVote(rejected)]),
    );

    expect(doc?.name).toBe('Greek Taverna');
    expect(doc?.names).toEqual(['Greek Taverna']);
  });

  it('builds every field from the resolved view', () => {
    const geoUpdate = update('geo', {});
    const doc = build(
      aggregated(
        [
          update('name', { text: ' Greek Taverna ' }),
          update('title', { text: 'Best souvlaki' }),
          update('description', {
            text: 'x'.repeat(SEARCH_DOC_DESCRIPTION_MAX_CHARS + 10),
          }),
          update('identifier', { json: { type: 'isbn', value: '978-3-16' } }),
          update('identifier', { json: { type: 'gtin', value: '0001' } }),
          update('identifier', { json: { type: 'isbn', value: '978-3-16' } }),
          update('address', {
            json: {
              street: 'Main 1',
              locality: 'Vancouver',
              postal_code: 'V1',
              country: 'CA',
            },
          }),
          geoUpdate,
        ],
        [],
        { meta_group_id: 'group-1' },
      ),
      new Map([[geoUpdate.update_id, { longitude: -123.1, latitude: 49.2 }]]),
    );

    expect(doc).toEqual({
      objectId: OBJECT_ID,
      objectType: 'restaurant',
      groupKey: 'group-1',
      weight: 12,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      name: 'Greek Taverna',
      names: ['Greek Taverna'],
      titles: ['Best souvlaki'],
      descriptions: ['x'.repeat(SEARCH_DOC_DESCRIPTION_MAX_CHARS)],
      identifiers: ['0001', '978-3-16'],
      locality: 'Vancouver',
      geo: { longitude: -123.1, latitude: 49.2 },
    });
  });

  it('collects the winner of every locale and the fallback winner', () => {
    const doc = build(
      aggregated([
        update('name', { text: 'Greek Taverna' }, { locale: 'en-US' }),
        update('name', { text: 'Греческая таверна' }, { locale: 'ru-RU' }),
        update('name', { text: 'Ελληνική ταβέρνα' }, { locale: null }),
      ]),
    );

    expect(doc?.name).toBe('Greek Taverna');
    expect(doc?.names).toEqual([
      'Greek Taverna',
      'Ελληνική ταβέρνα',
      'Греческая таверна',
    ]);
  });

  it.each(OBJECT_STATUS_VALUES.filter((status) => status !== 'active'))(
    'returns null for status %s',
    (status) => {
      const object = aggregated(
        [update('name', { text: 'Greek Taverna' })],
        [],
        {
          status: status as ObjectStatus,
        },
      );
      expect(build(object)).toBeNull();
    },
  );

  it('returns null when the creator is banned', () => {
    const object = aggregated([update('name', { text: 'Greek Taverna' })]);
    const doc = buildObjectSearchDocument(
      object,
      new Map(),
      { ...governance, banned: ['alice'] },
      resolver,
      new Map(),
    );
    expect(doc).toBeNull();
  });

  it('builds a document for an object without a name', () => {
    const doc = build(aggregated([]));
    expect(doc).toMatchObject({
      objectId: OBJECT_ID,
      name: null,
      names: [],
      geo: null,
    });
  });
});

describe('computeContentHash', () => {
  const doc = build(
    aggregated([update('name', { text: 'Greek Taverna' })]),
  ) as ObjectSearchDocument;

  it('does not change with weight', () => {
    expect(computeContentHash({ ...doc, weight: 999 })).toBe(
      computeContentHash(doc),
    );
  });

  it('changes with indexed content', () => {
    expect(computeContentHash({ ...doc, names: ['Other'] })).not.toBe(
      computeContentHash(doc),
    );
    expect(computeContentHash({ ...doc, groupKey: 'g' })).not.toBe(
      computeContentHash(doc),
    );
  });

  it('changes with the format version', () => {
    jest.isolateModules(() => {
      jest.doMock('./object-search-document', () => ({
        ...jest.requireActual('./object-search-document'),
        SEARCH_DOC_FORMAT_VERSION: 999,
      }));
      const {
        computeContentHash: nextVersionHash,
      } = require('./compute-content-hash');
      expect(nextVersionHash(doc)).not.toBe(computeContentHash(doc));
    });
  });
});
