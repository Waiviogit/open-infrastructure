import 'server-only';

import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import {
  mapFeedStoryItemApiToView,
  userBlogFeedResponseSchema,
} from '@/modules/feed/application/mappers/feed-story-from-api.mapper';

import type { HomeFeedFilter } from '../../domain/home-feed-filter';
import { HOME_FEED_PAGE_SIZE, type HomeFeedTabKey } from '../../domain/home-feed-tabs';
import { fetchHubFeed } from '../../infrastructure/clients/hub-feed.client';
import { toHubFeedApiFilter } from '../dto/home-feed-filter.dto';
import {
  homeActivityFeedResponseSchema,
  homeUpdatesFeedResponseSchema,
  mapFollowedObjectMessageToItem,
  type HomeActivityFeedPage,
  type HomeUpdatesFeedPage,
} from '../dto/home-followed-feeds.dto';

export type HomeHubFeedRequest = {
  filter: HomeFeedFilter;
  viewer: string | null;
  locale: string;
  cursor?: string | null;
};

function emptyPage<T>(): { items: T[]; cursor: null; hasMore: false } {
  return { items: [], cursor: null, hasMore: false };
}

function fetchTab(tab: HomeFeedTabKey, request: HomeHubFeedRequest): Promise<unknown> {
  return fetchHubFeed({
    tab,
    filter: toHubFeedApiFilter(request.filter),
    limit: HOME_FEED_PAGE_SIZE,
    cursor: request.cursor,
    viewer: request.viewer,
    locale: request.locale,
  });
}

async function storyPage(tab: 'posts' | 'threads', request: HomeHubFeedRequest): Promise<UserBlogFeedPage> {
  const raw = await fetchTab(tab, request);
  if (raw == null) {
    return emptyPage();
  }
  const parsed = userBlogFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[getHomeHubFeed:${tab}] unexpected response shape:`, parsed.error.flatten());
    return emptyPage();
  }
  return {
    items: parsed.data.items.map(mapFeedStoryItemApiToView),
    cursor: parsed.data.cursor,
    hasMore: parsed.data.hasMore,
  };
}

export function getHomeHubPostsPage(request: HomeHubFeedRequest): Promise<UserBlogFeedPage> {
  return storyPage('posts', request);
}

export function getHomeHubThreadsPage(request: HomeHubFeedRequest): Promise<UserBlogFeedPage> {
  return storyPage('threads', request);
}

export async function getHomeHubActivityPage(
  request: HomeHubFeedRequest,
): Promise<HomeActivityFeedPage> {
  const raw = await fetchTab('activity', request);
  if (raw == null) {
    return emptyPage();
  }
  const parsed = homeActivityFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeHubFeed:activity] unexpected response shape:', parsed.error.flatten());
    return emptyPage();
  }
  return {
    items: parsed.data.items.map(mapFollowedObjectMessageToItem),
    cursor: parsed.data.cursor,
    hasMore: parsed.data.hasMore,
  };
}

export async function getHomeHubUpdatesPage(
  request: HomeHubFeedRequest,
): Promise<HomeUpdatesFeedPage> {
  const raw = await fetchTab('updates', request);
  if (raw == null) {
    return emptyPage();
  }
  const parsed = homeUpdatesFeedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getHomeHubFeed:updates] unexpected response shape:', parsed.error.flatten());
    return emptyPage();
  }
  return parsed.data;
}
