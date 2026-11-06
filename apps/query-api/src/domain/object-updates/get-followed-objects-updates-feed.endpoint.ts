import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import {
  AccountsCurrentRepository,
  AggregatedObjectRepository,
  ObjectOwnershipRepository,
  UpdatesFeedRepository,
  type UpdatesFeedJoinRow,
} from '../../repositories';
import { projectFeedObjectsById } from '../feed/project-feed-objects';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import { ObjectUpdateFeedItemsBuilder } from './object-update-feed-items.builder';
import type { ObjectUpdateFeedItemDto } from './schemas/object-updates-feed.schema';
import type {
  FollowedObjectsUpdatesFeedBody,
  FollowedObjectsUpdatesFeedResponseDto,
} from './schemas/followed-objects-updates-feed.schema';
import { decodeUpdatesCursor, encodeUpdatesCursor } from './updates-cursor';

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

function nextRecencyCursor(pageRows: readonly UpdatesFeedJoinRow[]): string | null {
  const last = pageRows[pageRows.length - 1];
  if (!last) {
    return null;
  }
  const createdAt = Number(last.row.created_at_unix);
  if (!Number.isFinite(createdAt) || last.row.update_id.length === 0) {
    return null;
  }
  return encodeUpdatesCursor({
    kind: 'recency',
    created_at_unix: Math.trunc(createdAt),
    update_id: last.row.update_id,
  });
}

/**
 * Hub "Updates" tab: updates of every active object the account follows, newest first.
 */
@Injectable()
export class GetFollowedObjectsUpdatesFeedEndpoint {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly updatesFeedRepo: UpdatesFeedRepository,
    private readonly objectOwnershipRepo: ObjectOwnershipRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly itemsBuilder: ObjectUpdateFeedItemsBuilder,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
  ) {}

  async execute(
    username: string,
    body: FollowedObjectsUpdatesFeedBody,
    locale: string,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<FollowedObjectsUpdatesFeedResponseDto | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }
    const account = await this.accounts.findByName(name);
    if (!account) {
      return null;
    }

    const decoded = body.cursor ? decodeUpdatesCursor(body.cursor) : null;
    if (body.cursor && decoded?.kind !== 'recency') {
      return { items: [], cursor: null, hasMore: false };
    }

    const limit = body.limit;
    const rows = await this.updatesFeedRepo.findFollowedObjectsRecencyPage({
      account: name,
      limit: limit + 1,
      cursorCreatedAt: decoded?.kind === 'recency' ? decoded.created_at_unix : undefined,
      cursorUpdateId: decoded?.kind === 'recency' ? decoded.update_id : undefined,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    if (pageRows.length === 0) {
      return { items: [], cursor: null, hasMore: false };
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      governanceObjectIdFromHeader,
    );
    const rowsByObject = groupJoinRowsByObjectId(pageRows);
    const objectIds = [...rowsByObject.keys()];

    const [dtoGroups, objectsById] = await Promise.all([
      Promise.all(
        objectIds.map(async (objectId) => {
          const ownerships = await this.objectOwnershipRepo.findByObjectId(objectId);
          return this.itemsBuilder.buildForObject(
            objectId,
            rowsByObject.get(objectId) ?? [],
            governance,
            ownerships,
            viewerAccount,
          );
        }),
      ),
      projectFeedObjectsById(
        {
          aggregatedObjectRepo: this.aggregatedObjectRepo,
          objectViewService: this.objectViewService,
          objectProjection: this.objectProjection,
        },
        objectIds,
        { locale, governance, governanceObjectIdFromHeader, viewerAccount },
      ),
    ]);

    const dtoByUpdateId = new Map<string, ObjectUpdateFeedItemDto>(
      dtoGroups.flat().map((dto) => [dto.update_id, dto]),
    );
    const items = pageRows
      .map((jr) => dtoByUpdateId.get(jr.row.update_id))
      .filter((dto): dto is ObjectUpdateFeedItemDto => dto != null)
      .map((dto) => ({ ...dto, object: objectsById.get(dto.object_id) ?? null }));

    const nextCursor = hasMore ? nextRecencyCursor(pageRows) : null;
    return {
      items,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    };
  }
}
