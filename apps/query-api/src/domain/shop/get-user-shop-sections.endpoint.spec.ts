import type { ObjectCategoriesRelatedRow } from '@opden-data-layer/odl-db-types';
import { UserCategoryNavigationService } from '../categories/user-category-navigation.service';
import type { ShopSectionsQuery } from './shop.schema';
import { GetUserShopSectionsEndpoint } from './get-user-shop-sections.endpoint';

const scope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

/** Precomputed row; distinct group keys keep level-2 near-duplicate suppression out of the way. */
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

const ROOT_ROWS = [related('Desserts', 30), related('Comfort Food', 29), related('Soups', 10)];

function createEndpoint(params: {
  rows: ObjectCategoriesRelatedRow[];
  liveCounts: Record<string, number>;
  previews?: Record<string, string[]>;
}) {
  const objectCategoriesRepo = {
    countObjectIdsByScopeForCategories: jest
      .fn()
      .mockImplementation(async ({ categoryNames }: { categoryNames: string[] }) =>
        new Map(categoryNames.map((n) => [n, params.liveCounts[n] ?? 0])),
      ),
    findObjectIdsByScopeForCategories: jest
      .fn()
      .mockImplementation(async ({ categoryNames }: { categoryNames: string[] }) =>
        new Map(categoryNames.map((n) => [n, params.previews?.[n] ?? []])),
      ),
    countCategoryPairsByScope: jest.fn().mockResolvedValue(new Map()),
  };
  const relatedRepo = { findByUserCategoryScope: jest.fn().mockResolvedValue(params.rows) };
  const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
  const navigation = new UserCategoryNavigationService(
    relatedRepo as never,
    objectCategoriesRepo as never,
  );
  const allPreviewIds = Object.values(params.previews ?? {}).flat();
  const endpoint = new GetUserShopSectionsEndpoint(
    resolver as never,
    navigation,
    objectCategoriesRepo as never,
    {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: allPreviewIds.map((id) => ({ core: { object_id: id } })),
        voterWaivPowers: {},
        rankVoteProjection: {},
      }),
    } as never,
    { resolve: jest.fn().mockReturnValue(allPreviewIds.map((id) => ({ object_id: id }))) } as never,
    {
      batchProject: jest.fn().mockResolvedValue(allPreviewIds.map((id) => ({ object_id: id }))),
    } as never,
    { enrich: jest.fn() } as never,
  );
  return { endpoint, objectCategoriesRepo, relatedRepo, resolver };
}

const query: ShopSectionsQuery = { types: ['recipe'], path: [], tags: [], sectionLimit: 3 };

describe('GetUserShopSectionsEndpoint', () => {
  it('uses the live lineage count as totalObjects, not the precomputed objects_count', async () => {
    const { endpoint } = createEndpoint({
      rows: ROOT_ROWS,
      liveCounts: { Desserts: 2, 'Comfort Food': 0, Soups: 5 },
      previews: { Desserts: ['d1', 'd2'], Soups: ['s1'] },
    });

    const result = await endpoint.execute('alice', query, 'en-US', undefined, undefined);

    expect(result?.sections.map((s) => [s.categoryName, s.totalObjects])).toEqual([
      ['Desserts', 2],
      ['Soups', 5],
    ]);
    expect(result?.sections[0]?.items.map((i) => i.object_id)).toEqual(['d1', 'd2']);
  });

  it('drops a section whose lineage intersection is empty (count 0 never shows an empty leaf)', async () => {
    const { endpoint, objectCategoriesRepo } = createEndpoint({
      rows: [
        related('German Cuisine', 100),
        related('Comfort Food', 29, ['German Cuisine']),
        related('Stews', 20, ['German Cuisine']),
        related('Breads', 20, ['German Cuisine']),
        related('Cakes', 20, ['German Cuisine']),
        related('Salads', 20, ['German Cuisine']),
      ],
      liveCounts: { 'Comfort Food': 0, Stews: 3, Breads: 1, Cakes: 2, Salads: 0 },
    });

    const result = await endpoint.execute(
      'alice',
      { ...query, name: 'German Cuisine', sectionLimit: 10 },
      'en-US',
      undefined,
      undefined,
    );

    expect(result?.sections.map((s) => s.categoryName)).toEqual(['Stews', 'Breads', 'Cakes']);
    expect(result?.sections.map((s) => s.totalObjects)).toEqual([3, 1, 2]);
    // Comfort Food was a precomputed candidate (29 objects) and was dropped only by its live count.
    expect(objectCategoriesRepo.countObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ categoryNames: expect.arrayContaining(['Comfort Food']) }),
    );
    expect(result?.sections.every((s) => s.totalObjects > 0)).toBe(true);
  });

  it('counts and previews with the same lineage as the section leaf list', async () => {
    const { endpoint, objectCategoriesRepo } = createEndpoint({
      rows: [
        related('German Cuisine', 100),
        related('Comfort Food', 29, ['German Cuisine']),
        related('Stews', 20, ['German Cuisine']),
        related('Breads', 20, ['German Cuisine']),
        related('Cakes', 20, ['German Cuisine']),
        related('Salads', 20, ['German Cuisine']),
      ],
      liveCounts: { 'Comfort Food': 4, Stews: 3, Breads: 1, Cakes: 2 },
    });

    await endpoint.execute(
      'alice',
      { ...query, name: 'German Cuisine' },
      'en-US',
      undefined,
      undefined,
    );

    expect(objectCategoriesRepo.countObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ scope, parentPath: ['German Cuisine'] }),
    );
    expect(objectCategoriesRepo.findObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ scope, parentPath: ['German Cuisine'] }),
    );
  });

  it('counts with the active filters in the same unit as without (live object_id count)', async () => {
    const { endpoint, objectCategoriesRepo } = createEndpoint({
      rows: ROOT_ROWS,
      liveCounts: { Desserts: 1, 'Comfort Food': 1, Soups: 0 },
    });

    const result = await endpoint.execute(
      'alice',
      { ...query, tags: ['Cuisine:asian'], rating: 8 },
      'en-US',
      undefined,
      undefined,
    );

    expect(result?.sections.map((s) => [s.categoryName, s.totalObjects])).toEqual([
      ['Desserts', 1],
      ['Comfort Food', 1],
    ]);
    expect(objectCategoriesRepo.countObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ category: 'Cuisine', value: 'asian' }], rating: 8 }),
    );
    expect(objectCategoriesRepo.findObjectIdsByScopeForCategories).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ category: 'Cuisine', value: 'asian' }], rating: 8 }),
    );
  });

  it('pages sections by category name cursor', async () => {
    const { endpoint } = createEndpoint({
      rows: ROOT_ROWS,
      liveCounts: { Desserts: 2, 'Comfort Food': 1, Soups: 5 },
    });

    const first = await endpoint.execute(
      'alice',
      { ...query, sectionLimit: 2 },
      'en-US',
      undefined,
      undefined,
    );
    const second = await endpoint.execute(
      'alice',
      { ...query, sectionLimit: 2, cursor: first?.cursor ?? undefined },
      'en-US',
      undefined,
      undefined,
    );

    expect(first).toEqual(expect.objectContaining({ cursor: 'Comfort Food', hasMore: true }));
    expect(second?.sections.map((s) => s.categoryName)).toEqual(['Soups']);
    expect(second?.hasMore).toBe(false);
  });

  it('returns empty response when section cursor is unknown', async () => {
    const { endpoint } = createEndpoint({ rows: ROOT_ROWS, liveCounts: { Desserts: 1 } });

    const result = await endpoint.execute(
      'alice',
      { ...query, cursor: 'missing-category' },
      'en-US',
      undefined,
      undefined,
    );

    expect(result).toEqual({ sections: [], cursor: null, hasMore: false });
  });

  it('returns no sections for a type without categories or several types', async () => {
    const { endpoint, resolver } = createEndpoint({ rows: ROOT_ROWS, liveCounts: {} });

    await expect(
      endpoint.execute('alice', { ...query, types: ['restaurant'] }, 'en-US', undefined, undefined),
    ).resolves.toEqual({ sections: [], cursor: null, hasMore: false });
    await expect(
      endpoint.execute('alice', { ...query, types: ['book', 'product'] }, 'en-US', undefined, undefined),
    ).resolves.toEqual({ sections: [], cursor: null, hasMore: false });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });
});
