import { Injectable } from '@nestjs/common';
import { UPDATE_TYPES, type SupportedCurrency } from '@opden-data-layer/core';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository, ObjectsCoreRepository } from '../../repositories';
import { GovernanceResolverService } from '../governance';
import type { ObjectFeaturedPostResponse } from './feed-story-dtos';
import { GetPostByKeyEndpoint } from './get-post-by-key.endpoint';
import { selectObjectFeaturedPostRef } from './object-feed-pins';

const FEATURED_POST_UPDATE_TYPES = [UPDATE_TYPES.PIN, UPDATE_TYPES.REMOVE] as const;

/**
 * Featured post of an object: its top pinned post, returned in full (single-post shape).
 * @see docs/apps/query-api/spec/object-featured-post.md
 */
@Injectable()
export class GetObjectFeaturedPostEndpoint {
  constructor(
    private readonly objectsCoreRepo: ObjectsCoreRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly getPostByKey: GetPostByKeyEndpoint,
  ) {}

  /** Null when the object does not exist; `{ post: null }` when it has no featured post. */
  async execute(params: {
    objectId: string;
    locale: string;
    governanceObjectIdFromHeader?: string;
    viewerAccount?: string;
    currency: SupportedCurrency;
    countryCode: string | null;
  }): Promise<ObjectFeaturedPostResponse | null> {
    const objectId = params.objectId.trim();
    if (!objectId) {
      return null;
    }
    const core = await this.objectsCoreRepo.findByObjectIdForPage(objectId);
    if (!core) {
      return null;
    }

    const [{ objects, voterWaivPowers }, governance] = await Promise.all([
      this.aggregatedObjectRepo.loadByObjectIds([objectId], { includeRankVoteProjection: false }),
      this.governanceResolver.resolveMergedForObjectView(params.governanceObjectIdFromHeader),
    ]);
    if (objects.length === 0) {
      return null;
    }

    const [view] = this.objectViewService.resolve(objects, voterWaivPowers, {
      update_types: [...FEATURED_POST_UPDATE_TYPES],
      locale: params.locale,
      include_rejected: false,
      governance,
    });
    const ref = view ? selectObjectFeaturedPostRef(view) : null;
    if (!ref) {
      return { post: null };
    }

    const post = await this.getPostByKey.execute(
      ref.author,
      ref.permlink,
      params.locale,
      params.governanceObjectIdFromHeader,
      params.viewerAccount,
      params.currency,
      params.countryCode,
    );
    return { post };
  }
}
