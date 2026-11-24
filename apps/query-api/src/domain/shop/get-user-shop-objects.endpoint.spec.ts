import {
  decodeWeightObjectCursor,
  encodeWeightObjectCursor,
} from '../pagination/weight-object-cursor';
import type { ShopObjectsQuery } from './shop.schema';
import { GetUserShopObjectsEndpoint } from './get-user-shop-objects.endpoint';

const scope = {
  account: 'alice',
  types: ['recipe'],
  postLinkedTypes: ['recipe'],
  deselectObjectIds: [],
};

const baseQuery: ShopObjectsQuery = {
  types: ['recipe'],
  categoryPath: [],
  uncategorizedOnly: false,
  tags: [],
  limit: 20,
};

function createEndpoint(objectCategoriesRepo: unknown, otherExcluded: string[] = []) {
  const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
  const navigation = { visibleCategoryNames: jest.fn().mockResolvedValue(otherExcluded) };
  const endpoint = new GetUserShopObjectsEndpoint(
    resolver as never,
    navigation as never,
    objectCategoriesRepo as never,
    {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [{ core: { object_id: 'obj-1' } }, { core: { object_id: 'obj-2' } }],
        voterWaivPowers: {},
        rankVoteProjection: {},
      }),
    } as never,
    { resolve: jest.fn().mockReturnValue([{ object_id: 'obj-1' }, { object_id: 'obj-2' }]) } as never,
    {
      batchProject: jest.fn().mockResolvedValue([{ object_id: 'obj-1' }, { object_id: 'obj-2' }]),
    } as never,
    { enrich: jest.fn() } as never,
  );
  return { endpoint, resolver };
}

describe('GetUserShopObjectsEndpoint', () => {
  it('returns projected items and an opaque weight + object_id cursor of the last row', async () => {
    const objectCategoriesRepo = {
      findObjectIdsByScope: jest.fn().mockResolvedValue({
        rows: [
          { object_id: 'obj-1', weight: 10 },
          { object_id: 'obj-2', weight: 4.5 },
        ],
        hasMore: true,
      }),
    };
    const { endpoint, resolver } = createEndpoint(objectCategoriesRepo);

    const result = await endpoint.execute(
      'alice',
      { ...baseQuery, categoryPath: ['Desserts'], tags: ['Cuisine:asian'], rating: 8 },
      'en-US',
      undefined,
      undefined,
    );

    expect(result?.items).toEqual([{ object_id: 'obj-1' }, { object_id: 'obj-2' }]);
    expect(result?.hasMore).toBe(true);
    expect(decodeWeightObjectCursor(result?.cursor ?? '')).toEqual({
      weight: 4.5,
      object_id: 'obj-2',
    });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', ['recipe']);
    expect(objectCategoriesRepo.findObjectIdsByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        scope,
        categoryPath: ['Desserts'],
        cursor: null,
        tags: [{ category: 'Cuisine', value: 'asian' }],
        rating: 8,
      }),
    );
  });

  it('passes the decoded cursor to the keyset query and ends with a null cursor', async () => {
    const objectCategoriesRepo = {
      findObjectIdsByScope: jest.fn().mockResolvedValue({
        rows: [{ object_id: 'obj-1', weight: null }],
        hasMore: false,
      }),
    };
    const { endpoint } = createEndpoint(objectCategoriesRepo);

    const result = await endpoint.execute(
      'alice',
      { ...baseQuery, cursor: encodeWeightObjectCursor({ weight: 7, object_id: 'prev' }) },
      'en-US',
      undefined,
      undefined,
    );

    expect(result?.cursor).toBeNull();
    expect(objectCategoriesRepo.findObjectIdsByScope).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { weight: 7, object_id: 'prev' } }),
    );
  });

  it('returns empty page when no object ids match', async () => {
    const objectCategoriesRepo = {
      findObjectIdsByScope: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
    };
    const { endpoint } = createEndpoint(objectCategoriesRepo);

    const result = await endpoint.execute('alice', baseQuery, 'en-US', undefined, undefined);

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
  });

  it('returns null for blank username', async () => {
    const { endpoint } = createEndpoint({});
    expect(await endpoint.execute('  ', baseQuery, 'en-US', undefined, undefined)).toBeNull();
  });

  it('lists the Other category: the path minus the child categories the tree shows', async () => {
    const objectCategoriesRepo = {
      findObjectIdsByScope: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
    };
    const { endpoint } = createEndpoint(objectCategoriesRepo, ['Desserts', 'Soups']);

    await endpoint.execute(
      'alice',
      { ...baseQuery, categoryPath: ['Mains'], uncategorizedOnly: true, other: true },
      'en-US',
      undefined,
      undefined,
    );

    expect(objectCategoriesRepo.findObjectIdsByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryPath: ['Mains'],
        uncategorizedOnly: false,
        excludedCategoryNames: ['Desserts', 'Soups'],
      }),
    );
  });

  it('returns no Other for a scope that is not one category type', async () => {
    const objectCategoriesRepo = { findObjectIdsByScope: jest.fn() };
    const { endpoint, resolver } = createEndpoint(objectCategoriesRepo);
    resolver.resolve.mockResolvedValue({ ...scope, types: ['book', 'product'] });

    const result = await endpoint.execute(
      'alice',
      { ...baseQuery, types: ['book', 'product'], other: true },
      'en-US',
      undefined,
      undefined,
    );

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
    expect(objectCategoriesRepo.findObjectIdsByScope).not.toHaveBeenCalled();
  });
});
