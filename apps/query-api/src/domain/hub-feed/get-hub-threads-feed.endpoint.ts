import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import type { Thread } from '@opden-data-layer/odl-db-types';

import {
  AccountsCurrentRepository,
  AggregatedObjectRepository,
  HubThreadsFeedRepository,
  ObjectsCoreRepository,
  ThreadsRepository,
  UserAccountMutesRepository,
} from '../../repositories';
import { FEED_TAGGED_OBJECT_DISPLAY_LIMIT } from '../feed/feed.constants';
import type { UserBlogFeedResponse } from '../feed/feed-story-dtos';
import { attachFollowedThreadObjectChips } from '../feed/followed-thread-object-chips';
import { projectFeedObjectsById } from '../feed/project-feed-objects';
import { hydrateThreadFeedPage } from '../feed/thread-feed-hydrator';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import {
  decodeHubFeedCursor,
  encodeHubFeedCursor,
  hubScoreCursorSchema,
  hubTimeCursorSchema,
} from './hub-feed-cursor';
import { assertNeverHubFeedFilter, hubFeedFilterKey } from './hub-feed-filter';
import { hubFeedWindowStart, nowUnixSec } from './hub-feed-window';
import { HubFeedViewerRequiredError } from './hub-feed-viewer-required.error';
import { resolveHubFeedExcludedAuthors } from './resolve-hub-feed-excluded-authors';
import type { HubThreadsFeedBody } from './schemas/hub-feed.schema';

const EMPTY_PAGE: UserBlogFeedResponse = { items: [], cursor: null, hasMore: false };

type LoadedPage = { rows: Thread[]; cursorOf: (last: Thread) => unknown } | null;

/**
 * Hub "Threads" tab for one rail filter. Each item's `objects` lists the active objects
 * named in the thread's hashtags.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class GetHubThreadsFeedEndpoint {
  constructor(
    private readonly hubThreadsRepo: HubThreadsFeedRepository,
    private readonly threadsRepo: ThreadsRepository,
    private readonly accounts: AccountsCurrentRepository,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
    private readonly objectsCoreRepo: ObjectsCoreRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
  ) {}

  async execute(
    body: HubThreadsFeedBody,
    locale: string,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<UserBlogFeedResponse> {
    const viewer = viewerAccount?.trim() ?? '';
    if (body.filter.kind === 'my' && viewer.length === 0) {
      throw new HubFeedViewerRequiredError();
    }

    const loaded = await this.loadRows(body, viewer);
    if (!loaded) {
      return EMPTY_PAGE;
    }

    const page = await hydrateThreadFeedPage(
      { threadsRepo: this.threadsRepo, accounts: this.accounts },
      loaded.rows,
      body.limit,
      viewerAccount,
    );
    if (page.items.length === 0) {
      return EMPTY_PAGE;
    }

    const pageRows = loaded.rows.slice(0, body.limit);
    const last = pageRows[pageRows.length - 1];
    const items = await this.attachObjectChips(page.items, pageRows, {
      locale,
      governanceObjectIdFromHeader,
      viewerAccount,
    });

    return {
      items,
      cursor: page.hasMore ? encodeHubFeedCursor(hubFeedFilterKey(body.filter), loaded.cursorOf(last)) : null,
      hasMore: page.hasMore,
    };
  }

  private async loadRows(body: HubThreadsFeedBody, viewer: string): Promise<LoadedPage> {
    const filter = body.filter;
    const key = hubFeedFilterKey(filter);
    const limitPlusOne = body.limit + 1;
    const excluded = await resolveHubFeedExcludedAuthors(this.userAccountMutesRepo, viewer);

    if (filter.kind === 'trending' || filter.kind === 'hot') {
      const cursor = body.cursor ? decodeHubFeedCursor(body.cursor, key, hubScoreCursorSchema) : null;
      if (body.cursor && !cursor) {
        return null;
      }
      const windowStart = cursor?.windowStart ?? hubFeedWindowStart(nowUnixSec());
      const metric = filter.kind === 'trending' ? 'net_rshares' : 'children';
      const rows = await this.hubThreadsRepo.findRanked(metric, windowStart, excluded, cursor, limitPlusOne);
      return {
        rows,
        cursorOf: (last) => ({
          score: String((metric === 'net_rshares' ? last.net_rshares : last.children) ?? 0),
          author: last.author,
          permlink: last.permlink,
          windowStart,
        }),
      };
    }

    const cursor = body.cursor ? decodeHubFeedCursor(body.cursor, key, hubTimeCursorSchema) : null;
    if (body.cursor && !cursor) {
      return null;
    }
    const cursorOf = (last: Thread) => ({
      feedAt: Number(last.created_unix),
      author: last.author,
      permlink: last.permlink,
    });

    switch (filter.kind) {
      case 'new':
        return { rows: await this.hubThreadsRepo.findNew(excluded, cursor, limitPlusOne), cursorOf };
      case 'my':
        return { rows: await this.hubThreadsRepo.findMy(viewer, excluded, cursor, limitPlusOne), cursorOf };
      case 'author':
        return { rows: await this.hubThreadsRepo.findByAuthor(filter.account, cursor, limitPlusOne), cursorOf };
      case 'object':
        return {
          rows: await this.hubThreadsRepo.findByObject(filter.object_id, excluded, cursor, limitPlusOne),
          cursorOf,
        };
      default:
        return assertNeverHubFeedFilter(filter);
    }
  }

  private async attachObjectChips(
    items: UserBlogFeedResponse['items'],
    pageRows: readonly Thread[],
    ctx: { locale: string; governanceObjectIdFromHeader?: string; viewerAccount?: string },
  ): Promise<UserBlogFeedResponse['items']> {
    const hashtagsByItemId = new Map(
      pageRows.map((thread) => [`${thread.author}/${thread.permlink}`, thread.hashtags ?? []]),
    );
    const activeIds = await this.objectsCoreRepo.findActiveObjectIdsAmong(
      pageRows.flatMap((thread) => thread.hashtags ?? []),
    );
    if (activeIds.length === 0) {
      return items;
    }
    const governance = await this.governanceResolver.resolveMergedForObjectView(
      ctx.governanceObjectIdFromHeader,
    );
    const projectedById = await projectFeedObjectsById(
      {
        aggregatedObjectRepo: this.aggregatedObjectRepo,
        objectViewService: this.objectViewService,
        objectProjection: this.objectProjection,
      },
      activeIds,
      {
        locale: ctx.locale,
        governance,
        governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
        viewerAccount: ctx.viewerAccount,
      },
    );
    return attachFollowedThreadObjectChips(
      items,
      hashtagsByItemId,
      projectedById,
      FEED_TAGGED_OBJECT_DISPLAY_LIMIT,
    );
  }
}
