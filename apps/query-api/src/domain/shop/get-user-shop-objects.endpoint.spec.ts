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

function createEndpoint(objectCategoriesRepo: unknown) {
  const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
  const endpoint = new GetUserShopObjectsEndpoint(
    resolver as never,
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
});
