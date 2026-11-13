import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import {
  AggregatedObjectRepository,
  HubUpdatesFeedRepository,
  ObjectOwnershipRepository,
  UserAccountMutesRepository,
  type UpdatesFeedJoinRow,
} from '../../repositories';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import { hydrateObjectUpdatesFeedPage } from '../object-updates/hydrate-object-updates-feed-page';
import { ObjectUpdateFeedItemsBuilder } from '../object-updates/object-update-feed-items.builder';
import type { FollowedObjectsUpdatesFeedResponseDto } from '../object-updates/schemas/followed-objects-updates-feed.schema';
import {
  decodeHubFeedCursor,
  encodeHubFeedCursor,
  hubUpdateRankCursorSchema,
  hubUpdateTimeCursorSchema,
} from './hub-feed-cursor';
import { assertNeverHubFeedFilter, hubFeedFilterKey } from './hub-feed-filter';
import { hubFeedWindowStart, nowUnixSec } from './hub-feed-window';
import { HubFeedViewerRequiredError } from './hub-feed-viewer-required.error';
import { resolveHubFeedExcludedAuthors } from './resolve-hub-feed-excluded-authors';
import type { HubUpdatesFeedBody } from './schemas/hub-feed.schema';

const EMPTY_PAGE: FollowedObjectsUpdatesFeedResponseDto = { items: [], cursor: null, hasMore: false };

type LoadedPage = { rows: UpdatesFeedJoinRow[]; cursorOf: (last: UpdatesFeedJoinRow) => unknown } | null;

function timePosition(last: UpdatesFeedJoinRow) {
  return { createdAtUnix: Math.trunc(Number(last.row.created_at_unix)), updateId: last.row.update_id };
}

/**
 * Hub "Updates" tab for one rail filter: updates of active objects, each with
 * approval / vote fields and the updated object.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class GetHubUpdatesFeedEndpoint {
  constructor(
    private readonly hubUpdatesRepo: HubUpdatesFeedRepository,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
    private readonly objectOwnershipRepo: ObjectOwnershipRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly itemsBuilder: ObjectUpdateFeedItemsBuilder,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
  ) {}

  async execute(
    body: HubUpdatesFeedBody,
    locale: string,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<FollowedObjectsUpdatesFeedResponseDto> {
    const viewer = viewerAccount?.trim() ?? '';
    if (body.filter.kind === 'my' && viewer.length === 0) {
      throw new HubFeedViewerRequiredError();
    }

    const loaded = await this.loadRows(body, viewer);
    if (!loaded) {
      return EMPTY_PAGE;
    }
    const hasMore = loaded.rows.length > body.limit;
    const pageRows = hasMore ? loaded.rows.slice(0, body.limit) : loaded.rows;
    if (pageRows.length === 0) {
      return EMPTY_PAGE;
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      governanceObjectIdFromHeader,
    );
    const items = await hydrateObjectUpdatesFeedPage(
      {
        objectOwnershipRepo: this.objectOwnershipRepo,
        itemsBuilder: this.itemsBuilder,
        aggregatedObjectRepo: this.aggregatedObjectRepo,
        objectViewService: this.objectViewService,
        objectProjection: this.objectProjection,
      },
      pageRows,
      { locale, governance, governanceObjectIdFromHeader, viewerAccount },
    );

    const last = pageRows[pageRows.length - 1];
    return {
      items,
      cursor: hasMore ? encodeHubFeedCursor(hubFeedFilterKey(body.filter), loaded.cursorOf(last)) : null,
      hasMore,
    };
  }

  private async loadRows(body: HubUpdatesFeedBody, viewer: string): Promise<LoadedPage> {
    const filter = body.filter;
    const key = hubFeedFilterKey(filter);
    const limitPlusOne = body.limit + 1;
    const excluded = await resolveHubFeedExcludedAuthors(this.userAccountMutesRepo, viewer);

    if (filter.kind === 'trending') {
      const cursor = body.cursor ? decodeHubFeedCursor(body.cursor, key, hubUpdateRankCursorSchema) : null;
      if (body.cursor && !cursor) {
        return null;
      }
      const windowStart = cursor?.windowStart ?? hubFeedWindowStart(nowUnixSec());
      const rows = await this.hubUpdatesRepo.findTrending(windowStart, excluded, cursor, limitPlusOne);
      return {
        rows,
        cursorOf: (last) => ({ ...timePosition(last), score: Number(last.row.rank_score ?? 0), windowStart }),
      };
    }

    const cursor = body.cursor ? decodeHubFeedCursor(body.cursor, key, hubUpdateTimeCursorSchema) : null;
    if (body.cursor && !cursor) {
      return null;
    }
    switch (filter.kind) {
      case 'new':
        return { rows: await this.hubUpdatesRepo.findNew(excluded, cursor, limitPlusOne), cursorOf: timePosition };
      case 'my':
        return {
          rows: await this.hubUpdatesRepo.findMy(viewer, excluded, cursor, limitPlusOne),
          cursorOf: timePosition,
        };
      case 'author':
        return {
          rows: await this.hubUpdatesRepo.findByCreator(filter.account, cursor, limitPlusOne),
          cursorOf: timePosition,
        };
      case 'object':
        return {
          rows: await this.hubUpdatesRepo.findByObject(filter.object_id, excluded, cursor, limitPlusOne),
          cursorOf: timePosition,
        };
      default:
        return assertNeverHubFeedFilter(filter);
    }
  }
}
