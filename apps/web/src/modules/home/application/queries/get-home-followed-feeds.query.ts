import 'server-only';

import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import {
  mapFeedStoryItemApiToView,
  userBlogFeedResponseSchema,
} from '@/modules/feed/application/mappers/feed-story-from-api.mapper';

import { HOME_FEED_PAGE_SIZE } from '../../domain/home-feed-tabs';
import {
  fetchFollowedObjectsFeed,
  type FollowedObjectsFeedResource,
} from '../../infrastructure/clients/followed-objects-feed.client';
import {
  homeActivityFeedResponseSchema,
  homeUpdatesFeedResponseSchema,
  mapFollowedObjectMessageToItem,
  type HomeActivityFeedPage,
  type HomeUpdatesFeedPage,
} from '../dto/home-followed-feeds.dto';

export type HomeFollowedFeedRequest = {
  account: string;
  locale: string;
  cursor?: string | null;
};

const EMPTY_PAGE = { items: [], cursor: null, hasMore: false } as const;

function fetchPage(
  resource: FollowedObjectsFeedResource,
  request: HomeFollowedFeedRequest,
): Promise<unknown> {
  return fetchFollowedObjectsFeed({
    account: request.account,
    resource,
    locale: request.locale,
    body: {
      limit: HOME_FEED_PAGE_SIZE,
      ...(request.cursor ? { cursor: request.cursor } : {}),
    },
  });
}

export async function getHomeThreadsFeedPageQuery(
  request: HomeFollowedFeedRequest,
): Promise<UserBlogFeedPage> {
  const raw = await fetchPage('threads', request);
  if (raw == null) {
    return { ...EMPTY_PAGE, items: [] };
  }
  const parsed = userBlogFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeThreadsFeedPageQuery] unexpected response shape:', parsed.error.flatten());
    return { ...EMPTY_PAGE, items: [] };
  }
  return {
    items: parsed.data.items.map(mapFeedStoryItemApiToView),
    cursor: parsed.data.cursor,
    hasMore: parsed.data.hasMore,
  };
}

export async function getHomeUpdatesFeedPageQuery(
  request: HomeFollowedFeedRequest,
): Promise<HomeUpdatesFeedPage> {
  const raw = await fetchPage('updates', request);
  if (raw == null) {
    return { ...EMPTY_PAGE, items: [] };
  }
  const parsed = homeUpdatesFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeUpdatesFeedPageQuery] unexpected response shape:', parsed.error.flatten());
    return { ...EMPTY_PAGE, items: [] };
  }
  return parsed.data;
}

export async function getHomeActivityFeedPageQuery(
  request: HomeFollowedFeedRequest,
): Promise<HomeActivityFeedPage> {
  const raw = await fetchPage('messages', request);
  if (raw == null) {
    return { ...EMPTY_PAGE, items: [] };
  }
  const parsed = homeActivityFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeActivityFeedPageQuery] unexpected response shape:', parsed.error.flatten());
    return { ...EMPTY_PAGE, items: [] };
  }
  return {
    items: parsed.data.items.map(mapFollowedObjectMessageToItem),
    cursor: parsed.data.cursor,
    hasMore: parsed.data.hasMore,
  };
}
