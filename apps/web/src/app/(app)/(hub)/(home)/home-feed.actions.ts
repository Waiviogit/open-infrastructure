'use server';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import type { UserBlogFeedPage } from '@/modules/feed/application/dto/user-blog-feed-page.dto';
import { homeFeedFilterSchema } from '@/modules/home/application/dto/home-feed-filter.dto';
import type {
  HomeActivityFeedPage,
  HomeUpdatesFeedPage,
} from '@/modules/home/application/dto/home-followed-feeds.dto';
import {
  getHomeHubActivityPage,
  getHomeHubPostsPage,
  getHomeHubThreadsPage,
  getHomeHubUpdatesPage,
  type HomeHubFeedRequest,
} from '@/modules/home/application/queries/get-home-hub-feed.query';
import type {
  HomeFeedFilterObjectsPage,
  HomeFeedFilterUsersPage,
} from '@/modules/home/application/dto/home-feed-filters.dto';
import {
  getHomeFeedFilterObjectsPageQuery,
  getHomeFeedFilterUsersPageQuery,
} from '@/modules/home/application/queries/get-home-feed-filters.query';
import type { HomeFeedFilter } from '@/modules/home/domain/home-feed-filter';
import { HOME_FEED_TABS, type HomeFeedTabKey } from '@/modules/home/domain/home-feed-tabs';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

function emptyPage<T>(): { items: T[]; cursor: null; hasMore: false } {
  return { items: [], cursor: null, hasMore: false };
}

async function getViewerUsername(): Promise<string | null> {
  const auth = createCookieAuthContextProvider();
  const user = await auth.getUser();
  return user?.username ?? null;
}

/**
 * Next-page request for the rail filter the list was rendered with. The filter comes
 * from the client, so it is validated again; "my" without a session yields no request.
 */
async function nextPageRequest(
  rawFilter: unknown,
  cursor: unknown,
): Promise<HomeHubFeedRequest | null> {
  const filter = homeFeedFilterSchema.safeParse(rawFilter);
  if (!filter.success || typeof cursor !== 'string' || cursor.length === 0) {
    return null;
  }
  const viewer = await getViewerUsername();
  if (filter.data.kind === 'my' && !viewer) {
    return null;
  }
  return { filter: filter.data, viewer, locale: await getRequestLocale(), cursor };
}

/** Never throws to the client: a failed page is an empty page and the list stops. */
async function loadNextPage<TPage>(
  rawFilter: unknown,
  cursor: unknown,
  load: (request: HomeHubFeedRequest) => Promise<TPage>,
  empty: TPage,
): Promise<TPage> {
  try {
    const request = await nextPageRequest(rawFilter, cursor);
    return request ? await load(request) : empty;
  } catch {
    return empty;
  }
}

export async function loadMoreHomeFeedAction(
  filter: HomeFeedFilter,
  cursor: string,
): Promise<UserBlogFeedPage> {
  return loadNextPage(filter, cursor, getHomeHubPostsPage, emptyPage());
}

export async function loadMoreHomeThreadsFeedAction(
  filter: HomeFeedFilter,
  cursor: string,
): Promise<UserBlogFeedPage> {
  return loadNextPage(filter, cursor, getHomeHubThreadsPage, emptyPage());
}

export async function loadMoreHomeActivityFeedAction(
  filter: HomeFeedFilter,
  cursor: string,
): Promise<HomeActivityFeedPage> {
  return loadNextPage(filter, cursor, getHomeHubActivityPage, emptyPage());
}

const HOME_FEED_TAB_KEYS = new Set<string>(HOME_FEED_TABS.map((tab) => tab.key));
const MAX_FILTER_SKIP = 5_000;
const OBJECT_TYPE_MAX_LENGTH = 64;

function isValidSkip(skip: unknown): skip is number {
  return typeof skip === 'number' && Number.isInteger(skip) && skip >= 0 && skip <= MAX_FILTER_SKIP;
}

/** "Show more" of followed accounts in the signed-in viewer's rail. */
export async function loadMoreHomeFeedFilterUsersAction(
  tab: HomeFeedTabKey,
  skip: number,
): Promise<HomeFeedFilterUsersPage> {
  const empty: HomeFeedFilterUsersPage = { items: [], hasMore: false };
  try {
    const viewer = await getViewerUsername();
    if (!viewer || !HOME_FEED_TAB_KEYS.has(tab) || !isValidSkip(skip)) {
      return empty;
    }
    return await getHomeFeedFilterUsersPageQuery(viewer, tab, skip, await getRequestLocale());
  } catch {
    return empty;
  }
}

/** "Show more" of followed objects of one type in the signed-in viewer's rail. */
export async function loadMoreHomeFeedFilterObjectsAction(
  tab: HomeFeedTabKey,
  objectType: string,
  skip: number,
): Promise<HomeFeedFilterObjectsPage> {
  const empty: HomeFeedFilterObjectsPage = { items: [], hasMore: false };
  try {
    const viewer = await getViewerUsername();
    const type = typeof objectType === 'string' ? objectType.trim() : '';
    if (
      !viewer ||
      !HOME_FEED_TAB_KEYS.has(tab) ||
      !isValidSkip(skip) ||
      type.length === 0 ||
      type.length > OBJECT_TYPE_MAX_LENGTH
    ) {
      return empty;
    }
    return await getHomeFeedFilterObjectsPageQuery(viewer, tab, type, skip, await getRequestLocale());
  } catch {
    return empty;
  }
}

export async function loadMoreHomeUpdatesFeedAction(
  filter: HomeFeedFilter,
  cursor: string,
): Promise<HomeUpdatesFeedPage> {
  return loadNextPage(filter, cursor, getHomeHubUpdatesPage, emptyPage());
}
