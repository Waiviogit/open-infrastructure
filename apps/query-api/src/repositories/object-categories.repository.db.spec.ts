import { sql, type Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import type { WeightObjectCursorPayload } from '../domain/pagination/weight-object-cursor';
import { ObjectCategoriesRepository } from './object-categories.repository';
import type { UserCategoryCountScope } from './category-scope.sql';
import type { UserFavoritesScope, UserFavoritesTagFilter } from './user-favorites-scope.sql';
import { UserFavoritesRepository } from './user-favorites.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const ACCOUNT = 'alice';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

type Fixture = {
  objectId: string;
  objectType?: string;
  weight: number | null;
  status?: 'active' | 'unavailable';
  /** `null` → no `object_categories` row at all. */
  categories: string[] | null;
  favoriteBy?: string;
  postBy?: string;
  ownedBy?: string;
  tags?: UserFavoritesTagFilter[];
};

/**
 * Recipes in a 3-level lineage: A∩X and B∩X are non-empty, but no object carries A, B and X.
 * Plus every kind of object the scope must exclude.
 */
const FIXTURES: Fixture[] = [
  { objectId: 'r-ab1', weight: 10, categories: ['A', 'B'], favoriteBy: ACCOUNT, tags: [{ category: 'Cuisine', value: 'german' }] },
  { objectId: 'r-ab2', weight: 5, categories: ['A', 'B'], favoriteBy: ACCOUNT },
  { objectId: 'r-ab3', weight: null, categories: ['A', 'B', 'Y'], postBy: ACCOUNT, tags: [{ category: 'Cuisine', value: 'german' }] },
  { objectId: 'r-ax', weight: 7, categories: ['A', 'X'], favoriteBy: ACCOUNT },
  { objectId: 'r-bx', weight: 7, categories: ['B', 'X'], favoriteBy: ACCOUNT },
  { objectId: 'r-unc', weight: 1, categories: null, favoriteBy: ACCOUNT },
  { objectId: 'r-unc2', weight: null, categories: [], postBy: ACCOUNT },
  { objectId: 'r-own', weight: 50, categories: ['A', 'B'], ownedBy: ACCOUNT },
  { objectId: 'r-off', weight: 50, categories: ['A', 'B'], favoriteBy: ACCOUNT, status: 'unavailable' },
  { objectId: 'r-desel', weight: 50, categories: ['A', 'B'], postBy: ACCOUNT },
  { objectId: 'r-bob', weight: 50, categories: ['A', 'B'], favoriteBy: 'bob' },
  { objectId: 'p-rest', objectType: 'restaurant', weight: 50, categories: ['A', 'B'], favoriteBy: ACCOUNT },
];

const RECIPE_SCOPE: UserFavoritesScope = {
  account: ACCOUNT,
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: ['r-desel'],
};

function userScope(tags: UserFavoritesTagFilter[] = []): UserCategoryCountScope {
  return { kind: 'user', scope: RECIPE_SCOPE, tags, rating: null };
}

async function seed(trx: Trx): Promise<void> {
  for (const [index, f] of FIXTURES.entries()) {
    await trx
      .insertInto('objects_core')
      .values({
        object_id: f.objectId,
        object_type: f.objectType ?? 'recipe',
        creator: 'creator',
        transaction_id: `tx-${f.objectId}`,
        status: f.status ?? 'active',
        weight: f.weight,
        meta_group_id: null,
        created_at: CREATED_AT,
      })
      .execute();
    if (f.categories != null) {
      await trx
        .insertInto('object_categories')
        .values({
          object_id: f.objectId,
          meta_group_id: null,
          category_names: f.categories,
          updated_at_seq: BigInt(index + 1),
        })
        .execute();
    }
    if (f.favoriteBy) {
      await trx
        .insertInto('object_favorite')
        .values({ object_id: f.objectId, account: f.favoriteBy, event_seq: BigInt(index + 1), created_at: CREATED_AT })
        .execute();
    }
    if (f.ownedBy) {
      await trx
        .insertInto('object_ownership')
        .values({
          object_id: f.objectId,
          account: f.ownedBy,
          ownership_type: 'exclusive',
          event_seq: BigInt(index + 1),
          created_at: CREATED_AT,
        })
        .execute();
    }
    if (f.postBy) {
      const permlink = `post-${f.objectId}`;
      await sql`
        INSERT INTO posts (author, permlink, created_unix)
        VALUES (${f.postBy}, ${permlink}, ${index + 1})
      `.execute(trx);
      await trx
        .insertInto('post_objects')
        .values({
          author: f.postBy,
          permlink,
          object_id: f.objectId,
          percent: 100,
          object_type: f.objectType ?? 'recipe',
        })
        .execute();
    }
    for (const tag of f.tags ?? []) {
      await trx
        .insertInto('object_tag_category_items')
        .values({
          object_id: f.objectId,
          object_type: f.objectType ?? 'recipe',
          category: tag.category,
          value: tag.value,
        })
        .execute();
    }
  }
}

function categoriesRepo(trx: Trx): ObjectCategoriesRepository {
  return new ObjectCategoriesRepository(trx as unknown as Kysely<Database>);
}

/** Pages through the leaf list one row at a time (exercises the keyset cursor). */
async function listAll(
  repo: ObjectCategoriesRepository,
  params: {
    scope: UserFavoritesScope;
    categoryPath: string[];
    uncategorizedOnly?: boolean;
    tags?: UserFavoritesTagFilter[];
  },
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: WeightObjectCursorPayload | null = null;
  for (let page = 0; page < FIXTURES.length + 1; page++) {
    const result = await repo.findObjectIdsByScope({
      scope: params.scope,
      categoryPath: params.categoryPath,
      uncategorizedOnly: params.uncategorizedOnly ?? false,
      tags: params.tags,
      limit: 1,
      cursor,
    });
    ids.push(...result.rows.map((r) => r.object_id));
    const last = result.rows[result.rows.length - 1];
    if (!result.hasMore || last == null) {
      return ids;
    }
    cursor = { weight: last.weight, object_id: last.object_id };
  }
  throw new Error('pagination did not terminate');
}

describeDb('Favorites scope and live category counts (test Postgres)', () => {
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

  it('scope = favorites ∪ authored post links − deselect; no ownership, inactive, other type or account', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const ids = await listAll(categoriesRepo(trx), { scope: RECIPE_SCOPE, categoryPath: [] });
      expect(ids).toEqual(['r-ab1', 'r-ax', 'r-bx', 'r-ab2', 'r-unc', 'r-ab3', 'r-unc2']);
    });
  });

  it('drops post-linked objects when the type is not in postLinkedTypes (hide flag)', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const ids = await listAll(categoriesRepo(trx), {
        scope: { ...RECIPE_SCOPE, postLinkedTypes: [] },
        categoryPath: [],
      });
      expect(ids).toEqual(['r-ab1', 'r-ax', 'r-bx', 'r-ab2', 'r-unc']);
    });
  });

  it('a section count equals the length of its fully paginated leaf list', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = categoriesRepo(trx);
      const { counts } = await repo.countCategoryLevel({
        scope: userScope(),
        parentPath: ['A'],
        categoryNames: ['B', 'X'],
      });
      const leafB = await listAll(repo, { scope: RECIPE_SCOPE, categoryPath: ['A', 'B'] });
      const leafX = await listAll(repo, { scope: RECIPE_SCOPE, categoryPath: ['A', 'X'] });

      expect(leafB).toEqual(['r-ab1', 'r-ab2', 'r-ab3']);
      expect(counts.get('B')).toBe(leafB.length);
      expect(counts.get('X')).toBe(leafX.length);
    });
  });

  it('counts with filters in the same unit as the filtered leaf list', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = categoriesRepo(trx);
      const tags = [{ category: 'Cuisine', value: 'german' }];
      const { counts } = await repo.countCategoryLevel({
        scope: userScope(tags),
        parentPath: ['A'],
        categoryNames: ['B'],
      });
      const leaf = await listAll(repo, { scope: RECIPE_SCOPE, categoryPath: ['A', 'B'], tags });

      expect(leaf).toEqual(['r-ab1', 'r-ab3']);
      expect(counts.get('B')).toBe(leaf.length);
    });
  });

  it('a child whose triple intersection is empty counts 0 although each pair is non-empty', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = categoriesRepo(trx);

      const { counts: underA } = await repo.countCategoryLevel({
        scope: userScope(),
        parentPath: ['A'],
        categoryNames: ['X'],
      });
      const { counts: underB } = await repo.countCategoryLevel({
        scope: userScope(),
        parentPath: ['B'],
        categoryNames: ['X'],
      });
      const { counts: underAB } = await repo.countCategoryLevel({
        scope: userScope(),
        parentPath: ['A', 'B'],
        categoryNames: ['X', 'Y'],
      });
      const pairs = await repo.countCategoryPairsByScope({
        scope: userScope(),
        parentPath: ['A'],
        pairs: [
          { first: 'B', second: 'X' },
          { first: 'B', second: 'Y' },
        ],
      });

      expect(underA.get('X')).toBe(1);
      expect(underB.get('X')).toBe(1);
      expect(underAB.get('X')).toBe(0);
      expect(underAB.get('Y')).toBe(1);
      expect(pairs.get('B')?.get('X')).toBeUndefined();
      expect(pairs.get('B')?.get('Y')).toBe(1);
    });
  });

  it('uncategorized count equals the uncategorized list (no row or empty category_names)', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = categoriesRepo(trx);
      const count = await repo.countUncategorizedObjectIdsByScope({ scope: RECIPE_SCOPE });
      const list = await listAll(repo, {
        scope: RECIPE_SCOPE,
        categoryPath: [],
        uncategorizedOnly: true,
      });
      expect(list).toEqual(['r-unc', 'r-unc2']);
      expect(count).toBe(list.length);
    });
  });

  it('Other: the path minus the shown names; at the root it keeps uncategorized objects', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = categoriesRepo(trx);
      const page = (categoryPath: string[], excludedCategoryNames: string[]) =>
        repo.findObjectIdsByScope({
          scope: RECIPE_SCOPE,
          categoryPath,
          uncategorizedOnly: false,
          excludedCategoryNames,
          limit: 20,
          cursor: null,
        });

      const rootOther = await page([], ['A']);
      const underA = await page(['A'], ['B']);
      const covered = await repo.countUnitsInAnyCategory({
        scope: userScope(),
        parentPath: [],
        categoryNames: ['A'],
      });
      const level = await repo.countCategoryLevel({
        scope: userScope(),
        parentPath: [],
        categoryNames: ['A'],
      });

      expect(rootOther.rows.map((r) => r.object_id)).toEqual(['r-bx', 'r-unc', 'r-unc2']);
      expect(underA.rows.map((r) => r.object_id)).toEqual(['r-ax']);
      // Other count = level total − units in a shown name = the Other list.
      expect(level.total - covered).toBe(rootOther.rows.length);
    });
  });

  it('favorites/types counts per type over the same scope', async () => {
    await withRollback(db, async (trx) => {
      await seed(trx);
      const repo = new UserFavoritesRepository(trx as unknown as Kysely<Database>);
      const types = await repo.findTypesByScope({
        ...RECIPE_SCOPE,
        types: ['recipe', 'restaurant'],
        postLinkedTypes: ['recipe', 'restaurant'],
      });
      expect(types).toEqual([
        { object_type: 'recipe', objects_count: 7, categorized_count: 5 },
        { object_type: 'restaurant', objects_count: 1, categorized_count: 1 },
      ]);
    });
  });

  describe('type scope (Discover)', () => {
    /** Fixture-only type, so other rows never join the scope. */
    const TYPE = 'dbspec-gadget';

    async function insertTyped(
      trx: Trx,
      objectId: string,
      metaGroupId: string | null,
      categories: string[] | null,
      opts: { status?: 'active' | 'unavailable'; tag?: [string, string] } = {},
    ): Promise<void> {
      await trx
        .insertInto('objects_core')
        .values({
          object_id: objectId,
          object_type: TYPE,
          creator: 'creator',
          transaction_id: `tx-${objectId}`,
          status: opts.status ?? 'active',
          weight: 1,
          meta_group_id: metaGroupId,
          created_at: CREATED_AT,
        })
        .execute();
      if (categories) {
        await trx
          .insertInto('object_categories')
          .values({
            object_id: objectId,
            meta_group_id: metaGroupId,
            category_names: categories,
            updated_at_seq: BigInt(1),
          })
          .execute();
      }
      if (opts.tag) {
        await trx
          .insertInto('object_tag_category_items')
          .values({
            object_id: objectId,
            object_type: TYPE,
            category: opts.tag[0],
            value: opts.tag[1],
          })
          .execute();
      }
    }

    async function seedType(trx: Trx): Promise<void> {
      // Two variants of one group, both Audio.
      await insertTyped(trx, 'g-v1', 'grp', ['Audio', 'Speakers'], { tag: ['Brand', 'Sony'] });
      await insertTyped(trx, 'g-v2', 'grp', ['Audio']);
      await insertTyped(trx, 'g-h1', null, ['Audio', 'Headphones'], { tag: ['Brand', 'Sony'] });
      await insertTyped(trx, 'g-h2', null, ['Audio', 'Headphones']);
      await insertTyped(trx, 'g-none', null, null);
      await insertTyped(trx, 'g-dead', null, ['Audio'], { status: 'unavailable' });
    }

    const typeScope = (tags: { category: string; value: string }[] = []) => ({
      kind: 'type' as const,
      objectType: TYPE,
      q: '',
      tags,
      box: null,
    });

    it('counts groups of active objects; the root total includes uncategorized groups', async () => {
      await withRollback(db, async (trx) => {
        await seedType(trx);
        const level = await categoriesRepo(trx).countCategoryLevel({
          scope: typeScope(),
          parentPath: [],
          categoryNames: ['Audio', 'Headphones', 'Speakers'],
        });

        // Groups: grp, g-h1, g-h2, g-none → 4; Audio = grp + g-h1 + g-h2.
        expect(level.total).toBe(4);
        expect(Object.fromEntries(level.counts)).toEqual({ Audio: 3, Headphones: 2, Speakers: 1 });
      });
    });

    it('narrows the level by lineage and by tag filters', async () => {
      await withRollback(db, async (trx) => {
        await seedType(trx);
        const repo = categoriesRepo(trx);

        const underAudio = await repo.countCategoryLevel({
          scope: typeScope(),
          parentPath: ['Audio'],
          categoryNames: ['Headphones'],
        });
        const sonyOnly = await repo.countCategoryLevel({
          scope: typeScope([{ category: 'Brand', value: 'Sony' }]),
          parentPath: ['Audio'],
          categoryNames: ['Headphones', 'Speakers'],
        });

        expect(underAudio.total).toBe(3);
        expect(underAudio.counts.get('Headphones')).toBe(2);
        expect(sonyOnly.total).toBe(2);
        expect(Object.fromEntries(sonyOnly.counts)).toEqual({ Headphones: 1, Speakers: 1 });
      });
    });

    it('counts groups in any of several names once', async () => {
      await withRollback(db, async (trx) => {
        await seedType(trx);
        const repo = categoriesRepo(trx);
        const count = (parentPath: string[], categoryNames: string[]) =>
          repo.countUnitsInAnyCategory({ scope: typeScope(), parentPath, categoryNames });

        await expect(count([], ['Headphones', 'Speakers'])).resolves.toBe(3);
        await expect(count(['Audio'], ['Headphones'])).resolves.toBe(2);
        await expect(count([], [])).resolves.toBe(0);
      });
    });

    it('counts pairs in groups', async () => {
      await withRollback(db, async (trx) => {
        await seedType(trx);
        const pairs = await categoriesRepo(trx).countCategoryPairsByScope({
          scope: typeScope(),
          parentPath: [],
          pairs: [
            { first: 'Audio', second: 'Headphones' },
            { first: 'Headphones', second: 'Speakers' },
          ],
        });

        expect(pairs.get('Audio')?.get('Headphones')).toBe(2);
        expect(pairs.has('Headphones')).toBe(false);
      });
    });
  });
});
