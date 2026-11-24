import { DiscoverObjectProjector } from './discover-object-projector';
import { GetDiscoverObjectsEndpoint, parseTagFilters } from './get-discover-objects.endpoint';
import type { DiscoverRepository } from '../../repositories/discover.repository';
import type { AggregatedObjectRepository } from '../../repositories/aggregated-object.repository';
import type { ObjectViewService } from '@opden-data-layer/objects-domain';
import type { GovernanceResolverService } from '../governance/governance-resolver.service';
import type { ObjectProjectionService } from '../object-projection/object-projection.service';
import { USER_FAVORITES_CARD_UPDATE_TYPES } from '../favorites/favorites.constants';

describe('parseTagFilters', () => {
  it('parses category:value and skips legacy value-only', () => {
    expect(parseTagFilters(['Cuisine:asian', 'asian', 'Meal Type:breakfast'])).toEqual([
      { category: 'Cuisine', value: 'asian' },
      { category: 'Meal Type', value: 'breakfast' },
    ]);
  });
});

describe('GetDiscoverObjectsEndpoint', () => {
  it('returns empty list when repository has no rows', async () => {
    const discoverRepo = {
      listObjects: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
      buildObjectCursor: jest.fn(),
    } as unknown as DiscoverRepository;

    const endpoint = new GetDiscoverObjectsEndpoint(
      discoverRepo,
      new DiscoverObjectProjector(
        {} as AggregatedObjectRepository,
        {} as ObjectViewService,
        {} as GovernanceResolverService,
        {} as ObjectProjectionService,
        { enrich: jest.fn() } as never,
      ),
      { visibleCategoryNames: jest.fn().mockResolvedValue([]) } as never,
    );

    const result = await endpoint.execute({
      query: { category_path: [], tags: [], sort: 'newest', limit: 20 },
      locale: 'en-US',
    });

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
    expect(discoverRepo.listObjects).toHaveBeenCalled();
  });

  it('passes parsed category:value tags to repository', async () => {
    const discoverRepo = {
      listObjects: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
      buildObjectCursor: jest.fn(),
    } as unknown as DiscoverRepository;

    const endpoint = new GetDiscoverObjectsEndpoint(
      discoverRepo,
      new DiscoverObjectProjector(
        {} as AggregatedObjectRepository,
        {} as ObjectViewService,
        {} as GovernanceResolverService,
        {} as ObjectProjectionService,
        { enrich: jest.fn() } as never,
      ),
      { visibleCategoryNames: jest.fn().mockResolvedValue([]) } as never,
    );

    await endpoint.execute({
      query: { category_path: [], tags: ['Cuisine:asian'], sort: 'newest', limit: 20 },
      locale: 'en-US',
    });

    expect(discoverRepo.listObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ category: 'Cuisine', value: 'asian' }],
      }),
    );
  });

  it('resolves objects with shop card fields and geo for map markers', async () => {
    const discoverRepo = {
      listObjects: jest.fn().mockResolvedValue({
        rows: [
          {
            object_id: 'obj-1',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            weight: 1,
          },
        ],
        hasMore: false,
      }),
      buildObjectCursor: jest.fn(),
    } as unknown as DiscoverRepository;

    const aggregatedObjectRepo = {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [{ core: { object_id: 'obj-1' } }],
        voterWaivPowers: new Map(),
        rankVoteProjection: {},
      }),
    } as unknown as AggregatedObjectRepository;

    const resolve = jest.fn().mockReturnValue([]);
    const objectViewService = { resolve } as unknown as ObjectViewService;

    const governanceResolver = {
      resolveMergedForObjectView: jest.fn().mockResolvedValue(undefined),
    } as unknown as GovernanceResolverService;

    const objectProjectionService = {
      batchProject: jest.fn().mockResolvedValue([]),
    } as unknown as ObjectProjectionService;

    const endpoint = new GetDiscoverObjectsEndpoint(
      discoverRepo,
      new DiscoverObjectProjector(
        aggregatedObjectRepo,
        objectViewService,
        governanceResolver,
        objectProjectionService,
        { enrich: jest.fn() } as never,
      ),
      { visibleCategoryNames: jest.fn().mockResolvedValue([]) } as never,
    );

    await endpoint.execute({
      query: { category_path: [], object_type: 'restaurant', tags: [], sort: 'rank', limit: 20 },
      locale: 'en-US',
    });

    expect(resolve).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({
        update_types: expect.arrayContaining([...USER_FAVORITES_CARD_UPDATE_TYPES, 'geo']),
      }),
    );
  });

  it('lists the Other category of the lineage with the same filters as the category tree', async () => {
    const discoverRepo = {
      listObjects: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
      buildObjectCursor: jest.fn(),
    } as unknown as DiscoverRepository;
    const navigation = { visibleCategoryNames: jest.fn().mockResolvedValue(['Audio']) };
    const endpoint = new GetDiscoverObjectsEndpoint(
      discoverRepo,
      {} as DiscoverObjectProjector,
      navigation as never,
    );

    await endpoint.execute({
      query: {
        object_type: 'product',
        category_path: ['Electronics'],
        tags: ['Brand:Sony'],
        q: ' tv ',
        other: true,
        sort: 'rank',
        limit: 20,
      },
      locale: 'en-US',
    });

    expect(navigation.visibleCategoryNames).toHaveBeenCalledWith({
      scope: {
        kind: 'type',
        objectType: 'product',
        q: 'tv',
        tags: [{ category: 'Brand', value: 'Sony' }],
        box: null,
      },
      objectType: 'product',
      lineage: ['Electronics'],
    });
    expect(discoverRepo.listObjects).toHaveBeenCalledWith(
      expect.objectContaining({ categoryPath: ['Electronics'], excludedCategoryNames: ['Audio'] }),
    );
  });

  it('returns nothing for Other of a type without a category tree', async () => {
    const discoverRepo = { listObjects: jest.fn() } as unknown as DiscoverRepository;
    const endpoint = new GetDiscoverObjectsEndpoint(
      discoverRepo,
      {} as DiscoverObjectProjector,
      { visibleCategoryNames: jest.fn() } as never,
    );

    const result = await endpoint.execute({
      query: { object_type: 'restaurant', category_path: [], tags: [], other: true, sort: 'rank', limit: 20 },
      locale: 'en-US',
    });

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
    expect(discoverRepo.listObjects).not.toHaveBeenCalled();
  });
});
