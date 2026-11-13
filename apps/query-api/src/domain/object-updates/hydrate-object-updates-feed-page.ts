import type { ObjectViewService } from '@opden-data-layer/objects-domain';

import type {
  AggregatedObjectRepository,
  ObjectOwnershipRepository,
  UpdatesFeedJoinRow,
} from '../../repositories';
import { projectFeedObjectsById } from '../feed/project-feed-objects';
import type { ObjectProjectionService } from '../object-projection';
import type { ObjectUpdateFeedItemsBuilder } from './object-update-feed-items.builder';
import type { ObjectUpdateFeedItemDto } from './schemas/object-updates-feed.schema';
import type { FollowedObjectUpdateFeedItemDto } from './schemas/followed-objects-updates-feed.schema';

export type ObjectUpdatesFeedPageDeps = {
  objectOwnershipRepo: ObjectOwnershipRepository;
  itemsBuilder: ObjectUpdateFeedItemsBuilder;
  aggregatedObjectRepo: AggregatedObjectRepository;
  objectViewService: ObjectViewService;
  objectProjection: ObjectProjectionService;
};

export type ObjectUpdatesFeedPageContext = {
  locale: string;
  governance: Parameters<ObjectUpdateFeedItemsBuilder['buildForObject']>[2];
  governanceObjectIdFromHeader: string | undefined;
  viewerAccount: string | undefined;
};

export function groupJoinRowsByObjectId(
  rows: readonly UpdatesFeedJoinRow[],
): Map<string, UpdatesFeedJoinRow[]> {
  const byObject = new Map<string, UpdatesFeedJoinRow[]>();
  for (const jr of rows) {
    const list = byObject.get(jr.row.object_id);
    if (list) {
      list.push(jr);
    } else {
      byObject.set(jr.row.object_id, [jr]);
    }
  }
  return byObject;
}

/**
 * Feed items for a page of updates across many objects, in page order: approval / vote
 * fields per object plus a light projection of the updated object.
 */
export async function hydrateObjectUpdatesFeedPage(
  deps: ObjectUpdatesFeedPageDeps,
  pageRows: readonly UpdatesFeedJoinRow[],
  ctx: ObjectUpdatesFeedPageContext,
): Promise<FollowedObjectUpdateFeedItemDto[]> {
  const rowsByObject = groupJoinRowsByObjectId(pageRows);
  const objectIds = [...rowsByObject.keys()];

  const [dtoGroups, objectsById] = await Promise.all([
    Promise.all(
      objectIds.map(async (objectId) => {
        const ownerships = await deps.objectOwnershipRepo.findByObjectId(objectId);
        return deps.itemsBuilder.buildForObject(
          objectId,
          rowsByObject.get(objectId) ?? [],
          ctx.governance,
          ownerships,
          ctx.viewerAccount,
        );
      }),
    ),
    projectFeedObjectsById(
      {
        aggregatedObjectRepo: deps.aggregatedObjectRepo,
        objectViewService: deps.objectViewService,
        objectProjection: deps.objectProjection,
      },
      objectIds,
      {
        locale: ctx.locale,
        governance: ctx.governance,
        governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
        viewerAccount: ctx.viewerAccount,
      },
    ),
  ]);

  const dtoByUpdateId = new Map<string, ObjectUpdateFeedItemDto>(
    dtoGroups.flat().map((dto) => [dto.update_id, dto]),
  );
  return pageRows
    .map((jr) => dtoByUpdateId.get(jr.row.update_id))
    .filter((dto): dto is ObjectUpdateFeedItemDto => dto != null)
    .map((dto) => ({ ...dto, object: objectsById.get(dto.object_id) ?? null }));
}
