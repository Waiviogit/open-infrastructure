import type { ResolvedObjectView } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import type { ObjectsCore } from '@opden-data-layer/odl-db-types';
import {
  AggregatedObjectRepository,
  UserFavoritesRepository,
  type UserFavoritesScope,
} from '../../repositories';
import type { ProjectedObject } from '../object-projection';
import { ObjectProjectionService } from '../object-projection';
import { emptyRankVoteProjection } from '../object-projection/projected-object.types';
import { GetUserFavoritesEndpoint } from './get-user-favorites.endpoint';
import type { UserFavoritesQuery } from './favorites.schema';
import type { UserFavoritesScopeResolver } from './user-favorites-scope.resolver';

function scopeFor(types: string[]): UserFavoritesScope {
  return { account: 'alice', types, postLinkedTypes: types, deselectObjectIds: [] };
}

function resolverReturning(types: string[]) {
  return {
    resolve: jest.fn().mockResolvedValue(scopeFor(types)),
  } as unknown as UserFavoritesScopeResolver & { resolve: jest.Mock };
}

describe('GetUserFavoritesEndpoint', () => {
  const query: UserFavoritesQuery = { skip: 0, limit: 10 };

  it('returns null for empty username', async () => {
    const endpoint = new GetUserFavoritesEndpoint(
      {} as UserFavoritesScopeResolver,
      {} as UserFavoritesRepository,
      {} as AggregatedObjectRepository,
      {} as ObjectViewService,
      {} as ObjectProjectionService,
      { enrich: jest.fn() } as never,
    );
    await expect(endpoint.execute('  ', query, 'en-US', undefined, undefined)).resolves.toBeNull();
  });

  it('returns an empty page without querying when objectType is outside the whitelist', async () => {
    const resolver = resolverReturning([]);
    const favoritesRepo = {
      countByScope: jest.fn(),
      findObjectIdsByScope: jest.fn(),
    } as unknown as UserFavoritesRepository;
    const endpoint = new GetUserFavoritesEndpoint(
      resolver,
      favoritesRepo,
      {} as AggregatedObjectRepository,
      {} as ObjectViewService,
      {} as ObjectProjectionService,
      { enrich: jest.fn() } as never,
    );

    await expect(
      endpoint.execute('alice', { ...query, objectType: 'hashtag' }, 'en-US', undefined, undefined),
    ).resolves.toEqual({ items: [], total: 0, hasMore: false });
    expect(resolver.resolve).toHaveBeenCalledWith('alice', ['hashtag']);
    expect(favoritesRepo.countByScope).not.toHaveBeenCalled();
  });

  it('scopes to the requested objectType and every type when omitted', async () => {
    const resolver = resolverReturning(['hotel']);
    const favoritesRepo = {
      countByScope: jest.fn().mockResolvedValue(0),
      findObjectIdsByScope: jest.fn().mockResolvedValue([]),
    } as unknown as UserFavoritesRepository;
    const endpoint = new GetUserFavoritesEndpoint(
      resolver,
      favoritesRepo,
      {} as AggregatedObjectRepository,
      {} as ObjectViewService,
      {} as ObjectProjectionService,
      { enrich: jest.fn() } as never,
    );

    await expect(
      endpoint.execute('alice', { ...query, objectType: 'hotel' }, 'en-US', undefined, undefined),
    ).resolves.toEqual({ items: [], total: 0, hasMore: false });
    await endpoint.execute('alice', query, 'en-US', undefined, undefined);

    expect(resolver.resolve).toHaveBeenNthCalledWith(1, 'alice', ['hotel']);
    expect(resolver.resolve).toHaveBeenNthCalledWith(2, 'alice', undefined);
    expect(favoritesRepo.findObjectIdsByScope).toHaveBeenCalledWith(scopeFor(['hotel']), 0, 10);
  });

  it('returns projected favorites', async () => {
    const favoritesRepo = {
      countByScope: jest.fn().mockResolvedValue(1),
      findObjectIdsByScope: jest.fn().mockResolvedValue(['o1']),
    } as unknown as UserFavoritesRepository;

    const mockView: ResolvedObjectView = {
      object_id: 'o1',
      object_type: 'restaurant',
      creator: 'c',
      weight: 5,
      meta_group_id: null,
      status: 'active',
      canonical: null,
      fields: {},
    };
    const core: ObjectsCore = {
      object_id: 'o1',
      object_type: 'restaurant',
      creator: 'c',
      weight: 5,
      meta_group_id: null,
      canonical: null,
      canonical_creator: null,
      transaction_id: 'tx',
      status: 'active',
      seq: 0,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    };
    const aggregatedObjectRepo = {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [{ core, updates: [], validity_votes: [], favorites: [], ownerships: [] }],
        voterWaivPowers: new Map(),
        rankVoteProjection: emptyRankVoteProjection(),
      }),
    } as unknown as AggregatedObjectRepository;
    const objectViewService = {
      resolve: jest.fn().mockReturnValue([mockView]),
    } as unknown as ObjectViewService;
    const projected: ProjectedObject = {
      object_id: 'o1',
      object_type: 'restaurant',
      semantic_type: null,
      status: 'active',
      weight: 5,
      fields: { name: 'Cafe' },
      isFavorited: true,
      hasSupervisedOwnership: false,
      hasExclusiveOwnership: false,
      hasOwnershipAuthority: false,
    };
    const objectProjection = {
      batchProject: jest.fn().mockResolvedValue([projected]),
    } as unknown as ObjectProjectionService;

    const endpoint = new GetUserFavoritesEndpoint(
      resolverReturning(['restaurant']),
      favoritesRepo,
      aggregatedObjectRepo,
      objectViewService,
      objectProjection,
      { enrich: jest.fn() } as never,
    );

    await expect(
      endpoint.execute('alice', { ...query, objectType: 'restaurant' }, 'en-US', undefined, undefined),
    ).resolves.toEqual({ items: [projected], total: 1, hasMore: false });
  });
});
