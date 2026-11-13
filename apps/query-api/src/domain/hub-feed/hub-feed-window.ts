import { HUB_FEED_WINDOW_SEC, HUB_FEED_WINDOW_STEP_SEC } from './hub-feed.constants';

/** Start of the ranked window for a first page requested at `nowUnixSec`. */
export function hubFeedWindowStart(nowUnixSec: number): number {
  const step = Math.floor(nowUnixSec / HUB_FEED_WINDOW_STEP_SEC) * HUB_FEED_WINDOW_STEP_SEC;
  return step - HUB_FEED_WINDOW_SEC;
}

export function nowUnixSec(): number {
  return Math.floor(Date.now() / 1000);
}
