import type { GovernanceSnapshot, ObjectViewService } from '@opden-data-layer/objects-domain';

import type { AggregatedObjectRepository } from '../../repositories';
import type { ObjectProjectionService } from '../object-projection';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import { FEED_OBJECT_UPDATE_TYPES } from './feed.constants';

export type ProjectFeedObjectsDeps = {
  aggregatedObjectRepo: AggregatedObjectRepository;
  objectViewService: ObjectViewService;
  objectProjection: ObjectProjectionService;
};

export type ProjectFeedObjectsOptions = {
  locale: string;
  governance: GovernanceSnapshot;
  governanceObjectIdFromHeader: string | undefined;
  viewerAccount: string | undefined;
};

/**
 * Light object projection for feed cards (name, avatar, parent), keyed by object id.
 * Same resolution as object chips on post feed items.
 */
export async function projectFeedObjectsById(
  deps: ProjectFeedObjectsDeps,
  objectIds: readonly string[],
  options: ProjectFeedObjectsOptions,
): Promise<Map<string, ProjectedObject>> {
  const uniqueIds = [...new Set(objectIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { objects, voterWaivPowers, rankVoteProjection } =
    await deps.aggregatedObjectRepo.loadByObjectIds(uniqueIds, {
      viewerAccount: options.viewerAccount,
    });
  if (objects.length === 0) {
    return new Map();
  }

  const views = deps.objectViewService.resolve(objects, voterWaivPowers, {
    update_types: [...FEED_OBJECT_UPDATE_TYPES],
    locale: options.locale,
    include_rejected: false,
    governance: options.governance,
  });
  const projected = await deps.objectProjection.batchProject(views, {
    locale: options.locale,
    governanceObjectIdFromHeader: options.governanceObjectIdFromHeader,
    viewerAccount: options.viewerAccount,
    rankVoteProjection,
    governance: options.governance,
  });

  return new Map(projected.map((p) => [p.object_id, p]));
}
