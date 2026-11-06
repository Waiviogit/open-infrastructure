'use server';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import type {
  HomeActivityFeedPage,
  HomeUpdatesFeedPage,
} from '@/modules/home/application/dto/home-followed-feeds.dto';
import {
  getHomeActivityFeedPageQuery,
  getHomeThreadsFeedPageQuery,
  getHomeUpdatesFeedPageQuery,
  type HomeFollowedFeedRequest,
} from '@/modules/home/application/queries/get-home-followed-feeds.query';
import { getHomeFeedPageQuery } from '@/modules/home/application/queries/get-home-feed-page.query';
import { HOME_FEED_PAGE_SIZE } from '@/modules/home/domain/home-feed-tabs';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

const EMPTY_PAGE = { items: [], cursor: null, hasMore: false } as const;

async function getViewerUsername(): Promise<string | null> {
  const auth = createCookieAuthContextProvider();
  const user = await auth.getUser();
  return user?.username ?? null;
}

/** Followed-objects tabs read the signed-in viewer's own follows; guests get an empty page. */
async function followedFeedRequest(cursor: string): Promise<HomeFollowedFeedRequest | null> {
  const account = await getViewerUsername();
  if (!account) {
    return null;
  }
  return { account, cursor, locale: await getRequestLocale() };
}

export async function loadMoreHomeFeedAction(cursor: string): Promise<UserBlogFeedPage> {
  const viewer = await getViewerUsername();
  return getHomeFeedPageQuery({ cursor, limit: HOME_FEED_PAGE_SIZE }, viewer);
}

export async function loadMoreHomeActivityFeedAction(
  cursor: string,
): Promise<HomeActivityFeedPage> {
  const request = await followedFeedRequest(cursor);
  return request ? getHomeActivityFeedPageQuery(request) : { ...EMPTY_PAGE, items: [] };
}

export async function loadMoreHomeThreadsFeedAction(cursor: string): Promise<UserBlogFeedPage> {
  const request = await followedFeedRequest(cursor);
  return request ? getHomeThreadsFeedPageQuery(request) : { ...EMPTY_PAGE, items: [] };
}

export async function loadMoreHomeUpdatesFeedAction(cursor: string): Promise<HomeUpdatesFeedPage> {
  const request = await followedFeedRequest(cursor);
  return request ? getHomeUpdatesFeedPageQuery(request) : { ...EMPTY_PAGE, items: [] };
}
