import { CompiledQuery, PostgresQueryCompiler, sql, type Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { ObjectSearchDocument } from '@opden-data-layer/object-search';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import type { RedisClientFactory } from '@opden-data-layer/clients';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { DiscoverRepository } from './discover.repository';
import { SearchRepository } from './search.repository';
import {
  searchDocFixture,
  seedSearchDocs,
} from './object-search-docs.spec-helpers';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const SEARCH_DOCS_TABLE = 'object_search_docs';
const VECTOR_INDEX = 'idx_object_search_docs_vector';
const GEO_INDEX = 'idx_object_search_docs_geo';
const SEQ_SCAN_ON_DOCS = /Seq Scan on object_search_docs/;
/** Documents of one type seeded before a plan check, so the planner sees a non-selective type. */
const PLAN_FILLER_DOCS = 3000;

function repo(trx: Trx): SearchRepository {
  return new SearchRepository(trx as unknown as Kysely<Database>);
}

/** Inserts the core row of every document, then writes the documents through the sink. */
async function seed(trx: Trx, docs: ObjectSearchDocument[]): Promise<void> {
  await trx
    .insertInto('objects_core')
    .values(
      docs.map((doc) => ({
        object_id: doc.objectId,
        object_type: doc.objectType,
        creator: 'alice',
        transaction_id: `tx-${doc.objectId}`,
        status: 'active' as const,
        weight: null,
        meta_group_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })),
    )
    .execute();
  await seedSearchDocs(trx, docs);
}

function fillerDocs(objectType: string, count: number): ObjectSearchDocument[] {
  return Array.from({ length: count }, (_, i) =>
    searchDocFixture(`plan-filler-${i}`, {
      objectType,
      name: `Filler Place ${i}`,
    }),
  );
}

function ids(rows: { object_id: string }[]): string[] {
  return rows.map((r) => r.object_id);
}

/** Kysely client that records compiled queries and returns no rows. */
function capturingDb(captured: CompiledQuery[]): Kysely<Database> {
  const compiler = new PostgresQueryCompiler();
  const executor = {
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown, queryId: unknown) =>
      compiler.compileQuery(node as never, queryId as never),
    withPlugins<T>(this: T) {
      return this;
    },
    executeQuery: async (query: CompiledQuery) => {
      captured.push(query);
      return { rows: [] };
    },
  };
  return { getExecutor: () => executor } as unknown as Kysely<Database>;
}

/** `EXPLAIN` text of `query` with sequential scans disabled (a tiny table would prefer one). */
async function explain(trx: Trx, query: CompiledQuery): Promise<string> {
  await sql`SET LOCAL enable_seqscan = off`.execute(trx);
  const result = await trx.executeQuery<{ 'QUERY PLAN': string }>(
    CompiledQuery.raw(`EXPLAIN ${query.sql}`, [...query.parameters]),
  );
  return result.rows.map((r) => r['QUERY PLAN']).join('\n');
}

function noRedis(): RedisClientFactory {
  return {
    getClient: () => ({ get: jest.fn(), set: jest.fn() }),
  } as unknown as RedisClientFactory;
}

describeDb('SearchRepository over object_search_docs', () => {
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

  describe('searchObjects ordering', () => {
    const docs = (): ObjectSearchDocument[] => [
      searchDocFixture('srch-exact-name', { name: 'Zorbaq Grill', weight: 1 }),
      searchDocFixture('srch-name-prefix', {
        name: 'Zorbaq Grill House',
        weight: 50,
      }),
      searchDocFixture('srch-heavy', {
        name: 'Best Zorbaq Grill',
        weight: 100,
      }),
      searchDocFixture('zorbaq-grill', { name: 'Something Else', weight: 10 }),
      searchDocFixture('srch-description', {
        name: 'Other Place',
        descriptions: ['The zorbaq grill fan club'],
        weight: null,
      }),
    ];

    it('orders exact name, name prefix, then weight (NULL last)', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, docs());
        const rows = await repo(trx).searchObjects('Zorbaq Grill', 20);
        expect(ids(rows)).toEqual([
          'srch-exact-name',
          'srch-name-prefix',
          'srch-heavy',
          'zorbaq-grill',
          'srch-description',
        ]);
        expect(rows[0]).toEqual({
          object_id: 'srch-exact-name',
          object_type: 'restaurant',
          weight: 1,
        });
      });
    });

    it('puts an exact object_id first', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, docs());
        const rows = await repo(trx).searchObjects('zorbaq-grill', 20);
        expect(ids(rows).slice(0, 3)).toEqual([
          'zorbaq-grill',
          'srch-exact-name',
          'srch-name-prefix',
        ]);
      });
    });

    it('normalizes the query like the index (case, spaces, punctuation)', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, docs());
        const rows = await repo(trx).searchObjects('  zorbaq   GRILL! ', 20);
        expect(ids(rows)[0]).toBe('srch-exact-name');
      });
    });

    it('applies the limit after ordering', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, docs());
        const rows = await repo(trx).searchObjects('zorbaq grill', 2);
        expect(ids(rows)).toEqual(['srch-exact-name', 'srch-name-prefix']);
      });
    });
  });

  describe('group collapse', () => {
    const groupDocs = (): ObjectSearchDocument[] => [
      searchDocFixture('grp-light', {
        name: 'Quokkaz Lamp',
        groupKey: 'grp-quokkaz',
        weight: 5,
      }),
      searchDocFixture('grp-heavy', {
        name: 'Quokkaz Lamp Pro',
        groupKey: 'grp-quokkaz',
        weight: 9,
      }),
      searchDocFixture('grp-solo', { name: 'Quokkaz Lamp Shade', weight: 1 }),
    ];

    it('returns one object per group, the heaviest when no exact match decides', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, groupDocs());
        const rows = await repo(trx).searchObjects('quokkaz', 20);
        expect(ids(rows)).toEqual(['grp-heavy', 'grp-solo']);
      });
    });

    it('represents a group by its exact-name object over a heavier sibling', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, groupDocs());
        const rows = await repo(trx).searchObjects('quokkaz lamp', 20);
        expect(ids(rows)).toEqual(['grp-light', 'grp-solo']);
      });
    });
  });

  describe('token rules', () => {
    const tokenDocs = (): ObjectSearchDocument[] => [
      searchDocFixture('tok-five', { name: 'Iphonez 5 Pro' }),
      searchDocFixture('tok-six', { name: 'Iphonez 6 Pro' }),
      searchDocFixture('tok-isbn', {
        name: 'Book Wombatz',
        identifiers: ['5821-77-403'],
      }),
      searchDocFixture('tok-city', {
        name: 'Cafe Ottoz',
        locality: 'Vancouverz',
      }),
      searchDocFixture('tok-womens', { name: "Women's Shoez" }),
    ];

    it.each([
      ['iphonez 5 pro', ['tok-five']],
      ['iphonez pr', ['tok-five', 'tok-six']],
      ['iphonez p', ['tok-five', 'tok-six']],
      ['582177403', ['tok-isbn']],
      ['5821-77', ['tok-isbn']],
      ['vancouv', ['tok-city']],
      ['womens shoez', ['tok-womens']],
      ['women’s', ['tok-womens']],
    ])('%j → %j', async (q, expected) => {
      await withRollback(db, async (trx) => {
        await seed(trx, tokenDocs());
        const rows = await repo(trx).searchObjects(q, 20);
        expect(ids(rows).sort()).toEqual([...expected].sort());
      });
    });

    it.each(['', '   ', 'i', 'c++', '5 p'])(
      '%j finds nothing (no searchable term)',
      async (q) => {
        await withRollback(db, async (trx) => {
          await seed(trx, tokenDocs());
          await expect(repo(trx).searchObjects(q, 20)).resolves.toEqual([]);
          await expect(repo(trx).countObjectsByType(q)).resolves.toEqual({
            counts: {},
            capped: false,
          });
        });
      },
    );

    it('does not stem: a different word form does not match', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, [
          searchDocFixture('tok-running', { name: 'Running Shoes' }),
        ]);
        await expect(
          repo(trx).searchObjects('runs shoes', 20),
        ).resolves.toEqual([]);
        await expect(
          repo(trx).searchObjects('running shoes', 20),
        ).resolves.toHaveLength(1);
      });
    });
  });

  describe('countObjectsByType', () => {
    const countDocs = (): ObjectSearchDocument[] => [
      searchDocFixture('cnt-a', {
        name: 'Capwordz One',
        groupKey: 'cnt-group',
      }),
      searchDocFixture('cnt-b', {
        name: 'Capwordz Two',
        groupKey: 'cnt-group',
      }),
      searchDocFixture('cnt-c', { name: 'Capwordz Three' }),
      searchDocFixture('cnt-d', {
        name: 'Capwordz Four',
        objectType: 'product',
      }),
    ];

    it('counts groups per type and is not capped below the cap', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, countDocs());
        await expect(repo(trx).countObjectsByType('capwordz')).resolves.toEqual(
          {
            counts: { restaurant: 2, product: 1 },
            capped: false,
          },
        );
      });
    });

    it('is capped at cap + 1 matching documents, not at the cap itself', async () => {
      await withRollback(db, async (trx) => {
        await seed(trx, countDocs());
        const atCap = await repo(trx).countObjectsByType('capwordz', 4);
        const overCap = await repo(trx).countObjectsByType('capwordz', 3);
        expect(atCap.capped).toBe(false);
        expect(overCap.capped).toBe(true);
      });
    });
  });

  describe('query plans', () => {
    it('header search uses the GIN index and never scans the table', async () => {
      const captured: CompiledQuery[] = [];
      await new SearchRepository(capturingDb(captured)).searchObjects(
        'greek tav',
        10,
      );
      await new SearchRepository(capturingDb(captured)).countObjectsByType(
        'greek tav',
      );
      expect(captured).toHaveLength(2);

      for (const query of captured) {
        await withRollback(db, async (trx) => {
          const plan = await explain(trx, query);
          expect(plan).toContain(VECTOR_INDEX);
          expect(plan).not.toMatch(SEQ_SCAN_ON_DOCS);
        });
      }
    });

    it('Discover text filter uses the GIN index, typed and untyped', async () => {
      const captured: CompiledQuery[] = [];
      const discover = new DiscoverRepository(capturingDb(captured), noRedis());
      await discover.listObjects({
        objectType: 'restaurant',
        q: 'gr',
        tags: [],
        sort: 'rank',
        limit: 20,
      });
      await discover.listObjects({
        q: 'gr',
        tags: [],
        sort: 'rank',
        limit: 20,
      });
      expect(captured).toHaveLength(2);

      for (const query of captured) {
        expect(query.sql).toContain(SEARCH_DOCS_TABLE);
        await withRollback(db, async (trx) => {
          // With statistics of an empty table the type btree looks free; one common type with a
          // rare word is the shape the text index exists for.
          await seed(trx, fillerDocs('restaurant', PLAN_FILLER_DOCS));
          await seed(trx, [
            searchDocFixture('plan-greek', { name: 'Greek Taverna' }),
          ]);
          await sql`ANALYZE objects_core`.execute(trx);
          await sql`ANALYZE object_search_docs`.execute(trx);
          const plan = await explain(trx, query);
          expect(plan).toContain(VECTOR_INDEX);
          expect(plan).not.toMatch(SEQ_SCAN_ON_DOCS);
        });
      }
    });

    it('Discover map box uses the GiST index', async () => {
      const captured: CompiledQuery[] = [];
      const discover = new DiscoverRepository(capturingDb(captured), noRedis());
      await discover.listObjects({
        objectType: 'restaurant',
        tags: [],
        sort: 'rank',
        limit: 20,
        box: { swLng: -123.2, swLat: 49.1, neLng: -123.0, neLat: 49.3 },
      });
      const [boxQuery] = captured;
      expect(captured).toHaveLength(1);
      if (!boxQuery) {
        return;
      }

      await withRollback(db, async (trx) => {
        const plan = await explain(trx, boxQuery);
        expect(plan).toContain(GEO_INDEX);
        expect(plan).not.toMatch(SEQ_SCAN_ON_DOCS);
      });
    });
  });
});
