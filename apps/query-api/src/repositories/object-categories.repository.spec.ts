import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
} from 'kysely';
import type { Database } from '../database';
import { ObjectCategoriesRepository } from './object-categories.repository';
import type { UserFavoritesScope } from './user-favorites-scope.sql';

function createMockDb(executeQuery: jest.Mock) {
  const executor = {
    transformQuery: (node: unknown) => node,
    compileQuery: (node: unknown) => ({ sql: String(node), parameters: [], query: node }),
    withPlugins<T extends { transformQuery: unknown }>(this: T) {
      return this;
    },
    executeQuery: executeQuery,
  };
  return { getExecutor: () => executor } as unknown as Kysely<Database>;
}

describe('ObjectCategoriesRepository.findObjectIdsByCategoryName', () => {
  it('returns empty result for blank category name without querying', async () => {
    const executeQuery = jest.fn();
    const repo = new ObjectCategoriesRepository(createMockDb(executeQuery));

    await expect(
      repo.findObjectIdsByCategoryName({
        categoryName: '  ',
        limit: 20,
        cursor: null,
      }),
    ).resolves.toEqual({ rows: [], hasMore: false });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('returns empty result when limit is 0', async () => {
    const executeQuery = jest.fn();
    const repo = new ObjectCategoriesRepository(createMockDb(executeQuery));

    await expect(
      repo.findObjectIdsByCategoryName({
        categoryName: 'Active Skirts',
        limit: 0,
        cursor: null,
      }),
    ).resolves.toEqual({ rows: [], hasMore: false });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('returns rows and hasMore when extra row is fetched', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      rows: [
        { object_id: 'a', weight: 10 },
        { object_id: 'b', weight: 5 },
        { object_id: 'c', weight: 1 },
      ],
    });
    const repo = new ObjectCategoriesRepository(createMockDb(executeQuery));

    const result = await repo.findObjectIdsByCategoryName({
      categoryName: 'Active Skirts',
      limit: 2,
      cursor: null,
    });

    expect(result).toEqual({
      rows: [
        { object_id: 'a', weight: 10 },
        { object_id: 'b', weight: 5 },
      ],
      hasMore: true,
    });
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('passes exclude_object_id and cursor to the repo filters', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      rows: [{ object_id: 'x', weight: 3 }],
    });
    const repo = new ObjectCategoriesRepository(createMockDb(executeQuery));

    await repo.findObjectIdsByCategoryName({
      categoryName: 'Skirts',
      limit: 20,
      cursor: { weight: 5, object_id: 'prev' },
      excludeObjectId: 'host-1',
    });

    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('re-throws when the query fails', async () => {
    const executeQuery = jest.fn().mockRejectedValue(new Error('db down'));
    const repo = new ObjectCategoriesRepository(createMockDb(executeQuery));

    await expect(
      repo.findObjectIdsByCategoryName({
        categoryName: 'Active Skirts',
        limit: 20,
        cursor: null,
      }),
    ).rejects.toThrow('db down');
  });
});

/** Real Postgres compiler; captures compiled queries and answers with fixed rows. */
function createCapturingDb(result: unknown[] | Error): { db: Kysely<Database>; calls: CompiledQuery[] } {
  const calls: CompiledQuery[] = [];
  const connection = {
    executeQuery: async (query: CompiledQuery) => {
      calls.push(query);
      if (result instanceof Error) {
        throw result;
      }
      return { rows: result };
    },
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () =>
        ({
          init: async () => undefined,
          acquireConnection: async () => connection,
          beginTransaction: async () => undefined,
          commitTransaction: async () => undefined,
          rollbackTransaction: async () => undefined,
          releaseConnection: async () => undefined,
          destroy: async () => undefined,
        }) as never,
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, calls };
}

const scope: UserFavoritesScope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

describe('ObjectCategoriesRepository.findObjectIdsByScope', () => {
  const base = {
    scope,
    categoryPath: ['German Cuisine', 'Comfort Food'],
    uncategorizedOnly: false,
    limit: 2,
    cursor: null,
  };

  it('does not query for a scope without types', async () => {
    const { db, calls } = createCapturingDb([]);
    const repo = new ObjectCategoriesRepository(db);
    await expect(
      repo.findObjectIdsByScope({ ...base, scope: { ...scope, types: [] } }),
    ).resolves.toEqual({ rows: [], hasMore: false });
    expect(calls).toHaveLength(0);
  });

  it('orders by weight DESC NULLS LAST, object_id ASC and reports hasMore from the extra row', async () => {
    const { db, calls } = createCapturingDb([
      { object_id: 'a', weight: '9' },
      { object_id: 'b', weight: 5 },
      { object_id: 'c', weight: null },
    ]);
    const repo = new ObjectCategoriesRepository(db);

    const page = await repo.findObjectIdsByScope(base);

    expect(page).toEqual({
      rows: [
        { object_id: 'a', weight: 9 },
        { object_id: 'b', weight: 5 },
      ],
      hasMore: true,
    });
    expect(calls[0]?.sql).toMatch(/ORDER BY s\.weight DESC NULLS LAST, s\.object_id ASC\s+LIMIT/);
    expect(calls[0]?.parameters).toContainEqual(['German Cuisine', 'Comfort Food']);
  });

  it('continues after a weighted cursor: lower weight, same weight with greater id, or NULL weight', async () => {
    const { db, calls } = createCapturingDb([]);
    const repo = new ObjectCategoriesRepository(db);

    await repo.findObjectIdsByScope({ ...base, cursor: { weight: 5, object_id: 'b' } });

    const compiled = calls[0]?.sql ?? '';
    expect(compiled).toMatch(/s\.weight < \$\d+/);
    expect(compiled).toMatch(/s\.weight = \$\d+ AND s\.object_id > \$\d+/);
    expect(compiled).toMatch(/OR s\.weight IS NULL/);
  });

  it('continues after a NULL-weight cursor only among NULL weights', async () => {
    const { db, calls } = createCapturingDb([]);
    const repo = new ObjectCategoriesRepository(db);

    await repo.findObjectIdsByScope({ ...base, cursor: { weight: null, object_id: 'z' } });

    expect(calls[0]?.sql).toMatch(/\(s\.weight IS NULL AND s\.object_id > \$\d+\)/);
  });
});

describe('ObjectCategoriesRepository.countObjectIdsByScopeForCategories', () => {
  it('counts each name inside the full lineage and fills missing names with 0', async () => {
    const { db, calls } = createCapturingDb([{ category_name: 'Comfort Food', object_count: '2' }]);
    const repo = new ObjectCategoriesRepository(db);

    const counts = await repo.countObjectIdsByScopeForCategories({
      scope,
      parentPath: ['German Cuisine'],
      categoryNames: ['Comfort Food', 'Desserts'],
    });

    expect([...counts]).toEqual([
      ['Comfort Food', 2],
      ['Desserts', 0],
    ]);
    expect(calls[0]?.sql).toMatch(/cat\.category_names @> \$\d+::text\[\]/);
    expect(calls[0]?.sql).toContain('COUNT(DISTINCT lo.object_id)');
    expect(calls[0]?.parameters).toContainEqual(['German Cuisine']);
    expect(calls[0]?.parameters).toContainEqual(['Comfort Food', 'Desserts']);
  });

  it('returns zero counts when the query fails', async () => {
    const { db } = createCapturingDb(new Error('db down'));
    const repo = new ObjectCategoriesRepository(db);
    const counts = await repo.countObjectIdsByScopeForCategories({
      scope,
      parentPath: [],
      categoryNames: ['A'],
    });
    expect([...counts]).toEqual([['A', 0]]);
  });
});

describe('ObjectCategoriesRepository.countCategoryPairsByScope', () => {
  it('groups non-zero pair counts by first name', async () => {
    const { db, calls } = createCapturingDb([
      { first_name: 'A', second_name: 'X', object_count: 3 },
      { first_name: 'A', second_name: 'Y', object_count: '1' },
    ]);
    const repo = new ObjectCategoriesRepository(db);

    const pairs = await repo.countCategoryPairsByScope({
      scope,
      parentPath: ['Root'],
      pairs: [
        { first: 'A', second: 'X' },
        { first: 'A', second: 'Y' },
        { first: 'B', second: 'X' },
      ],
    });

    expect(pairs.get('A')?.get('X')).toBe(3);
    expect(pairs.get('A')?.get('Y')).toBe(1);
    expect(pairs.has('B')).toBe(false);
    expect(calls[0]?.parameters).toContainEqual(['A', 'A', 'B']);
    expect(calls[0]?.parameters).toContainEqual(['X', 'Y', 'X']);
  });

  it('does not query without pairs', async () => {
    const { db, calls } = createCapturingDb([]);
    const repo = new ObjectCategoriesRepository(db);
    await expect(
      repo.countCategoryPairsByScope({ scope, parentPath: [], pairs: [] }),
    ).resolves.toEqual(new Map());
    expect(calls).toHaveLength(0);
  });
});
