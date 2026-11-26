import { OBJECT_PAGE_VISIBLE_STATUSES } from '@opden-data-layer/core';
import type { ResolvedObjectView } from '@opden-data-layer/objects-domain';
import { DEFAULT_GOVERNANCE_SNAPSHOT, ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository } from '../../repositories';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection/object-projection.service';
import { emptyRankVoteProjection, type ProjectedObject } from '../object-projection/projected-object.types';
import { GetObjectHeadEndpoint, OBJECT_HEAD_UPDATE_TYPES } from './get-object-head.endpoint';

const VIEW: ResolvedObjectView = {
  object_id: 'hive',
  object_type: 'hashtag',
  creator: 'c',
  weight: 12.5,
  meta_group_id: null,
  status: 'unavailable',
  canonical: null,
  fields: {},
};

function projected(fields: Record<string, unknown>): ProjectedObject {
  return {
    object_id: 'hive',
    object_type: 'hashtag',
    semantic_type: null,
    status: 'unavailable',
    weight: 12.5,
    fields,
    isFavorited: false,
    hasSupervisedOwnership: false,
    hasExclusiveOwnership: false,
    hasOwnershipAuthority: false,
    previewGallery: [{ url: 'https://img/parent.png', rankScore: null, isAvatar: true }],
    galleryAlbums: [],
  };
}

function makeEndpoint(opts: { objects: unknown[]; views?: ResolvedObjectView[]; projected?: ProjectedObject }) {
  const repo = {
    loadByObjectIds: jest.fn().mockResolvedValue({
      objects: opts.objects,
      voterWaivPowers: new Map(),
      rankVoteProjection: emptyRankVoteProjection(),
    }),
  } as unknown as AggregatedObjectRepository;
  const viewService = {
    resolve: jest.fn().mockReturnValue(opts.views ?? [VIEW]),
  } as unknown as ObjectViewService;
  const governanceResolver = {
    resolveMergedForObjectView: jest.fn().mockResolvedValue(DEFAULT_GOVERNANCE_SNAPSHOT),
  } as unknown as GovernanceResolverService;
  const projectionService = {
    project: jest.fn().mockResolvedValue(opts.projected ?? projected({})),
  } as unknown as ObjectProjectionService;
  return {
    endpoint: new GetObjectHeadEndpoint(repo, viewService, governanceResolver, projectionService),
    repo,
    viewService,
    governanceResolver,
    projectionService,
  };
}

describe('GetObjectHeadEndpoint', () => {
  it('returns null for a missing object without resolving governance', async () => {
    const { endpoint, governanceResolver, projectionService } = makeEndpoint({ objects: [] });

    await expect(endpoint.execute({ objectId: 'missing', locale: 'en-US' })).resolves.toBeNull();
    expect(governanceResolver.resolveMergedForObjectView).not.toHaveBeenCalled();
    expect(projectionService.project).not.toHaveBeenCalled();
  });

  it('loads page-visible statuses without rank projection and resolves only hero update types', async () => {
    const { endpoint, repo, viewService } = makeEndpoint({ objects: [{ core: { object_id: 'hive' } }] });

    await endpoint.execute({ objectId: 'hive', locale: 'ko-KR', governanceObjectIdFromHeader: 'gov' });

    expect(repo.loadByObjectIds).toHaveBeenCalledWith(['hive'], {
      includeRankVoteProjection: false,
      statuses: OBJECT_PAGE_VISIBLE_STATUSES,
    });
    expect(viewService.resolve).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({
        update_types: [...OBJECT_HEAD_UPDATE_TYPES],
        locale: 'ko-KR',
        include_rejected: false,
      }),
    );
  });

  it('projects without a viewer and drops the parent ref used for the avatar fallback', async () => {
    const { endpoint, projectionService } = makeEndpoint({
      objects: [{ core: { object_id: 'hive' } }],
      projected: projected({
        name: 'Hive',
        image: 'https://img/parent.png',
        parent: { object_id: 'p1', fields: { image: 'https://img/parent.png' } },
      }),
    });

    const head = await endpoint.execute({ objectId: 'hive', locale: 'en-US' });

    expect(projectionService.project).toHaveBeenCalledWith(
      VIEW,
      expect.not.objectContaining({ viewerAccount: expect.anything(), includeSeo: true }),
    );
    expect(head).toEqual({
      object_id: 'hive',
      object_type: 'hashtag',
      semantic_type: null,
      status: 'unavailable',
      weight: 12.5,
      fields: { name: 'Hive', image: 'https://img/parent.png' },
      previewGallery: [{ url: 'https://img/parent.png', rankScore: null, isAvatar: true }],
      galleryAlbums: [],
    });
  });

  it('returns null when governance masking resolves no view', async () => {
    const { endpoint, projectionService } = makeEndpoint({
      objects: [{ core: { object_id: 'hive' } }],
      views: [],
    });

    await expect(endpoint.execute({ objectId: 'hive', locale: 'en-US' })).resolves.toBeNull();
    expect(projectionService.project).not.toHaveBeenCalled();
  });
});
