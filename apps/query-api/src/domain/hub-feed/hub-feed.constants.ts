/** Trending / Hot window: items created in the last 3 days. */
export const HUB_FEED_WINDOW_SEC = 3 * 86_400;

/** Window start is rounded down to this step so repeated first pages share one window. */
export const HUB_FEED_WINDOW_STEP_SEC = 60;

export const HUB_FEED_DEFAULT_LIMIT = 20;
export const HUB_FEED_MAX_LIMIT = 50;
export const HUB_FEED_CURSOR_MAX_LENGTH = 1_024;

/** Rail counters: hourly buckets of the last 72 hours (current hour included). */
export const HUB_FEED_COUNTER_WINDOW_HOURS = 72;
export const HUB_FEED_COUNTER_BUCKET_SEC = 3_600;

/** Rail sections show this many rows first and load this many more per "show more". */
export const HUB_FEED_FILTERS_PAGE_SIZE = 5;
export const HUB_FEED_FILTERS_MAX_PAGE_SIZE = 50;

/** Follow lists longer than this are cut (newest follows kept) when building counters. */
export const HUB_FEED_FILTERS_MAX_FOLLOWS = 5_000;

/** Counter query budget; past it the rail shows follows without numbers. */
export const HUB_FEED_FILTER_COUNTS_TIMEOUT_MS = 300;
