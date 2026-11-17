import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { UPDATE_TYPES } from '@opden-data-layer/core';
import {
  AggregatedObjectRepository,
  AccountsCurrentRepository,
  ObjectsCoreRepository,
  PostsRepository,
  UserAccountMutesRepository,
  type FeedBranchRow,
} from '../../repositories';
import { OBJECT_FEED_MAX_PINNED_POSTS } from '../../constants/object-feed.constants';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import { decodeFeedCursor, encodeFeedCursor } from './feed-cursor';
import { buildFeedStoryItemsFromPostPage } from './build-feed-story-items-from-post-page';
import type { FeedStoryItemDto, UserBlogFeedResponse } from './feed-story-dtos';
import { PostRewardService } from './post-reward.service';
import {
  buildObjectPostFeedScope,
  parsePinnedPostRefs,
  pinnedRefsToKeys,
} from './object-feed-scope.builder';
import { collectViewerUpdateVotes, mapPostRefUpdateIds } from './object-feed-pins';
import type { ObjectPostsFeedBody } from './schemas/object-posts-feed.schema';

const OBJECT_FEED_UPDATE_TYPES = [
  UPDATE_TYPES.NEWS_FEED,
  UPDATE_TYPES.PIN,
  UPDATE_TYPES.REMOVE,
  UPDATE_TYPES.PRODUCT_GROUP_ID,
  UPDATE_TYPES.WALLET_ADDRESS,
  UPDATE_TYPES.LINK,
  UPDATE_TYPES.WEBSITE,
  UPDATE_TYPES.URL,
] as const;

@Injectable()
export class GetObjectPostsFeedEndpoint {
  constructor(
    private readonly postsRepo: PostsRepository,
    private readonly objectsCoreRepo: ObjectsCoreRepository,
    private readonly accounts: AccountsCurrentRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly objectProjection: ObjectProjectionService,
    private readonly postRewardService: PostRewardService,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
  ) {}

  async execute(
    objectId: string,
    body: ObjectPostsFeedBody,
    locale: string,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<UserBlogFeedResponse | null> {
    const trimmedId = objectId.trim();
    if (!trimmedId) {
      return null;
    }

    const core = await this.objectsCoreRepo.findByObjectIdForPage(trimmedId);
    if (!core) {
      return null;
    }

    const limit = body.limit;
    const limitPlusOne = limit + 1;
    const cursorPayload = body.cursor ? decodeFeedCursor(body.cursor) : null;
    if (body.cursor && !cursorPayload) {
      return { items: [], cursor: null, hasMore: false };
    }

    const { objects, voterWaivPowers } = await this.aggregatedObjectRepo.loadByObjectIds(
      [trimmedId],
      { viewerAccount },
    );
    const agg = objects[0];
    if (!agg) {
      return null;
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      governanceObjectIdFromHeader,
    );

    const views = this.objectViewService.resolve(objects, voterWaivPowers, {
      update_types: [...OBJECT_FEED_UPDATE_TYPES],
      locale,
      include_rejected: false,
      governance,
    });
    const view = views[0];
    if (!view) {
      return null;
    }

    const viewerTrimmed = viewerAccount?.trim() ?? '';
    const mutedAuthors =
      viewerTrimmed !== ''
        ? await this.userAccountMutesRepo.listMutedForMuters([viewerTrimmed])
        : [];

    const groupSiblingIds = view.meta_group_id
      ? await this.objectsCoreRepo.findObjectIdsByMetaGroupId(view.meta_group_id, trimmedId)
      : [];
    const relistingIds = await this.objectsCoreRepo.findRelistingObjectIds(trimmedId);
    const linkedObjectIds = [trimmedId, ...groupSiblingIds, ...relistingIds];

    const scope = buildObjectPostFeedScope({
      view,
      linkedObjectIds,
      mutedAuthors,
      locale,
      viewerAccount,
      viewerVotes: collectViewerUpdateVotes(agg.validity_votes, viewerAccount),
      maxPinned: OBJECT_FEED_MAX_PINNED_POSTS,
    });

    if (scope.newsFeedMode && !scope.newsFilter) {
      return { items: [], cursor: null, hasMore: false };
    }

    const pinnedKeys = pinnedRefsToKeys(parsePinnedPostRefs(scope.pinnedPostRefs));
    const pinnedRows: FeedBranchRow[] =
      !cursorPayload && pinnedKeys.length > 0
        ? await this.postsRepo.findPostsFeedRowsByKeys(pinnedKeys)
        : [];

    const feedRows = await this.postsRepo.findObjectPostsFeed(
      scope,
      cursorPayload,
      limitPlusOne,
    );

    const pinnedKeySet = new Set(pinnedRows.map((r) => `${r.author}\0${r.permlink}`));
    const filteredFeedRows = feedRows.filter(
      (r) => !pinnedKeySet.has(`${r.author}\0${r.permlink}`),
    );

    let pageRows: FeedBranchRow[];
    let feedPage: FeedBranchRow[];
    let hasMore: boolean;

    if (!cursorPayload && pinnedRows.length > 0) {
      const feedSlots = Math.max(0, limit - pinnedRows.length);
      feedPage = filteredFeedRows.slice(0, feedSlots);
      hasMore = filteredFeedRows.length > feedSlots;
      pageRows = [...pinnedRows, ...feedPage];
    } else {
      hasMore = filteredFeedRows.length > limit;
      feedPage = hasMore ? filteredFeedRows.slice(0, limit) : filteredFeedRows;
      pageRows = feedPage;
    }

    if (pageRows.length === 0) {
      return { items: [], cursor: null, hasMore: false };
    }

    const items: FeedStoryItemDto[] = await buildFeedStoryItemsFromPostPage(
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

    const pinnedRefSet = new Set(scope.pinnedPostRefs);
    const viewerPinnedSet = new Set(scope.viewerPinnedPostRefs);
    const pinUpdateIds = mapPostRefUpdateIds(agg.updates, UPDATE_TYPES.PIN);
    const removeUpdateIds = mapPostRefUpdateIds(agg.updates, UPDATE_TYPES.REMOVE);

    for (const item of items) {
      const ref = `${item.author}/${item.permlink}`;
      const pinUpdateId = pinUpdateIds.get(ref);
      const removeUpdateId = removeUpdateIds.get(ref);
      item.pin = pinnedRefSet.has(ref);
      item.viewerPinned = viewerPinnedSet.has(ref);
      item.hasPinUpdate = pinUpdateId != null;
      item.hasRemoveUpdate = removeUpdateId != null;
      item.pinUpdateId = pinUpdateId ?? null;
      item.removeUpdateId = removeUpdateId ?? null;
    }

    return {
      items,
      cursor: hasMore ? nextFeedCursor(feedPage, filteredFeedRows[feedPage.length]) : null,
      hasMore,
    };
  }
}

/**
 * Keyset cursor after the last regular feed row on the page. Pinned rows never set it: when the
 * pinned block fills page 1, the cursor sits just above the first feed row not shown yet.
 */
function nextFeedCursor(
  shown: readonly FeedBranchRow[],
  firstNotShown: FeedBranchRow | undefined,
): string | null {
  const last = shown[shown.length - 1];
  if (last) {
    return encodeFeedCursor({
      feedAt: Number(last.feed_at),
      author: last.author,
      permlink: last.permlink,
    });
  }
  if (firstNotShown) {
    return encodeFeedCursor({
      feedAt: Number(firstNotShown.feed_at) + 1,
      author: firstNotShown.author,
      permlink: firstNotShown.permlink,
    });
  }
  return null;
}
