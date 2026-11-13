import type { FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';

/** Bucket width: one hour, in unix seconds. */
export const FEED_ACTIVITY_BUCKET_SEC = 3_600;

/** Hours re-counted by the frequent refresh job (items whose time falls in this range). */
export const FEED_ACTIVITY_BUCKETS_REFRESH_HOURS = 2;

/** Hours re-counted by the daily rebuild: the hub counter window (3 days). */
export const FEED_ACTIVITY_BUCKETS_WINDOW_HOURS = 72;

/** Buckets older than this are deleted by the daily rebuild. */
export const FEED_ACTIVITY_BUCKETS_RETENTION_HOURS = 96;

/** Hub tabs that get counters, in rebuild order. */
export const FEED_ACTIVITY_BUCKET_TABS: readonly FeedActivityBucketTab[] = [
  'posts',
  'threads',
  'activity',
  'updates',
];
