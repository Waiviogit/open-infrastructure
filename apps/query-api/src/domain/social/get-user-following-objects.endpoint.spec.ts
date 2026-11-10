import type { ResolvedObjectView } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import type { ObjectsCore } from '@opden-data-layer/odl-db-types';
import {
  AccountsCurrentRepository,
  AggregatedObjectRepository,
  UserObjectFollowsRepository,
} from '../../repositories';
import type { ProjectedObject } from '../object-projection';
import { ObjectProjectionService } from '../object-projection';
import { emptyRankVoteProjection } from '../object-projection/projected-object.types';
import type { UserFollowingObjectsQuery } from './user-social-list.schema';
import { GetUserFollowingObjectsEndpoint } from './get-user-following-objects.endpoint';

describe('GetUserFollowingObjectsEndpoint', () => {
  const query: UserFollowingObjectsQuery = { sort: 'weight', skip: 0, limit: 10 };

  it('returns null when profile missing', async () => {
    const accounts = { findByName: jest.fn().mockResolvedValue(null) } as unknown as AccountsCurrentRepository;
    const deps = stubDeps();

    const endpoint = new GetUserFollowingObjectsEndpoint(
      accounts,
      deps.objectFollows,
      deps.aggregatedObjectRepo,
      deps.objectViewService,
      deps.objectProjection,
    );

    await expect(endpoint.execute('x', query, 'en-US', undefined, undefined)).resolves.toBeNull();
  });

  it('returns projected objects with merged weight', async () => {
    const { endpoint, objectProjection } = buildEndpoint();

    const result = await endpoint.execute('alice', query, 'en-US', undefined, undefined);

    expect(result?.total).toBe(1);
    expect(result?.items[0]?.weight).toBe(99);
    expect(objectProjection.batchProject).toHaveBeenCalled();
  });

  it('marks rows as not followed for a guest', async () => {
    const { endpoint, objectFollows } = buildEndpoint();

    const result = await endpoint.execute('alice', query, 'en-US', undefined, undefined);

    expect(result?.items[0]?.isCurrentFollowing).toBe(false);
    expect(objectFollows.findFollowedActiveObjectIdsAmong).not.toHaveBeenCalled();
  });

  it('marks every row as followed when the viewer is the profile owner', async () => {
    const { endpoint, objectFollows } = buildEndpoint();

    const result = await endpoint.execute('alice', query, 'en-US', undefined, 'Alice');

    expect(result?.items[0]?.isCurrentFollowing).toBe(true);
    expect(objectFollows.findFollowedActiveObjectIdsAmong).not.toHaveBeenCalled();
  });

  it('uses the viewer follows, not the profile owner follows, for another viewer', async () => {
    const { endpoint, objectFollows } = buildEndpoint({ projectedIds: ['o1', 'o2'], viewerFollows: ['o2'] });

    const result = await endpoint.execute('alice', query, 'en-US', undefined, 'bob');

    expect(objectFollows.findFollowedActiveObjectIdsAmong).toHaveBeenCalledWith('bob', ['o1', 'o2']);
    expect(result?.items.map((i) => [i.object_id, i.isCurrentFollowing])).toEqual([
      ['o1', false],
      ['o2', true],
    ]);
  });
});

function buildEndpoint(options: { projectedIds?: string[]; viewerFollows?: string[] } = {}) {
  const ids = options.projectedIds ?? ['o1'];

  const accounts = {
    findByName: jest.fn().mockResolvedValue({ name: 'alice' }),
  } as unknown as AccountsCurrentRepository;

  const objectFollows = {
    countByAccount: jest.fn().mockResolvedValue(ids.length),
    findObjectsByAccount: jest
      .fn()
      .mockResolvedValue(ids.map((object_id) => ({ object_id, weight: 99 }))),
    findFollowedActiveObjectIdsAmong: jest.fn().mockResolvedValue(options.viewerFollows ?? []),
  };

  const views: ResolvedObjectView[] = ids.map((object_id) => ({
    object_id,
    object_type: 'restaurant',
    creator: 'c',
    weight: 5,
    meta_group_id: null,
    status: 'active',
    canonical: null,
    fields: {},
  }));

  const cores: ObjectsCore[] = ids.map((object_id) => ({
    object_id,
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
  }));

  const aggregatedObjectRepo = {
    loadByObjectIds: jest.fn().mockResolvedValue({
      objects: cores.map((core) => ({ core, updates: [], validity_votes: [], favorites: [], ownerships: [] })),
      voterWaivPowers: new Map(),
      rankVoteProjection: emptyRankVoteProjection(),
    }),
  } as unknown as AggregatedObjectRepository;

  const objectViewService = {
    resolve: jest.fn().mockReturnValue(views),
  } as unknown as ObjectViewService;

  const projected: ProjectedObject[] = ids.map((object_id) => ({
    object_id,
    object_type: 'restaurant',
    semantic_type: null,
    status: 'active',
    weight: 5,
    fields: {},
    isFavorited: false,
    hasSupervisedOwnership: false,
    hasExclusiveOwnership: false,
    hasOwnershipAuthority: false,
  }));

  const objectProjection = {
    batchProject: jest.fn().mockResolvedValue(projected),
  };

  const endpoint = new GetUserFollowingObjectsEndpoint(
    accounts,
    objectFollows as unknown as UserObjectFollowsRepository,
    aggregatedObjectRepo,
    objectViewService,
    objectProjection as unknown as ObjectProjectionService,
  );

  return { endpoint, objectFollows, objectProjection };
}

function stubDeps(): {
  objectFollows: UserObjectFollowsRepository;
  aggregatedObjectRepo: AggregatedObjectRepository;
  objectViewService: ObjectViewService;
  objectProjection: ObjectProjectionService;
} {
  return {
    objectFollows: {} as UserObjectFollowsRepository,
    aggregatedObjectRepo: {} as AggregatedObjectRepository,
    objectViewService: {} as ObjectViewService,
    objectProjection: {} as ObjectProjectionService,
  };
}
