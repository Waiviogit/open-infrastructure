'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { isObjectActivityMessagePath } from '@/modules/messaging/domain/activity-message-permalink';
import { ScrollToTopOnEnter } from '@/shared/presentation';

import { homeFeedFilterKey, parseHomeFeedFilter } from '../../domain/home-feed-filter';

/**
 * Each hub feed tab + rail filter is its own list: switching either starts at the top.
 * Back/Forward keeps the saved offset (`ScrollToTopOnEnter` skips pending restores).
 * The activity preview modal pushes a message permalink over the feed — that is not a tab change.
 */
export function HomeFeedScrollReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listKey = `${pathname}|${homeFeedFilterKey(parseHomeFeedFilter(searchParams))}`;
  const [feedListKey, setFeedListKey] = useState(listKey);
  if (listKey !== feedListKey && !isObjectActivityMessagePath(pathname)) {
    setFeedListKey(listKey);
  }
  return <ScrollToTopOnEnter routeKey={feedListKey} />;
}
