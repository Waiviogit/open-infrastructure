'use client';

import { isObjectActivityMessagePath } from '@/modules/messaging/domain/activity-message-permalink';
import { useEffectiveNav } from '@/shared/presentation';

import { isHomeFeedPath } from '../../domain/home-feed-tabs';
import { HomeFeedTabBand } from './home-feed-tab-band';

/**
 * Feed tab band for the hub layout: rendered next to the hub section nav (outside the
 * hub content's horizontal clip, so the band spans the viewport) on `/` and `/feed/*`.
 * Inside the hub an activity-message path is the preview modal over the feed, so the band
 * stays. Follows the optimistic target, like the hub section nav.
 */
export function HubFeedTabBand() {
  const { pathname } = useEffectiveNav();
  if (!isHomeFeedPath(pathname) && !isObjectActivityMessagePath(pathname)) {
    return null;
  }
  return <HomeFeedTabBand />;
}
