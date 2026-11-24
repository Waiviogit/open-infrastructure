import { TYPE_SCOPE_TOTAL_SENTINEL, UNCATEGORIZED_CATEGORY_SENTINEL } from '@opden-data-layer/core';
import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';
import type {
  CategoryCountScope,
  CategoryNamePair,
  UserFavoritesScope,
} from '../../repositories';
import { CategoryNavigationService } from './category-navigation.service';

const favorites: UserFavoritesScope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

const userScope: CategoryCountScope = { kind: 'user', scope: favorites, tags: [], rating: null };

const typeScope: CategoryCountScope = {
  kind: 'type',
  objectType: 'product',
  q: '',
  tags: [],
  box: null,
};

/** Precomputed row; distinct group keys keep near-duplicate suppression out of the way. */
function related(
  name: string,
  objectsCount: number,
  relatedNames: string[] = [],
  groupKeys: string[] = Array.from({ length: 12 }, (_, i) => `${name}-g${i}`),
): ObjectCategoriesRelatedRow {
  return {
    scope_type: 'user',
    scope_key: 'alice:recipe',
    category_name: name,
    objects_count: objectsCount,
    group_keys: groupKeys,
    related_names: relatedNames,
    related_counts: [],
  };
}

function createService(params: {
  rows: ObjectCategoriesRelatedRow[];
  liveCounts: Record<string, number>;
  /** Units of the level (scope + lineage + filters). */
  total: number;
  /** `first>second` → count */
  pairCounts?: Record<string, number>;
  /** Units of the level in any shown name (`countUnitsInAnyCategory`). */
  covered?: number;
}) {
  const objectCategoriesRepo = {
    countCategoryLevel: jest
      .fn()
      .mockImplementation(async ({ categoryNames }: { categoryNames: string[] }) => ({
        counts: new Map(categoryNames.map((n) => [n, params.liveCounts[n] ?? 0])),
        total: params.total,
      })),
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
    countUnitsInAnyCategory: jest.fn().mockResolvedValue(params.covered ?? 0),
  };
  const relatedRepo = {
    findByUserCategoryScope: jest.fn().mockResolvedValue(params.rows),
    findByScope: jest.fn().mockResolvedValue(params.rows),
  };
  const service = new CategoryNavigationService(
    relatedRepo as never,
    objectCategoriesRepo as never,
  );
  return { service, objectCategoriesRepo, relatedRepo };
}

const CHILDREN = ['Stews', 'Breads', 'Cakes', 'Salads', 'Soups'];

/** 3-level fixture: German Cuisine → Comfort Food → children; children co-occur with both. */
const LINEAGE_ROWS = [
  related('German Cuisine', 200, ['Comfort Food', ...CHILDREN]),
  related('Comfort Food', 150, ['German Cuisine', ...CHILDREN]),
  ...CHILDREN.map((name) => related(name, 100, ['German Cuisine', 'Comfort Food'])),
];

const DEEP = ['German Cuisine', 'Comfort Food'];

function build(
  service: CategoryNavigationService,
  overrides: Partial<Parameters<CategoryNavigationService['build']>[0]> = {},
) {
  return service.build({
    scope: userScope,
    objectType: 'recipe',
    lineage: [],
    excluded: [],
    includeHasChildren: false,
    ...overrides,
  });
}

describe('CategoryNavigationService', () => {
  it('reads precomputed rows of the user scope or of the type scope', async () => {
    const user = createService({ rows: [], liveCounts: {}, total: 0 });
    await build(user.service);
    expect(user.relatedRepo.findByUserCategoryScope).toHaveBeenCalledWith('alice', 'recipe');

    const type = createService({ rows: [], liveCounts: {}, total: 0 });
    await build(type.service, { scope: typeScope, objectType: 'product' });
    expect(type.relatedRepo.findByScope).toHaveBeenCalledWith('type', 'product');
  });

  describe('unfiltered type root from the precomputed type scope', () => {
    function typeRow(
      name: string,
      count: number,
      relatedNames: string[] = [],
      relatedCounts: number[] = [],
    ): ObjectCategoriesRelatedRow {
      return {
        scope_type: 'type',
        scope_key: 'product',
        category_name: name,
        objects_count: count,
        group_keys: [],
        related_names: relatedNames,
        related_counts: relatedCounts,
      };
    }

    const TYPE_ROWS = [
      typeRow(TYPE_SCOPE_TOTAL_SENTINEL, 58),
      typeRow('Everything', 48, ['Electronics', 'Kitchen', 'Audio'], [34, 14, 20]),
      typeRow('Electronics', 34, ['Audio', 'Everything'], [20, 34]),
      typeRow('Audio', 20, ['Electronics', 'Everything'], [20, 20]),
      typeRow('Kitchen', 14, ['Everything'], [14]),
    ];

    it('uses precomputed counts, total and pair counts without querying the type', async () => {
      const { service, objectCategoriesRepo } = createService({
        rows: TYPE_ROWS,
        liveCounts: {},
        total: 0,
      });

      const nav = await build(service, {
        scope: typeScope,
        objectType: 'product',
        includeHasChildren: true,
      });

      expect(nav.items).toEqual([
        { name: 'Electronics', objects_count: 34, has_children: true },
        { name: 'Kitchen', objects_count: 14, has_children: false },
      ]);
      expect(objectCategoriesRepo.countCategoryLevel).not.toHaveBeenCalled();
      expect(objectCategoriesRepo.countCategoryPairsByScope).not.toHaveBeenCalled();
    });

    it('counts live with a filter, below the root, or before the scope has a total', async () => {
      const filtered = createService({ rows: TYPE_ROWS, liveCounts: { Kitchen: 5 }, total: 10 });
      await build(filtered.service, {
        scope: { ...typeScope, tags: [{ category: 'Pros', value: 'Durable' }] },
        objectType: 'product',
      });
      expect(filtered.objectCategoriesRepo.countCategoryLevel).toHaveBeenCalled();

      const deeper = createService({ rows: TYPE_ROWS, liveCounts: { Audio: 20 }, total: 34 });
      await build(deeper.service, { scope: typeScope, objectType: 'product', lineage: ['Electronics'] });
      expect(deeper.objectCategoriesRepo.countCategoryLevel).toHaveBeenCalled();

      const noTotal = createService({ rows: TYPE_ROWS.slice(1), liveCounts: { Kitchen: 5 }, total: 10 });
      await build(noTotal.service, { scope: typeScope, objectType: 'product' });
      expect(noTotal.objectCategoriesRepo.countCategoryLevel).toHaveBeenCalled();
    });
  });

  describe('client display rules', () => {
    it('hides a category with fewer than 3 units', async () => {
      const { service } = createService({
        rows: LINEAGE_ROWS,
        liveCounts: { Stews: 3, Breads: 2, Cakes: 0, Salads: 4, Soups: 5 },
        total: 20,
      });

      const nav = await build(service, { lineage: DEEP });

      expect(nav.items.map((i) => i.name)).toEqual(['Soups', 'Salads', 'Stews']);
    });

    it('hides a category covering more than 60% of the level, uncategorized included', async () => {
      const { service } = createService({
        rows: LINEAGE_ROWS,
        liveCounts: { Stews: 6, Breads: 7, Cakes: 3 },
        total: 10,
      });

      const nav = await build(service, { lineage: DEEP });

      // Breads = 70% is hidden; Stews = 60% is shown.
      expect(nav.items.map((i) => i.name)).toEqual(['Stews', 'Cakes']);
    });

    it('a hidden catch-all root category does not suppress the categories it co-occurs with', async () => {
      const { service } = createService({
        rows: [
          related('Everything', 300, ['Electronics', 'Kitchen', 'Audio']),
          related('Electronics', 200, ['Everything', 'Audio']),
          related('Kitchen', 100, ['Everything']),
          related('Audio', 90, ['Everything', 'Electronics']),
        ],
        liveCounts: { Everything: 30, Electronics: 18, Kitchen: 9, Audio: 8 },
        total: 40,
      });

      const nav = await build(service);

      // Everything (75%) is hidden; Audio stays dominated by Electronics.
      expect(nav.items.map((i) => i.name)).toEqual(['Electronics', 'Kitchen']);
    });

    it('applies the rules at the root too', async () => {
      const { service } = createService({
        rows: [related('Big', 100), related('Small', 90), related('Fine', 80)],
        liveCounts: { Big: 9, Small: 2, Fine: 4 },
        total: 12,
      });

      const nav = await build(service);

      expect(nav.items.map((i) => i.name)).toEqual(['Fine']);
    });
  });

  it('reports live counts and sorts by them', async () => {
    const { service, objectCategoriesRepo } = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { Stews: 3, Breads: 7, Cakes: 4, Salads: 5, Soups: 6 },
      total: 30,
    });

    const nav = await build(service, { lineage: DEEP });

    expect(nav.items.map((i) => [i.name, i.objects_count])).toEqual([
      ['Breads', 7],
      ['Soups', 6],
      ['Salads', 5],
      ['Cakes', 4],
      ['Stews', 3],
    ]);
    expect(objectCategoriesRepo.countCategoryLevel).toHaveBeenCalledWith({
      scope: userScope,
      parentPath: DEEP,
      categoryNames: CHILDREN,
    });
  });

  describe('near-duplicates below the root', () => {
    it('drops a user-scope category whose group_keys nearly equal a stronger one', async () => {
      const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
      const { service } = createService({
        rows: [
          related('Parent', 100, ['A', 'B']),
          related('A', 50, ['Parent'], keys),
          related('B', 40, ['Parent'], keys.slice(0, 18)),
        ],
        liveCounts: { A: 20, B: 18 },
        total: 40,
      });

      const nav = await build(service, { lineage: ['Parent'] });

      expect(nav.items.map((i) => i.name)).toEqual(['A']);
    });

    it('drops a type-scope category nearly equal to a stronger one by live pair counts', async () => {
      const { service, objectCategoriesRepo } = createService({
        rows: [
          related('Parent', 100, ['A', 'B', 'C'], []),
          related('A', 50, ['Parent'], []),
          related('B', 40, ['Parent'], []),
          related('C', 30, ['Parent'], []),
        ],
        liveCounts: { A: 20, B: 18, C: 12 },
        total: 40,
        pairCounts: { 'A>B': 17, 'A>C': 2, 'B>C': 1 },
      });

      const nav = await build(service, {
        scope: typeScope,
        objectType: 'product',
        lineage: ['Parent'],
      });

      expect(nav.items.map((i) => i.name)).toEqual(['A', 'C']);
      expect(objectCategoriesRepo.countCategoryPairsByScope).toHaveBeenCalledWith(
        expect.objectContaining({ scope: typeScope, parentPath: ['Parent'] }),
      );
    });

    it('does not suppress near-duplicates at the root', async () => {
      const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
      const { service } = createService({
        rows: [related('A', 50, [], keys), related('B', 40, [], keys)],
        liveCounts: { A: 5, B: 5 },
        total: 20,
      });

      const nav = await build(service);

      expect(nav.items.map((i) => i.name)).toEqual(['A', 'B']);
    });
  });

  it('sets has_children only when a grandchild passes the rules within the category', async () => {
    const { service, objectCategoriesRepo } = createService({
      rows: [...LINEAGE_ROWS, related('Bakery', 90)],
      liveCounts: { 'German Cuisine': 10, Bakery: 4 },
      total: 20,
      // Comfort Food covers 9/10 of German Cuisine (> 60%): no child passes.
      pairCounts: { 'German Cuisine>Comfort Food': 9, 'German Cuisine>Stews': 2 },
    });

    const root = await build(service, { includeHasChildren: true });
    expect(root.items).toEqual([
      { name: 'German Cuisine', objects_count: 10, has_children: false },
      { name: 'Bakery', objects_count: 4, has_children: false },
    ]);
    expect(objectCategoriesRepo.countCategoryPairsByScope).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentPath: [] }),
    );

    const withChild = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { 'German Cuisine': 10 },
      total: 20,
      pairCounts: { 'German Cuisine>Stews': 3 },
    });
    const nav = await build(withChild.service, { includeHasChildren: true });
    expect(nav.items).toEqual([{ name: 'German Cuisine', objects_count: 10, has_children: true }]);
  });

  it('ignores the uncategorized sentinel row', async () => {
    const { service } = createService({
      rows: [related(UNCATEGORIZED_CATEGORY_SENTINEL, 50), related('Desserts', 10)],
      liveCounts: { Desserts: 3, [UNCATEGORIZED_CATEGORY_SENTINEL]: 50 },
      total: 10,
    });

    const nav = await build(service);

    expect(nav.items.map((i) => i.name)).toEqual(['Desserts']);
  });

  it('caps the root at 20 shown names and sets show_other', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => related(`Cat${i}`, 100 - i));
    const liveCounts = Object.fromEntries(rows.map((r, i) => [r.category_name, i < 3 ? 0 : 3]));
    const { service } = createService({ rows, liveCounts, total: 100 });

    const nav = await build(service);

    expect(nav.items).toHaveLength(20);
    expect(nav.items[0]?.name).toBe('Cat3');
    expect(nav.show_other).toBe(true);
  });

  it('does not set show_other when at most 20 root names are shown', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => related(`Cat${i}`, 100 - i));
    const liveCounts = Object.fromEntries(rows.map((r, i) => [r.category_name, i < 5 ? 0 : 3]));
    const { service } = createService({ rows, liveCounts, total: 100 });

    const nav = await build(service);

    expect(nav.items).toHaveLength(20);
    expect(nav.show_other).toBe(false);
  });

  it('honors excluded names and passes the scope with its filters to the live count', async () => {
    const filtered: CategoryCountScope = {
      kind: 'user',
      scope: favorites,
      tags: [{ category: 'Diet', value: 'vegan' }],
      rating: 8,
    };
    const { service, objectCategoriesRepo } = createService({
      rows: LINEAGE_ROWS,
      liveCounts: { Stews: 3, Breads: 3, Cakes: 3, Salads: 4, Soups: 3 },
      total: 30,
    });

    const nav = await build(service, { scope: filtered, lineage: DEEP, excluded: ['Breads'] });

    expect(nav.items.map((i) => i.name)).not.toContain('Breads');
    expect(objectCategoriesRepo.countCategoryLevel).toHaveBeenCalledWith(
      expect.objectContaining({ scope: filtered }),
    );
  });

  describe('other_count (the virtual Other category)', () => {
    it('is the level total minus the units in any shown child', async () => {
      const { service, objectCategoriesRepo } = createService({
        rows: LINEAGE_ROWS,
        liveCounts: { Stews: 5, Breads: 3, Cakes: 1 },
        total: 12,
        covered: 7,
      });

      const nav = await build(service, { lineage: DEEP, includeOther: true });

      expect(nav.items.map((item) => item.name)).toEqual(['Stews', 'Breads']);
      expect(nav.other_count).toBe(5);
      expect(objectCategoriesRepo.countUnitsInAnyCategory).toHaveBeenCalledWith({
        scope: userScope,
        parentPath: DEEP,
        categoryNames: ['Stews', 'Breads'],
      });
    });

    it('is 0 without includeOther or when the level shows no category', async () => {
      const shown = createService({
        rows: LINEAGE_ROWS,
        liveCounts: { Stews: 5 },
        total: 12,
        covered: 5,
      });
      expect((await build(shown.service, { lineage: DEEP })).other_count).toBe(0);
      expect(shown.objectCategoriesRepo.countUnitsInAnyCategory).not.toHaveBeenCalled();

      const leaf = createService({ rows: LINEAGE_ROWS, liveCounts: {}, total: 12 });
      const nav = await build(leaf.service, { lineage: DEEP, includeOther: true });
      expect(nav.items).toEqual([]);
      expect(nav.other_count).toBe(0);
      expect(leaf.objectCategoriesRepo.countUnitsInAnyCategory).not.toHaveBeenCalled();
    });

    it('lists the shown names for an Other listing', async () => {
      const { service } = createService({
        rows: LINEAGE_ROWS,
        liveCounts: { Stews: 5, Breads: 3, Cakes: 1 },
        total: 12,
      });

      await expect(
        service.visibleCategoryNames({ scope: userScope, objectType: 'recipe', lineage: DEEP }),
      ).resolves.toEqual(['Stews', 'Breads']);
    });
  });
});
