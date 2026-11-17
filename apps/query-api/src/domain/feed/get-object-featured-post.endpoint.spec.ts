import { UPDATE_TYPES } from '@opden-data-layer/core';
import type { ResolvedObjectView, ResolvedUpdate } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import { AggregatedObjectRepository } from '../../repositories/aggregated-object.repository';
import { ObjectsCoreRepository } from '../../repositories/objects-core.repository';
import { GovernanceResolverService } from '../governance';
import type { SinglePostViewDto } from './feed-story-dtos';
import { GetObjectFeaturedPostEndpoint } from './get-object-featured-post.endpoint';
import { GetPostByKeyEndpoint } from './get-post-by-key.endpoint';

function pinUpdate(
  id: string,
  ref: string,
  opts: { viewerCreated?: boolean; admin?: boolean } = {},
): ResolvedUpdate {
  return {
    update_id: id,
    update_type: UPDATE_TYPES.PIN,
    creator: opts.viewerCreated ? 'viewer' : 'someone',
    locale: null,
    created_at_unix: 1,
    event_seq: BigInt(id === 'p2' ? 2 : 1),
    value_text: ref,
    value_geo: null,
    value_json: null,
    validity_status: 'VALID',
    validity_tier: opts.admin ? 'admin' : 'baseline',
    decisive_vote_event_seq: null,
    approve_percent: 100,
    field_weight: null,
    rank_score: null,
    rank_context: null,
    rank_decisive_event_seq: null,
  };
}

function recipeView(pins: ResolvedUpdate[]): ResolvedObjectView {
  return {
    object_id: 'tom-yum',
    object_type: 'recipe',
    creator: 'alice',
    weight: 0,
    meta_group_id: null,
    status: 'active',
    canonical: null,
    fields: {
      [UPDATE_TYPES.PIN]: { update_type: UPDATE_TYPES.PIN, cardinality: 'multi', values: pins },
    },
  };
}

describe('GetObjectFeaturedPostEndpoint', () => {
  let objectsCoreRepo: jest.Mocked<Pick<ObjectsCoreRepository, 'findByObjectIdForPage'>>;
  let aggregatedObjectRepo: jest.Mocked<Pick<AggregatedObjectRepository, 'loadByObjectIds'>>;
  let objectViewService: jest.Mocked<Pick<ObjectViewService, 'resolve'>>;
  let getPostByKey: jest.Mocked<Pick<GetPostByKeyEndpoint, 'execute'>>;
  let endpoint: GetObjectFeaturedPostEndpoint;

  const params = {
    objectId: 'tom-yum',
    locale: 'en-US',
    viewerAccount: 'viewer',
    currency: 'USD' as const,
    countryCode: null,
  };

  beforeEach(() => {
    objectsCoreRepo = {
      findByObjectIdForPage: jest.fn().mockResolvedValue({ object_id: 'tom-yum' }),
    };
    aggregatedObjectRepo = {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [{ object_id: 'tom-yum' }],
        voterWaivPowers: new Map(),
      }),
    };
    objectViewService = { resolve: jest.fn().mockReturnValue([recipeView([])]) };
    getPostByKey = {
      execute: jest.fn().mockResolvedValue({ author: 'foodster', permlink: 'tom-yum' }),
    };
    endpoint = new GetObjectFeaturedPostEndpoint(
      objectsCoreRepo as unknown as ObjectsCoreRepository,
      aggregatedObjectRepo as unknown as AggregatedObjectRepository,
      objectViewService as unknown as ObjectViewService,
      { resolveMergedForObjectView: jest.fn().mockResolvedValue({}) } as unknown as GovernanceResolverService,
      getPostByKey as unknown as GetPostByKeyEndpoint,
    );
  });

  it('returns null for an unknown object', async () => {
    objectsCoreRepo.findByObjectIdForPage.mockResolvedValue(null as never);

    await expect(endpoint.execute(params)).resolves.toBeNull();
  });

  it('returns no post when nothing is pinned', async () => {
    await expect(endpoint.execute(params)).resolves.toEqual({ post: null });
    expect(getPostByKey.execute).not.toHaveBeenCalled();
  });

  it("loads the global top pin in full, ignoring the viewer's own pin", async () => {
    objectViewService.resolve.mockReturnValue([
      recipeView([
        pinUpdate('p1', 'foodster/tom-yum', { admin: true }),
        pinUpdate('p2', 'viewer/my-soup', { viewerCreated: true }),
      ]),
    ]);
    const post = { author: 'foodster', permlink: 'tom-yum' } as SinglePostViewDto;
    getPostByKey.execute.mockResolvedValue(post);

    await expect(endpoint.execute(params)).resolves.toEqual({ post });
    expect(getPostByKey.execute).toHaveBeenCalledWith(
      'foodster',
      'tom-yum',
      'en-US',
      undefined,
      'viewer',
      'USD',
      null,
    );
  });
});
