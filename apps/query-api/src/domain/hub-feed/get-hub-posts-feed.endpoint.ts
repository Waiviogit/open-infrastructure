import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import {
  AccountsCurrentRepository,
  AggregatedObjectRepository,
  HubPostsFeedRepository,
  PostsRepository,
  UserAccountMutesRepository,
  type FeedBranchRow,
  type RankedFeedBranchRow,
} from '../../repositories';
import { buildFeedStoryItemsFromPostPage } from '../feed/build-feed-story-items-from-post-page';
import type { UserBlogFeedResponse } from '../feed/feed-story-dtos';
import { PostRewardService } from '../feed/post-reward.service';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import {
  decodeHubFeedCursor,
  encodeHubFeedCursor,
  hubScoreCursorSchema,
  hubTimeCursorSchema,
} from './hub-feed-cursor';
import { assertNeverHubFeedFilter, hubFeedFilterKey } from './hub-feed-filter';
import { resolveHubFeedExcludedAuthors } from './resolve-hub-feed-excluded-authors';
import { hubFeedWindowStart, nowUnixSec } from './hub-feed-window';
import { HubFeedViewerRequiredError } from './hub-feed-viewer-required.error';
import type { HubPostsFeedBody } from './schemas/hub-feed.schema';

const EMPTY_PAGE: UserBlogFeedResponse = { items: [], cursor: null, hasMore: false };

type LoadedPage = { rows: FeedBranchRow[]; cursorOf: (last: FeedBranchRow) => unknown } | null;

/**
 * Hub "Posts" tab for one rail filter.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class GetHubPostsFeedEndpoint {
  constructor(
    private readonly hubPostsRepo: HubPostsFeedRepository,
    private readonly postsRepo: PostsRepository,
    private readonly accounts: AccountsCurrentRepository,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly objectProjection: ObjectProjectionService,
    private readonly postRewardService: PostRewardService,
  ) {}

  async execute(
    body: HubPostsFeedBody,
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

    const hasMore = loaded.rows.length > body.limit;
    const pageRows = hasMore ? loaded.rows.slice(0, body.limit) : loaded.rows;
    if (pageRows.length === 0) {
      return EMPTY_PAGE;
    }

    const items = await buildFeedStoryItemsFromPostPage(
      {
        postsRepo: this.postsRepo,
        accounts: this.accounts,
        aggregatedObjectRepo: this.aggregatedObjectRepo,
        objectViewService: this.objectViewService,
        governanceResolver: this.governanceResolver,
        objectProjection: this.objectProjection,
        postRewardService: this.postRewardService,
      },
      pageRows,
      locale,
      governanceObjectIdFromHeader,
      viewerAccount,
      body.currency,
    );

    const last = pageRows[pageRows.length - 1];
    return {
      items,
      cursor: hasMore ? encodeHubFeedCursor(hubFeedFilterKey(body.filter), loaded.cursorOf(last)) : null,
      hasMore,
    };
  }

  /** Rows for the filter (limit + 1), or `null` when the cursor does not belong to it. */
  private async loadRows(body: HubPostsFeedBody, viewer: string): Promise<LoadedPage> {
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
      const rows = await this.hubPostsRepo.findRanked(metric, windowStart, excluded, cursor, limitPlusOne);
      return {
        rows,
        cursorOf: (last) => ({
          score: (last as RankedFeedBranchRow).score,
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
    const cursorOf = (last: FeedBranchRow) => ({
      feedAt: Number(last.feed_at),
      author: last.author,
      permlink: last.permlink,
    });

    switch (filter.kind) {
      case 'new':
        return { rows: await this.hubPostsRepo.findNew(excluded, cursor, limitPlusOne), cursorOf };
      case 'my':
        return { rows: await this.hubPostsRepo.findMy(viewer, excluded, cursor, limitPlusOne), cursorOf };
      case 'author':
        return { rows: await this.hubPostsRepo.findByAuthor(filter.account, cursor, limitPlusOne), cursorOf };
      case 'object':
        return {
          rows: await this.hubPostsRepo.findByObject(filter.object_id, excluded, cursor, limitPlusOne),
          cursorOf,
        };
      default:
        return assertNeverHubFeedFilter(filter);
    }
  }
}
