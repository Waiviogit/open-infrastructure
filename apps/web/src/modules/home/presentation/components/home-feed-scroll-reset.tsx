'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

import { isObjectActivityMessagePath } from '@/modules/messaging/domain/activity-message-permalink';
import { ScrollToTopOnEnter } from '@/shared/presentation';

/**
 * Each hub feed tab is its own list: switching tabs starts at the top.
 * Back/Forward keeps the saved offset (`ScrollToTopOnEnter` skips pending restores).
 * The activity preview modal pushes a message permalink over the feed — that is not a tab change.
 */
export function HomeFeedScrollReset() {
  const pathname = usePathname();
  const [feedPathname, setFeedPathname] = useState(pathname);
  if (pathname !== feedPathname && !isObjectActivityMessagePath(pathname)) {
    setFeedPathname(pathname);
  }
  return <ScrollToTopOnEnter routeKey={feedPathname} />;
}
