import { MAP_GEO_OBJECT_TYPES } from '@opden-data-layer/core';
import type { UserFavoritesMapBody } from './post-user-favorites-map.schema';
import { PostUserFavoritesMapEndpoint, resolveMapObjectTypes } from './post-user-favorites-map.endpoint';

const scope = {
  account: 'alice',
  types: ['restaurant'],
  postLinkedTypes: ['restaurant'],
  deselectObjectIds: [],
};

describe('resolveMapObjectTypes', () => {
  it('defaults to every map type and drops non-map types', () => {
    expect(resolveMapObjectTypes(undefined)).toEqual([...MAP_GEO_OBJECT_TYPES]);
    expect(resolveMapObjectTypes(['restaurant', 'book'])).toEqual(['restaurant']);
  });
});

describe('PostUserFavoritesMapEndpoint', () => {
  const box: UserFavoritesMapBody['box'] = {
    topPoint: [-123, 49],
    bottomPoint: [-124, 48],
  };
  const body: UserFavoritesMapBody = { box, skip: 0, limit: 10 };

  it('returns null for blank username', async () => {
    const endpoint = new PostUserFavoritesMapEndpoint(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      endpoint.execute('  ', body, 'en-US', undefined, undefined),
    ).resolves.toBeNull();
  });

  it('returns empty when no map objects in bbox', async () => {
    const favoritesRepo = {
      findMapObjectIdsByScope: jest.fn().mockResolvedValue([]),
    };
    const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
    const endpoint = new PostUserFavoritesMapEndpoint(
      resolver as never,
      favoritesRepo as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(endpoint.execute('alice', body, 'en-US', undefined, undefined)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', [...MAP_GEO_OBJECT_TYPES]);
  });

  it('sets hasMore when repo returns limit+1 ids', async () => {
    const favoritesRepo = {
      findMapObjectIdsByScope: jest.fn().mockResolvedValue(['o1', 'o2', 'o3']),
    };
    const resolver = { resolve: jest.fn().mockResolvedValue(scope) };
    const aggregatedObjectRepo = {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [
          { core: { object_id: 'o1' } },
          { core: { object_id: 'o2' } },
        ],
        voterWaivPowers: new Map(),
        rankVoteProjection: undefined,
      }),
    };
    const objectViewService = {
      resolve: jest.fn().mockReturnValue([{ object_id: 'o1' }, { object_id: 'o2' }]),
    };
    const objectProjection = {
      batchProject: jest.fn().mockResolvedValue([{ object_id: 'o1' }, { object_id: 'o2' }]),
    };
    const endpoint = new PostUserFavoritesMapEndpoint(
      resolver as never,
      favoritesRepo as never,
      aggregatedObjectRepo as never,
      objectViewService as never,
      objectProjection as never,
    );

    const result = await endpoint.execute(
      'alice',
      { ...body, objectTypes: ['restaurant'], limit: 2 },
      'en-US',
      undefined,
      undefined,
    );

    expect(result).toEqual({
      items: [{ object_id: 'o1' }, { object_id: 'o2' }],
      hasMore: true,
    });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', ['restaurant']);
    expect(favoritesRepo.findMapObjectIdsByScope).toHaveBeenCalledWith(scope, box, 0, 3);
  });
});
