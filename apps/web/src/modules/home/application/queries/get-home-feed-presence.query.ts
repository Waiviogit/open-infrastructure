import 'server-only';

import { z } from 'zod';

import { isEntityFilter, type HomeFeedFilter } from '../../domain/home-feed-filter';
import { HOME_FEED_TABS, type HomeFeedTabKey } from '../../domain/home-feed-tabs';
import { fetchHubFeedPresence } from '../../infrastructure/clients/hub-feed-presence.client';

const TAB_KEYS = HOME_FEED_TABS.map((tab) => tab.key) as [HomeFeedTabKey, ...HomeFeedTabKey[]];
const presenceResponseSchema = z.object({ tabs: z.array(z.enum(TAB_KEYS)) });

/**
 * Tabs where the URL's author / object has items. `undefined` when the filter is not an
 * author / object or query-api is unavailable — the requested filter is then kept as is.
 */
export async function getHomeFeedPresentTabsQuery(
  filter: HomeFeedFilter | null,
): Promise<HomeFeedTabKey[] | undefined> {
  if (!filter || !isEntityFilter(filter)) {
    return undefined;
  }
  const raw = await fetchHubFeedPresence(
    filter.kind === 'author' ? { author: filter.account } : { object: filter.objectId },
  );
  const parsed = presenceResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data.tabs : undefined;
}
