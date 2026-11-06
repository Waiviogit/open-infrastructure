import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import {
  AccountsCurrentRepository,
  AggregatedObjectRepository,
  ThreadsRepository,
  UserAccountMutesRepository,
  UserObjectFollowsRepository,
} from '../../repositories';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import { decodeFeedCursor } from './feed-cursor';
import { FEED_TAGGED_OBJECT_DISPLAY_LIMIT } from './feed.constants';
import type { UserBlogFeedResponse } from './feed-story-dtos';
import { attachFollowedThreadObjectChips } from './followed-thread-object-chips';
import { projectFeedObjectsById } from './project-feed-objects';
import type { FollowedObjectsThreadsFeedBody } from './schemas/followed-objects-threads-feed.schema';
import { hydrateThreadFeedPage } from './thread-feed-hydrator';

const EMPTY_PAGE: UserBlogFeedResponse = { items: [], cursor: null, hasMore: false };

/**
 * Hub "Threads" tab: threads tagged with any active object the account follows, newest first.
 * Each item's `objects` lists the followed objects it is tagged with.
 */
@Injectable()
export class GetFollowedObjectsThreadsFeedEndpoint {
  constructor(
    private readonly threadsRepo: ThreadsRepository,
    private readonly accounts: AccountsCurrentRepository,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
    private readonly userObjectFollowsRepo: UserObjectFollowsRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
  ) {}

  async execute(
    username: string,
    body: FollowedObjectsThreadsFeedBody,
    locale: string,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<UserBlogFeedResponse | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }
    const account = await this.accounts.findByName(name);
    if (!account) {
      return null;
    }

    const cursorPayload = body.cursor ? decodeFeedCursor(body.cursor) : null;
    if (body.cursor && !cursorPayload) {
      return EMPTY_PAGE;
    }

    const viewerTrimmed = viewerAccount?.trim() ?? '';
    const mutedAuthors =
      viewerTrimmed.length > 0
        ? await this.userAccountMutesRepo.listMutedForMuters([viewerTrimmed])
        : [];

    const limit = body.limit;
    const threadRows = await this.threadsRepo.findFollowedObjectsThreadsFeed(
      name,
      mutedAuthors,
      cursorPayload,
      limit + 1,
    );

    const page = await hydrateThreadFeedPage(
      { threadsRepo: this.threadsRepo, accounts: this.accounts },
      threadRows,
      limit,
      viewerAccount,
    );
    if (page.items.length === 0) {
      return page;
    }

    const hashtagsByItemId = new Map(
      threadRows.map((thread) => [`${thread.author}/${thread.permlink}`, thread.hashtags ?? []]),
    );
    const pageHashtags = page.items.flatMap((item) => hashtagsByItemId.get(item.id) ?? []);
    const followedIds = await this.userObjectFollowsRepo.findFollowedActiveObjectIdsAmong(
      name,
      pageHashtags,
    );
    const governance = await this.governanceResolver.resolveMergedForObjectView(
      governanceObjectIdFromHeader,
    );
    const projectedById = await projectFeedObjectsById(
      {
        aggregatedObjectRepo: this.aggregatedObjectRepo,
        objectViewService: this.objectViewService,
        objectProjection: this.objectProjection,
      },
      followedIds,
      { locale, governance, governanceObjectIdFromHeader, viewerAccount },
    );

    return {
      ...page,
      items: attachFollowedThreadObjectChips(
        page.items,
        hashtagsByItemId,
        projectedById,
        FEED_TAGGED_OBJECT_DISPLAY_LIMIT,
      ),
    };
  }
}
