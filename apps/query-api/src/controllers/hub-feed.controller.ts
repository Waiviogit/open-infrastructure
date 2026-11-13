import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';

import type { UserBlogFeedResponse } from '../domain/feed';
import {
  GetHubActivityFeedEndpoint,
  GetHubFeedPresenceEndpoint,
  GetHubPostsFeedEndpoint,
  GetHubThreadsFeedEndpoint,
  GetHubUpdatesFeedEndpoint,
  HubFeedViewerRequiredError,
  hubActivityFeedBodySchema,
  hubFeedPresenceQuerySchema,
  hubPostsFeedBodySchema,
  hubThreadsFeedBodySchema,
  hubUpdatesFeedBodySchema,
  type HubActivityFeedBody,
  type HubFeedPresenceDto,
  type HubFeedPresenceQuery,
  type HubPostsFeedBody,
  type HubThreadsFeedBody,
  type HubUpdatesFeedBody,
} from '../domain/hub-feed';
import type { FollowedObjectsMessagesResponseDto } from '../domain/messaging/build-object-activity-feed-items';
import type { FollowedObjectsUpdatesFeedResponseDto } from '../domain/object-updates/schemas/followed-objects-updates-feed.schema';
import { ReqGovernanceObjectId } from '../http/governance-object-id.decorator';
import { ReqLocale } from '../http/locale-header.decorator';
import { ReqViewer } from '../http/viewer-header.decorator';
import { ZodBodyPipe, ZodQueryPipe } from '../pipes';

async function mapHubFeedErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HubFeedViewerRequiredError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

/**
 * Hub start page tabs, each filtered by one rail item (sort, My feed, author, object).
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Controller({ path: 'feed', version: '1' })
export class HubFeedController {
  constructor(
    private readonly getHubPostsFeed: GetHubPostsFeedEndpoint,
    private readonly getHubThreadsFeed: GetHubThreadsFeedEndpoint,
    private readonly getHubActivityFeed: GetHubActivityFeedEndpoint,
    private readonly getHubUpdatesFeed: GetHubUpdatesFeedEndpoint,
    private readonly getHubFeedPresence: GetHubFeedPresenceEndpoint,
  ) {}

  @Get('presence')
  async presence(
    @Query(new ZodQueryPipe(hubFeedPresenceQuerySchema)) query: HubFeedPresenceQuery,
  ): Promise<HubFeedPresenceDto> {
    return this.getHubFeedPresence.execute(query);
  }

  @Post('posts')
  async posts(
    @Body(new ZodBodyPipe(hubPostsFeedBodySchema)) body: HubPostsFeedBody,
    @ReqLocale() locale: string,
    @ReqGovernanceObjectId() governanceObjectId: string | undefined,
    @ReqViewer() viewer: string | undefined,
  ): Promise<UserBlogFeedResponse> {
    return mapHubFeedErrors(() => this.getHubPostsFeed.execute(body, locale, governanceObjectId, viewer));
  }

  @Post('threads')
  async threads(
    @Body(new ZodBodyPipe(hubThreadsFeedBodySchema)) body: HubThreadsFeedBody,
    @ReqLocale() locale: string,
    @ReqGovernanceObjectId() governanceObjectId: string | undefined,
    @ReqViewer() viewer: string | undefined,
  ): Promise<UserBlogFeedResponse> {
    return mapHubFeedErrors(() => this.getHubThreadsFeed.execute(body, locale, governanceObjectId, viewer));
  }

  @Post('activity')
  async activity(
    @Body(new ZodBodyPipe(hubActivityFeedBodySchema)) body: HubActivityFeedBody,
    @ReqGovernanceObjectId() governanceObjectId: string | undefined,
    @ReqViewer() viewer: string | undefined,
  ): Promise<FollowedObjectsMessagesResponseDto> {
    return mapHubFeedErrors(() => this.getHubActivityFeed.execute(body, governanceObjectId, viewer));
  }

  @Post('updates')
  async updates(
    @Body(new ZodBodyPipe(hubUpdatesFeedBodySchema)) body: HubUpdatesFeedBody,
    @ReqLocale() locale: string,
    @ReqGovernanceObjectId() governanceObjectId: string | undefined,
    @ReqViewer() viewer: string | undefined,
  ): Promise<FollowedObjectsUpdatesFeedResponseDto> {
    return mapHubFeedErrors(() => this.getHubUpdatesFeed.execute(body, locale, governanceObjectId, viewer));
  }
}
