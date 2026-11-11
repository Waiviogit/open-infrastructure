import { UNCATEGORIZED_CATEGORY_SENTINEL } from '@opden-data-layer/core';
import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';
import type { CategoryNamePair, UserFavoritesScope } from '../../repositories';
import { UserCategoryNavigationService } from './user-category-navigation.service';

const scope: UserFavoritesScope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

/** Precomputed row; distinct group keys keep near-duplicate suppression out of the way. */
function related(name: string, objectsCount: number, relatedNames: string[] = []): ObjectCategoriesRelatedRow {
  return {
    scope_type: 'user',
    scope_key: 'alice:recipe',
    category_name: name,
    objects_count: objectsCount,
    group_keys: Array.from({ length: 12 }, (_, i) => `${name}-g${i}`),
    related_names: relatedNames,
  };
}

function createService(params: {
  rows: ObjectCategoriesRelatedRow[];
  liveCounts: Record<string, number>;
  /** `first>second` → count */
  pairCounts?: Record<string, number>;
}) {
  const objectCategoriesRepo = {
    countObjectIdsByScopeForCategories: jest
      .fn()
      .mockImplementation(async ({ categoryNames }: { categoryNames: string[] }) =>
        new Map(categoryNames.map((n) => [n, params.liveCounts[n] ?? 0])),
      ),
    countCategoryPairsByScope: jest
      .fn()
      .mockImplementation(async ({ pairs }: { pairs: CategoryNamePair[] }) => {
        const result = new Map<string, Map<string, number>>();
        for (const { first, second } of pairs) {
          const count = params.pairCounts?.[`${first}>${second}`] ?? 0;
          if (count > 0) {
            const inner = result.get(first) ?? new Map<string, number>();
            inner.set(second, count);
            result.set(first, inner);
          }
        }
        return result;
      }),
  };
  const relatedRepo = { findByUserCategoryScope: jest.fn().mockResolvedValue(params.rows) };
  const service = new UserCategoryNavigationService(
    relatedRepo as never,
    objectCategoriesRepo as never,
  );
  return { service, objectCategoriesRepo, relatedRepo };
}

const CHILDREN = ['Stews', 'Breads', 'Cakes', 'Salads', 'Soups'];

/** 3-level fixture: German Cuisine → Comfort Food → children; children co-occur pairwise with both. */
const LINEAGE_ROWS = [
  related('German Cuisine', 200, ['Comfort Food', ...CHILDREN]),
  related('Comfort Food', 150, ['German Cuisine', ...CHILDREN]),
  ...CHILDREN.map((name) => related(name, 100, ['German Cuisine', 'Comfort Food'])),
];

describe('UserCategoryNavigationService', () => {
  it('reads precomputed rows for exactly one account:type scope', async () => {
    const { service, relatedRepo } = createService({ rows: [], liveCounts: {} });
    await service.build({ scope, objectType: 'recipe', lineage: [], excluded: [], includeHasChildren: false });
    expect(relatedRepo.findByUserCategoryScope).toHaveBeenCalledWith('alice', 'recipe');
  });

  it('drops a child whose triple intersection is empty although it co-occurs pairwise with each ancestor', async () => {
    const { service, objectCategoriesRepo } = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { Stews: 3, Breads: 0, Cakes: 1, Salads: 0, Soups: 2 },
    });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: ['German Cuisine', 'Comfort Food'],
      excluded: [],
      includeHasChildren: false,
    });

    expect(nav.items.map((i) => i.name)).toEqual(['Stews', 'Cakes', 'Soups']);
    expect(objectCategoriesRepo.countObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({
        scope,
        parentPath: ['German Cuisine', 'Comfort Food'],
        categoryNames: CHILDREN,
      }),
    );
  });

  it('reports the live lineage count as objects_count (never the precomputed number)', async () => {
    const { service } = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { Stews: 3, Breads: 7, Cakes: 1, Salads: 4, Soups: 2 },
    });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: ['German Cuisine', 'Comfort Food'],
      excluded: [],
      includeHasChildren: false,
    });

    expect(nav.items.map((i) => [i.name, i.objects_count])).toEqual([
      ['Stews', 3],
      ['Breads', 7],
      ['Cakes', 1],
      ['Salads', 4],
      ['Soups', 2],
    ]);
  });

  it('sets has_children only when a grandchild intersection is non-empty', async () => {
    const { service, objectCategoriesRepo } = createService({
      rows: [...LINEAGE_ROWS, related('Bakery', 90)],
      liveCounts: { 'German Cuisine': 6, Bakery: 2, 'Comfort Food': 5 },
      pairCounts: { 'Comfort Food>Cakes': 1 },
    });

    const root = await service.build({
      scope,
      objectType: 'recipe',
      lineage: [],
      excluded: [],
      includeHasChildren: true,
    });
    const level2 = await service.build({
      scope,
      objectType: 'recipe',
      lineage: ['German Cuisine'],
      excluded: [],
      includeHasChildren: true,
    });

    // German Cuisine has precomputed children, but no live pair intersection is non-empty.
    expect(root.items).toEqual([
      { name: 'German Cuisine', objects_count: 6, has_children: false },
      { name: 'Bakery', objects_count: 2, has_children: false },
    ]);
    expect(level2.items).toEqual([{ name: 'Comfort Food', objects_count: 5, has_children: true }]);
    expect(objectCategoriesRepo.countCategoryPairsByScope).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentPath: ['German Cuisine'] }),
    );
  });

  it('ignores the uncategorized sentinel row', async () => {
    const { service } = createService({
      rows: [related(UNCATEGORIZED_CATEGORY_SENTINEL, 50), related('Desserts', 10)],
      liveCounts: { Desserts: 1, [UNCATEGORIZED_CATEGORY_SENTINEL]: 50 },
    });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: [],
      excluded: [],
      includeHasChildren: false,
    });

    expect(nav.items.map((i) => i.name)).toEqual(['Desserts']);
  });

  it('caps the root at 20 non-empty names after dropping empty ones and sets show_other', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => related(`Cat${i}`, 100 - i));
    const liveCounts = Object.fromEntries(rows.map((r, i) => [r.category_name, i < 3 ? 0 : 1]));
    const { service } = createService({ rows, liveCounts });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: [],
      excluded: [],
      includeHasChildren: false,
    });

    expect(nav.items).toHaveLength(20);
    expect(nav.items[0]?.name).toBe('Cat3');
    expect(nav.show_other).toBe(true);
  });

  it('does not set show_other when at most 20 root names are non-empty', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => related(`Cat${i}`, 100 - i));
    const liveCounts = Object.fromEntries(rows.map((r, i) => [r.category_name, i < 5 ? 0 : 1]));
    const { service } = createService({ rows, liveCounts });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: [],
      excluded: [],
      includeHasChildren: false,
    });

    expect(nav.items).toHaveLength(20);
    expect(nav.show_other).toBe(false);
  });

  it('honors excluded names and passes filters to the live count', async () => {
    const { service, objectCategoriesRepo } = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { Stews: 3, Breads: 2, Cakes: 1, Salads: 4, Soups: 2 },
    });

    const nav = await service.build({
      scope,
      objectType: 'recipe',
      lineage: ['German Cuisine', 'Comfort Food'],
      excluded: ['Breads'],
      includeHasChildren: false,
      tags: [{ category: 'Diet', value: 'vegan' }],
      rating: 8,
    });

    expect(nav.items.map((i) => i.name)).not.toContain('Breads');
    expect(objectCategoriesRepo.countObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ category: 'Diet', value: 'vegan' }], rating: 8 }),
    );
  });
});
