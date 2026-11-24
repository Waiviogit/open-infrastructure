import { Injectable } from '@nestjs/common';
import type { AggregatedObject } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository } from '../../repositories';
import { AffiliateLinksEnricher, flattenAffiliateTargets } from '../affiliate';
import { USER_FAVORITES_CARD_UPDATE_TYPES } from '../favorites/favorites.constants';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection/object-projection.service';
import type { ProjectedObject } from '../object-projection/projected-object.types';

/** Shop card fields plus geo for discover map markers. */
export const DISCOVER_OBJECT_UPDATE_TYPES = [
  ...USER_FAVORITES_CARD_UPDATE_TYPES,
  'geo',
  'title',
  'address',
] as const;

export interface DiscoverProjectionContext {
  locale: string;
  viewerAccount?: string;
  governanceObjectIdFromHeader?: string;
  countryCode?: string | null;
}

function orderAggregatedByIds(objects: AggregatedObject[], objectIds: string[]): AggregatedObject[] {
  const map = new Map(objects.map((o) => [o.core.object_id, o]));
  return objectIds.map((id) => map.get(id)).filter((x): x is AggregatedObject => x != null);
}

/**
 * Discover object cards from object ids (order kept): load aggregates, resolve views under the
 * merged governance, project, enrich affiliate links. Shared by the Discover feed and sections.
 */
@Injectable()
export class DiscoverObjectProjector {
  constructor(
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly objectProjectionService: ObjectProjectionService,
    private readonly affiliateLinks: AffiliateLinksEnricher,
  ) {}

  async project(objectIds: string[], ctx: DiscoverProjectionContext): Promise<ProjectedObject[]> {
    if (objectIds.length === 0) {
      return [];
    }
    const { objects, voterWaivPowers, rankVoteProjection } =
      await this.aggregatedObjectRepo.loadByObjectIds(objectIds, {
        viewerAccount: ctx.viewerAccount,
      });

    const ordered = orderAggregatedByIds(objects, objectIds);
    const governance = await this.governanceResolver.resolveMergedForObjectView(
      ctx.governanceObjectIdFromHeader,
    );

    const views = this.objectViewService.resolve(ordered, voterWaivPowers, {
      update_types: [...DISCOVER_OBJECT_UPDATE_TYPES],
      locale: ctx.locale,
      include_rejected: false,
      governance,
    });

    const projected = await this.objectProjectionService.batchProject(views, {
      locale: ctx.locale,
      includeSeo: false,
      governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
      viewerAccount: ctx.viewerAccount,
      rankVoteProjection,
    });

    await this.affiliateLinks.enrich(flattenAffiliateTargets(projected), {
      countryCode: ctx.countryCode ?? null,
      governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
      governance,
    });

    return projected;
  }
}
