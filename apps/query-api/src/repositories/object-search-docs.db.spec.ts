import { sql, type Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import {
  OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT,
  ObjectSearchQueueRepository,
  ObjectSearchRebuildService,
  ObjectSearchSourceRepository,
  PostgresObjectSearchSink,
  buildPrefixTsQuery,
  type ObjectSearchDocument,
} from '@opden-data-layer/object-search';
import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  type GovernanceSnapshot,
} from '@opden-data-layer/objects-domain';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Db = Kysely<OdlDatabase>;

/**
 * Fixture prefix and type. Every case runs in a rolled-back transaction; the sink built on that
 * transaction writes inside it.
 */
const P = 'osdb';
const FIXTURE_TYPE = 'osdbfixture';
const ADMIN = `${P}-admin`;
const AUTHOR = `${P}-author`;
const ADMIN_GOVERNANCE: GovernanceSnapshot = {
  ...DEFAULT_GOVERNANCE_SNAPSHOT,
  admins: [ADMIN],
};
const OLD_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const RETRY_AFTER_SEC = 60;
const LIVE_ENQUEUED_AT = 1_790_000_000;

interface StoredDoc {
  object_id: string;
  object_type: string;
  group_key: string;
  weight: number | null;
  name: string | null;
  name_norm: string | null;
  vector: string;
  content_hash: string;
  updated_at: Date;
  longitude: number | null;
  latitude: number | null;
}

async function insertCore(
  db: Db,
  objectId: string,
  opts: {
    status?: 'active' | 'closed';
    weight?: number | null;
    metaGroupId?: string;
  } = {},
): Promise<void> {
  await db
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: FIXTURE_TYPE,
      creator: AUTHOR,
      transaction_id: `tx-${objectId}`,
      status: opts.status ?? 'active',
      weight: opts.weight ?? null,
      meta_group_id: opts.metaGroupId ?? null,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    .execute();
}

async function setStatus(
  db: Db,
  objectId: string,
  status: 'active' | 'closed',
): Promise<void> {
  await db
    .updateTable('objects_core')
    .set({ status })
    .where('object_id', '=', objectId)
    .execute();
}

async function insertNameUpdate(
  db: Db,
  objectId: string,
  updateId: string,
  name: string,
  eventSeq: number,
): Promise<void> {
  await db
    .insertInto('object_updates')
    .values({
      update_id: updateId,
      object_id: objectId,
      update_type: 'name',
      creator: AUTHOR,
      locale: 'en-US',
      created_at_unix: eventSeq,
      event_seq: BigInt(eventSeq),
      transaction_id: `tx-${updateId}`,
      value_text: name,
      value_geo: null,
      value_json: null,
    })
    .execute();
}

async function insertGeoUpdate(
  db: Db,
  objectId: string,
  updateId: string,
  point: { longitude: number; latitude: number },
  eventSeq: number,
): Promise<void> {
  await sql`
    INSERT INTO object_updates (
      update_id, object_id, update_type, creator, locale, created_at_unix, event_seq,
      transaction_id, value_geo
    )
    VALUES (
      ${updateId}, ${objectId}, 'geo', ${AUTHOR}, NULL, ${eventSeq}, ${eventSeq},
      ${`tx-${updateId}`},
      ST_SetSRID(ST_MakePoint(${point.longitude}::float8, ${point.latitude}::float8), 4326)::geography
    )
  `.execute(db);
}

async function insertValidityVote(
  db: Db,
  objectId: string,
  updateId: string,
  voter: string,
  vote: 'for' | 'against',
  eventSeq: number,
): Promise<void> {
  await db
    .insertInto('validity_votes')
    .values({
      update_id: updateId,
      object_id: objectId,
      voter,
      vote,
      event_seq: BigInt(eventSeq),
      transaction_id: `tx-vote-${updateId}-${voter}`,
    })
    .execute();
}

/** Inserts a minimal document row directly (queue specs need rows, not real documents). */
async function insertDocRow(db: Db, objectId: string): Promise<void> {
  await sql`
    INSERT INTO object_search_docs (object_id, object_type, group_key, created_at, search_vector, content_hash)
    VALUES (${objectId}, ${FIXTURE_TYPE}, ${objectId}, now(), to_tsvector('simple', 'fixture'), 'hash')
  `.execute(db);
}

function searchDoc(
  objectId: string,
  overrides: Partial<ObjectSearchDocument> = {},
): ObjectSearchDocument {
  return {
    objectId,
    objectType: FIXTURE_TYPE,
    groupKey: objectId,
    weight: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    name: 'Kryptonia Tavernaki',
    names: ['Kryptonia Tavernaki'],
    titles: [],
    descriptions: [],
    identifiers: [],
    locality: null,
    geo: null,
    ...overrides,
  };
}

async function readDoc(
  db: Db,
  objectId: string,
): Promise<StoredDoc | undefined> {
  const { rows } = await sql<StoredDoc>`
    SELECT
      object_id, object_type, group_key, weight, name, name_norm,
      search_vector::text AS vector, content_hash, updated_at,
      ST_X(geo) AS longitude, ST_Y(geo) AS latitude
    FROM object_search_docs
    WHERE object_id = ${objectId}
  `.execute(db);
  return rows[0];
}

/** Whether the document of `objectId` matches the user query, as search builds it. */
async function matches(
  db: Db,
  objectId: string,
  queryText: string,
): Promise<boolean> {
  const tsQuery = buildPrefixTsQuery(queryText);
  if (tsQuery === null) {
    throw new Error(`No search terms in "${queryText}"`);
  }
  const { rows } = await sql`
    SELECT 1
    FROM object_search_docs
    WHERE object_id = ${objectId}
      AND search_vector @@ to_tsquery('simple', ${tsQuery})
  `.execute(db);
  return rows.length > 0;
}

async function ageDoc(db: Db, objectId: string): Promise<void> {
  await sql`UPDATE object_search_docs SET updated_at = ${OLD_TIMESTAMP}::timestamptz WHERE object_id = ${objectId}`.execute(
    db,
  );
}

async function queueRows(
  db: Db,
): Promise<{ object_id: string; enqueued_at: number }[]> {
  const { rows } = await sql<{ object_id: string; enqueued_at: string }>`
    SELECT object_id, enqueued_at
    FROM object_search_docs_sync_queue
    WHERE object_id LIKE ${`${P}-%`}
    ORDER BY object_id
  `.execute(db);
  return rows.map((row) => ({
    object_id: row.object_id,
    enqueued_at: Number(row.enqueued_at),
  }));
}

/** Queue specs run in a rolled-back transaction that first empties the queue, so claims see only fixtures. */
async function emptyQueue(db: Db): Promise<void> {
  await sql`DELETE FROM object_search_docs_sync_queue`.execute(db);
}

function rebuildServiceOn(trx: Db): ObjectSearchRebuildService {
  return new ObjectSearchRebuildService(new ObjectSearchSourceRepository(trx), [
    new PostgresObjectSearchSink(trx),
  ]);
}

describeDb('object_search_docs write path (db)', () => {
  const db = createTestDb();

  beforeAll(async () => {
    const migrated = await migrateToLatest({
      connectionString: resolveTestPostgresUrl(),
    });
    if (migrated.error) {
      throw migrated.error;
    }
  }, 60_000);

  afterAll(async () => {
    await db.destroy();
  });

  describe('PostgresObjectSearchSink', () => {
    it('inserts a searchable row with name_norm, group_key and geo point', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-insert`;
        await insertCore(trx, id);

        await sink.apply({
          upserts: [
            searchDoc(id, {
              name: 'Kryptonia  TAVERNAKI',
              names: ['Kryptonia  TAVERNAKI'],
              groupKey: `${P}-group`,
              weight: 7.5,
              geo: { longitude: 23.7275, latitude: 37.9838 },
            }),
          ],
          deleteIds: [],
        });

        const row = await readDoc(trx, id);
        expect(row).toMatchObject({
          object_type: FIXTURE_TYPE,
          group_key: `${P}-group`,
          weight: 7.5,
          name: 'Kryptonia  TAVERNAKI',
          name_norm: 'kryptonia tavernaki',
        });
        expect(row?.longitude).toBeCloseTo(23.7275, 6);
        expect(row?.latitude).toBeCloseTo(37.9838, 6);
        expect(await matches(trx, id, 'kryptonia tav')).toBe(true);
        expect(await matches(trx, id, 'tavernaki kryp')).toBe(true);
        expect(await matches(trx, id, 'kryptonia osteria')).toBe(false);
      });
    });

    it('content change rewrites the vector, hash and updated_at', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-content`;
        await insertCore(trx, id);
        await sink.apply({ upserts: [searchDoc(id)], deleteIds: [] });
        await ageDoc(trx, id);
        const before = await readDoc(trx, id);

        await sink.apply({
          upserts: [
            searchDoc(id, {
              name: 'Zelvorin Osteria',
              names: ['Zelvorin Osteria'],
            }),
          ],
          deleteIds: [],
        });

        const after = await readDoc(trx, id);
        expect(after?.name_norm).toBe('zelvorin osteria');
        expect(after?.content_hash).not.toBe(before?.content_hash);
        expect(after?.vector).not.toBe(before?.vector);
        expect(after?.updated_at.getTime()).toBeGreaterThan(
          new Date(OLD_TIMESTAMP).getTime(),
        );
        expect(await matches(trx, id, 'zelvorin')).toBe(true);
        expect(await matches(trx, id, 'kryptonia')).toBe(false);
      });
    });

    it('weight-only change updates weight and leaves search_vector, content_hash and updated_at untouched', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-weight`;
        await insertCore(trx, id);
        await sink.apply({
          upserts: [searchDoc(id, { weight: 1 })],
          deleteIds: [],
        });
        await ageDoc(trx, id);
        const before = await readDoc(trx, id);

        await sink.apply({
          upserts: [searchDoc(id, { weight: 42 })],
          deleteIds: [],
        });

        const after = await readDoc(trx, id);
        expect(after?.weight).toBe(42);
        expect(after?.vector).toBe(before?.vector);
        expect(after?.content_hash).toBe(before?.content_hash);
        expect(after?.updated_at.toISOString()).toBe(OLD_TIMESTAMP);
      });
    });

    it('an unchanged document is not rewritten without force, and is with force', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-force`;
        await insertCore(trx, id);
        await sink.apply({ upserts: [searchDoc(id)], deleteIds: [] });
        await ageDoc(trx, id);

        await sink.apply({ upserts: [searchDoc(id)], deleteIds: [] });
        expect((await readDoc(trx, id))?.updated_at.toISOString()).toBe(
          OLD_TIMESTAMP,
        );

        await sink.apply(
          { upserts: [searchDoc(id)], deleteIds: [] },
          { force: true },
        );
        expect((await readDoc(trx, id))?.updated_at.getTime()).toBeGreaterThan(
          new Date(OLD_TIMESTAMP).getTime(),
        );
      });
    });

    it('deletes the rows of deleteIds', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const removed = `${P}-sink-delete`;
        const kept = `${P}-sink-keep`;
        await insertCore(trx, removed);
        await insertCore(trx, kept);
        await sink.apply({
          upserts: [searchDoc(removed), searchDoc(kept)],
          deleteIds: [],
        });

        await sink.apply({ upserts: [], deleteIds: [removed] });

        expect(await readDoc(trx, removed)).toBeUndefined();
        expect(await readDoc(trx, kept)).toBeDefined();
      });
    });

    it('an identifier matches by its words and by its compact form', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-identifier`;
        await insertCore(trx, id);

        await sink.apply({
          upserts: [searchDoc(id, { identifiers: ['978-3-16'] })],
          deleteIds: [],
        });

        expect(await matches(trx, id, '978316')).toBe(true);
        expect(await matches(trx, id, '978-3-16')).toBe(true);
        expect(await matches(trx, id, '978 3 16')).toBe(true);
        expect(await matches(trx, id, '97831')).toBe(true);
      });
    });

    it('the words of the object id match', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const id = `${P}-sink-zentrovar`;
        await insertCore(trx, id);

        await sink.apply({
          upserts: [searchDoc(id, { name: null, names: [] })],
          deleteIds: [],
        });

        expect(await matches(trx, id, 'zentrovar')).toBe(true);
      });
    });

    it('skips a document whose object has no objects_core row, without failing the batch', async () => {
      await withRollback(db, async (trx) => {
        const sink = new PostgresObjectSearchSink(trx);
        const ghost = `${P}-sink-ghost`;
        const real = `${P}-sink-real`;
        await insertCore(trx, real);

        await expect(
          sink.apply({
            upserts: [searchDoc(ghost), searchDoc(real)],
            deleteIds: [],
          }),
        ).resolves.toBeUndefined();

        expect(await readDoc(trx, ghost)).toBeUndefined();
        expect(await readDoc(trx, real)).toBeDefined();
      });
    });
  });

  describe('ObjectSearchQueueRepository', () => {
    it('a re-enqueue during a claim is not lost', async () => {
      await withRollback(db, async (trx) => {
        await emptyQueue(trx);
        const queue = new ObjectSearchQueueRepository(trx);
        const id = `${P}-q-reenqueue`;
        await queue.enqueue(id, LIVE_ENQUEUED_AT);

        const claimed = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(claimed.map((task) => task.object_id)).toEqual([id]);

        await queue.enqueue(id, LIVE_ENQUEUED_AT);
        await queue.finishClaimed(claimed);

        expect(await queueRows(trx)).toEqual([
          { object_id: id, enqueued_at: LIVE_ENQUEUED_AT + 1 },
        ]);
        const reclaimed = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(reclaimed.map((task) => task.object_id)).toEqual([id]);

        await queue.finishClaimed(reclaimed);
        expect(await queueRows(trx)).toEqual([]);
      });
    });

    it('claims live rows before bulk rows', async () => {
      await withRollback(db, async (trx) => {
        await emptyQueue(trx);
        const queue = new ObjectSearchQueueRepository(trx);
        const bulk = [`${P}-q-bulk-a`, `${P}-q-bulk-b`];
        const live = `${P}-q-live`;
        await queue.enqueueMany(bulk, OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT);
        await queue.enqueue(live, LIVE_ENQUEUED_AT);

        const first = await queue.claimBatch(1, RETRY_AFTER_SEC);
        expect(first.map((task) => task.object_id)).toEqual([live]);

        const rest = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(rest.map((task) => task.object_id).sort()).toEqual(bulk);
      });
    });

    it('releaseClaimed keeps the row and holds it back for the retry window', async () => {
      await withRollback(db, async (trx) => {
        await emptyQueue(trx);
        const queue = new ObjectSearchQueueRepository(trx);
        const id = `${P}-q-release`;
        await queue.enqueue(id, LIVE_ENQUEUED_AT);
        const claimed = await queue.claimBatch(10, RETRY_AFTER_SEC);
        expect(claimed.map((task) => task.object_id)).toEqual([id]);

        await queue.releaseClaimed([id]);

        expect(await queueRows(trx)).toEqual([
          { object_id: id, enqueued_at: LIVE_ENQUEUED_AT },
        ]);
        expect(await queue.claimBatch(10, RETRY_AFTER_SEC)).toEqual([]);
        expect(await queue.countPending()).toBe(1);
      });
    });

    it('enqueueRepair queues active objects without a document and documents of non-active objects', async () => {
      await withRollback(db, async (trx) => {
        await emptyQueue(trx);
        const activeWithoutDoc = `${P}-r-active-nodoc`;
        const activeWithDoc = `${P}-r-active-doc`;
        const closedWithDoc = `${P}-r-closed-doc`;
        const closedWithoutDoc = `${P}-r-closed-nodoc`;
        await insertCore(trx, activeWithoutDoc);
        await insertCore(trx, activeWithDoc);
        await insertCore(trx, closedWithDoc, { status: 'closed' });
        await insertCore(trx, closedWithoutDoc, { status: 'closed' });
        await insertDocRow(trx, activeWithDoc);
        await insertDocRow(trx, closedWithDoc);

        await new ObjectSearchQueueRepository(trx).enqueueRepair();

        expect(await queueRows(trx)).toEqual([
          {
            object_id: activeWithoutDoc,
            enqueued_at: OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT,
          },
          {
            object_id: closedWithDoc,
            enqueued_at: OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT,
          },
        ]);
      });
    });

    it('countPending counts queued rows, collapsing duplicate ids', async () => {
      await withRollback(db, async (trx) => {
        await emptyQueue(trx);
        const queue = new ObjectSearchQueueRepository(trx);
        expect(await queue.countPending()).toBe(0);

        await queue.enqueueMany(
          [`${P}-c-1`, `${P}-c-2`, `${P}-c-1`],
          LIVE_ENQUEUED_AT,
        );
        await queue.enqueue(`${P}-c-3`, LIVE_ENQUEUED_AT);

        expect(await queue.countPending()).toBe(3);
      });
    });
  });

  describe('ObjectSearchRebuildService end to end', () => {
    const id = `${P}-rb-object`;

    it('a newer name replaces the old one', async () => {
      await withRollback(db, async (trx) => {
        const rebuildService = rebuildServiceOn(trx);
        await insertCore(trx, id);
        await insertNameUpdate(
          trx,
          id,
          `${P}-rb-name-1`,
          'Quellmore Bistro',
          1,
        );

        expect(
          await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT),
        ).toEqual({
          loaded: 1,
          upserted: 1,
          deleted: 0,
          missing: 0,
        });
        expect(await matches(trx, id, 'quellmore')).toBe(true);

        await insertNameUpdate(trx, id, `${P}-rb-name-2`, 'Vantorel Bistro', 2);
        await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT);

        expect((await readDoc(trx, id))?.name).toBe('Vantorel Bistro');
        expect(await matches(trx, id, 'vantorel')).toBe(true);
        expect(await matches(trx, id, 'quellmore')).toBe(false);
      });
    });

    it('a name rejected by an admin never matches', async () => {
      await withRollback(db, async (trx) => {
        const rebuildService = rebuildServiceOn(trx);
        await insertCore(trx, id);
        await insertNameUpdate(
          trx,
          id,
          `${P}-rb-name-1`,
          'Quellmore Bistro',
          1,
        );
        await insertNameUpdate(
          trx,
          id,
          `${P}-rb-name-2`,
          'Brennwick Bistro',
          2,
        );
        await insertValidityVote(
          trx,
          id,
          `${P}-rb-name-2`,
          ADMIN,
          'against',
          3,
        );

        await rebuildService.rebuild([id], ADMIN_GOVERNANCE);

        expect((await readDoc(trx, id))?.name).toBe('Quellmore Bistro');
        expect(await matches(trx, id, 'quellmore')).toBe(true);
        expect(await matches(trx, id, 'brennwick')).toBe(false);
      });
    });

    it('closing the object removes the row and reactivating restores it', async () => {
      await withRollback(db, async (trx) => {
        const rebuildService = rebuildServiceOn(trx);
        await insertCore(trx, id);
        await insertNameUpdate(
          trx,
          id,
          `${P}-rb-name-1`,
          'Quellmore Bistro',
          1,
        );
        await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT);
        expect(await readDoc(trx, id)).toBeDefined();

        await setStatus(trx, id, 'closed');
        expect(
          await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT),
        ).toMatchObject({
          upserted: 0,
          deleted: 1,
        });
        expect(await readDoc(trx, id)).toBeUndefined();

        await setStatus(trx, id, 'active');
        await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT);
        expect(await matches(trx, id, 'quellmore')).toBe(true);
      });
    });

    it('stores the coordinates of the geo update', async () => {
      await withRollback(db, async (trx) => {
        const rebuildService = rebuildServiceOn(trx);
        await insertCore(trx, id);
        await insertGeoUpdate(
          trx,
          id,
          `${P}-rb-geo-1`,
          { longitude: -73.9857, latitude: 40.7484 },
          1,
        );

        await rebuildService.rebuild([id], DEFAULT_GOVERNANCE_SNAPSHOT);

        const row = await readDoc(trx, id);
        expect(row?.longitude).toBeCloseTo(-73.9857, 6);
        expect(row?.latitude).toBeCloseTo(40.7484, 6);
      });
    });

    it('ignores requested ids without an objects_core row', async () => {
      await withRollback(db, async (trx) => {
        const rebuildService = rebuildServiceOn(trx);
        await insertCore(trx, id);

        expect(
          await rebuildService.rebuild(
            [id, `${P}-rb-missing`],
            DEFAULT_GOVERNANCE_SNAPSHOT,
          ),
        ).toEqual({ loaded: 1, upserted: 1, deleted: 0, missing: 1 });
        expect(await readDoc(trx, `${P}-rb-missing`)).toBeUndefined();
      });
    });
  });
});
