/** Trending / Hot window: items created in the last 3 days. */
export const HUB_FEED_WINDOW_SEC = 3 * 86_400;

/** Window start is rounded down to this step so repeated first pages share one window. */
export const HUB_FEED_WINDOW_STEP_SEC = 60;

export const HUB_FEED_DEFAULT_LIMIT = 20;
export const HUB_FEED_MAX_LIMIT = 50;
export const HUB_FEED_CURSOR_MAX_LENGTH = 1_024;
