export type HomeFeedTabKey = 'posts' | 'activity' | 'threads' | 'updates';

export type HomeFeedTab = {
  key: HomeFeedTabKey;
  href: string;
  labelKey:
    | 'home_feed_tab_posts'
    | 'home_feed_tab_activity'
    | 'home_feed_tab_threads'
    | 'home_feed_tab_updates';
};

/** Path prefix of the followed-objects tabs (`/feed/activity`, `/feed/threads`, `/feed/updates`). */
export const HOME_FEED_SECTION_PREFIX = '/feed/';

export const HOME_FEED_PAGE_SIZE = 20;

export const HOME_FEED_TABS: readonly HomeFeedTab[] = [
  { key: 'posts', href: '/', labelKey: 'home_feed_tab_posts' },
  { key: 'threads', href: '/feed/threads', labelKey: 'home_feed_tab_threads' },
  { key: 'activity', href: '/feed/activity', labelKey: 'home_feed_tab_activity' },
  { key: 'updates', href: '/feed/updates', labelKey: 'home_feed_tab_updates' },
];

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Active hub feed tab for `pathname`, or null outside the home feed. */
export function resolveActiveHomeFeedTab(pathname: string): HomeFeedTabKey | null {
  const path = trimTrailingSlash(pathname);
  return HOME_FEED_TABS.find((tab) => tab.href === path)?.key ?? null;
}

/** True on `/` and every `/feed/*` tab — keeps the hub FEED section active. */
export function isHomeFeedPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith(HOME_FEED_SECTION_PREFIX);
}
