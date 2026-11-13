import { FEED_ACTIVITY_BUCKET_SEC } from '../../constants/feed-activity-buckets.constants';

/** Start of the hour bucket that contains `unixSec`. */
export function alignToBucketHour(unixSec: number): number {
  return Math.floor(unixSec / FEED_ACTIVITY_BUCKET_SEC) * FEED_ACTIVITY_BUCKET_SEC;
}

/**
 * First bucket hour to re-count so that the current (partial) hour plus the
 * `hours - 1` full hours before it are rebuilt.
 */
export function bucketRangeStart(nowUnixSec: number, hours: number): number {
  const span = Math.max(1, Math.floor(hours));
  return alignToBucketHour(nowUnixSec) - (span - 1) * FEED_ACTIVITY_BUCKET_SEC;
}
